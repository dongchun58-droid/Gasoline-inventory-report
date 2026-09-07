// field.js — Phase B/C: 사방이 트인 평야 전투
// · 분대는 전/후/좌/우로 자유롭게 움직인다.
// · 좀비는 전장 외곽 360°에서 몰려와 분대로 수렴한다.
// · 사격은 '바라보는 방향 기준 부채꼴'. 무기가 좋아질수록 부채각이 넓어져
//   상위 무기는 사실상 방사형(전방위)으로 쏜다. 대형에 따라서도 달라진다.
// · 보급 관문은 전장 외곽 세 지점에 서 있고, 부수면 그 지점에서 카드가 굴러온다.
import * as THREE from 'three';
import { FIELD_R, buildField, buildCard, buildSupplyGate, setGateHp, openGate, buildAPC } from './env.js';
import { Squad } from './squad.js';
import { ZombiePool, buildBoss, animateBoss, buildProjectile } from './zombies.js';
import { WEAPONS, WEAPON_ORDER, CHARACTERS, TROOP_CAP } from './stages.js';
import { FORMATION_KEYS } from './squad.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const RANGE = 46;           // 예광탄이 날아가는 거리
const FALL = 24;            // 데미지 감쇠 거리
const FAR_MIN = 0.22;
const RAYS = 20;            // 부채꼴을 몇 갈래로 쪼개 쏘는가
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
// 무기 티어별 기본 부채각(라디안). 하위는 좁은 정면, 상위는 사실상 전방위.
function baseFan(idx) { return lerp(1.55, Math.PI * 2, Math.pow(idx / (WEAPON_ORDER.length - 1), 1.05)); }

export class FieldRun {
  constructor(scene, camera, stage, character, fx, audio) {
    this.scene = scene; this.camera = camera; this.stage = stage; this.fx = fx; this.audio = audio;
    this.C = CHARACTERS[character] || CHARACTERS.cool;
    this.F = stage.flow;
    this.R = rng(stage.n * 7919 + 13);
    this.group = new THREE.Group(); scene.add(this.group);
    this.env = buildField(stage.theme); this.group.add(this.env.group);
    this.squad = new Squad(character); this.group.add(this.squad.group);
    this.zombies = new ZombiePool(); this.group.add(this.zombies.group);
    this.limit = FIELD_R - 4;
    this.x = 0; this.z = 0; this.face = -Math.PI / 2;    // 바라보는 방향(월드 각). 기본 = -z
    this.troops = Math.max(4, stage.startTroops + (this.C.bonus.troops || 0)); this.peak = this.troops;
    this.weaponIdx = stage.wpnStart || 0; this.shieldT = 0; this.kills = 0; this.coins = 0; this.time = 0; this.t = 0;
    this.done = null; this.msg = null; this.shake = 0; this.firing = false;
    this.boss = null; this.cards = []; this.bossIdx = 0; this.formIdx = 0; this.shots = [];
    this.gates = this._buildGates();
    this.apc = null;
    if (stage.apc) { const m = buildAPC(); this.group.add(m); this.apc = { mesh: m, a: 1.6, ...stage.apc }; }
    this._spawnAcc = 0; this._trAcc = 0; this._killAcc = 0;
    this.squad.pos.set(this.x, 0, this.z); this.squad.setCount(this.troops);
    this.camera.position.set(0, 32, 22);
  }
  // 외곽 세 지점의 보급 관문
  _buildGates() {
    return [-0.5, 0.5, 1.5].map((k) => {
      const a = -Math.PI / 2 + k * (Math.PI * 2 / 3);
      const gx = Math.cos(a) * (FIELD_R - 6), gz = Math.sin(a) * (FIELD_R - 6);
      const mesh = buildSupplyGate(); mesh.position.set(gx, 0, gz); mesh.rotation.y = -a - Math.PI / 2;
      this.group.add(mesh);
      return { x: gx, z: gz, mesh, hp: this.F.gateHp, maxHp: this.F.gateHp, open: false, openT: 0, cardT: 1.0 };
    });
  }
  get weapon() { return WEAPONS[WEAPON_ORDER[this.weaponIdx]]; }
  get prog() { return Math.min(1, this.kills / this.F.quota); }
  get fan() { return Math.min(Math.PI * 2, baseFan(this.weaponIdx) * this.squad.form.fan); }

  update(dt, input) {
    if (this.done) return;
    this.t += dt; this.time += dt;
    // ── 전/후/좌/우 자유 이동
    const spd = 15.0;
    let mx = 0, mz = 0;
    if (input.steer != null) { mx = input.steer; mz = input.steerZ != null ? input.steerZ : 0; }
    else { mx = input.axis || 0; mz = input.axisZ || 0; }
    const len = Math.hypot(mx, mz);
    if (len > 0.08) {
      const ux = mx / len, uz = mz / len, v = Math.min(1, len) * spd * dt;
      this.x += ux * v; this.z += uz * v;
      this.face = Math.atan2(uz, ux);                    // 움직이는 쪽을 바라본다
    }
    const r = Math.hypot(this.x, this.z);
    if (r > this.limit) { this.x *= this.limit / r; this.z *= this.limit / r; }
    // 대형 변경(N)
    if (input.consumeForm && input.consumeForm()) {
      this.formIdx = (this.formIdx + 1) % FORMATION_KEYS.length;
      this.squad.setFormation(FORMATION_KEYS[this.formIdx]);
      this.msg = { text: this.squad.form.name + ' — ' + this.squad.form.desc, color: '#8fd6ff', t: 1.6 };
    }
    this.firing = !!input.fire;
    this.squad.pos.set(this.x, 0, this.z);
    this.squad.heading = this.face + Math.PI / 2;         // 대형도 같이 회전
    this.squad.setCount(this.troops);
    this.squad.firing = this.firing && this.troops > 0;
    this.squad.setWeapon(this.weapon.key);
    this.squad.update(dt, this.camera);
    if (this.shieldT > 0) this.shieldT -= dt;

    this._spawn(dt);
    this._gates(dt);
    this._cardsUpdate(dt);
    this._zombies(dt);
    this._boss(dt);
    this._shots(dt);
    this._fire(dt);
    this._apc(dt);
    this.zombies.update(dt, this.t);
    this._camera(dt);
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (this.troops <= 0) { this.troops = 0; this.done = 'fail'; }
    if (this.prog >= 1 && this.bossIdx >= this.F.bosses.length && !this.boss) this.done = 'clear';
  }

  // ── 좀비: 외곽 360°에서 몰려와 분대로 수렴 ──────────────────────────────
  _spawn(dt) {
    const F = this.F, p = this.prog;
    const B = F.bosses[this.bossIdx];
    if (B && !this.boss && p >= B.at) { this.bossIdx++; this._spawnBoss(B); }
    if (p >= 1) return;
    let rate = lerp(F.rate[0], F.rate[1], p);
    rate *= Math.min(1, 0.30 + this.time / 20);
    if (this.boss) rate *= 0.6;
    this._spawnAcc += rate * dt;
    const hp = this.stage.zombie.hp * (1 + this.troops / 90);
    while (this._spawnAcc >= 1) {
      this._spawnAcc -= 1;
      const u = (p - F.runnerFrom) / Math.max(0.01, 1 - F.runnerFrom);
      const runner = p > F.runnerFrom && this.R() < lerp(0, 0.5, u);
      const tank = !runner && F.tankFrom != null && p > F.tankFrom && this.R() < (F.tankRate || 0.10);
      // 분대가 바라보는 쪽에 더 몰리되, 뒤쪽에서도 꾸준히 들어온다
      const bias = this.R() < 0.62 ? this.face + (this.R() - 0.5) * 1.9 : this.R() * Math.PI * 2;
      const rr = FIELD_R + 2 + this.R() * 12;
      this._newZombie(Math.cos(bias) * rr, Math.sin(bias) * rr,
        tank ? 'tank' : runner ? 'runner' : 'walker', tank ? hp * (F.tankHp || 4.5) : hp);
    }
  }
  _newZombie(x, z, type, hp) {
    const zb = this.zombies.spawn(x, z, type, hp, this.stage.zombie.speed);
    if (zb) { zb.sway = 0.3 + this.R() * 1.2; zb.swayPh = this.R() * 6.28; zb.swaySp = 0.5 + this.R() * 0.8; }
    return zb;
  }
  _zombies(dt) {
    for (const zb of this.zombies.list) {
      if (zb.state === 'dying') continue;
      const dx = this.x - zb.x, dz = this.z - zb.z, d = Math.hypot(dx, dz) || 1;
      if (d > 1.5) {
        zb.state = 'walk';
        const perp = Math.sin(this.t * zb.swaySp + zb.swayPh) * zb.sway;   // 흔들며 접근
        zb.x += (dx / d * zb.speed + (-dz / d) * perp) * dt;
        zb.z += (dz / d * zb.speed + (dx / d) * perp) * dt;
        zb.ang = Math.atan2(dx, dz);
      } else {
        zb.state = 'attack'; zb.atk -= dt;
        if (zb.atk <= 0) {
          zb.atk = zb.type === 'tank' ? 0.7 : 0.85;
          const bite = zb.type === 'tank' ? 3 : 1;
          if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - bite); this.shake = Math.max(this.shake, zb.type === 'tank' ? 0.3 : 0.18); this.audio.hit && this.audio.hit(); }
          this.fx.spark(_a.set(zb.x, 0.7, zb.z), 5, 0xff8a50);
        }
      }
    }
  }
  _kill(zb) {
    zb.state = 'dying'; zb.dieT = 0; this.kills++; this.coins += 1;
    this.fx.ichor(_a.set(zb.x, 0.5, zb.z), 6); this.fx.ash(_a.set(zb.x, 0.4, zb.z), 8);
    this._killAcc++; if (this._killAcc % 3 === 0) this.audio.zdie && this.audio.zdie();
  }

  // ── 보급 관문 → 카드 ───────────────────────────────────────────────────
  _gates(dt) {
    for (const g of this.gates) {
      if (!g.open) { setGateHp(g.mesh, g.hp / g.maxHp); continue; }
      if (g.openT < 1) { g.openT = Math.min(1, g.openT + dt * 2.2); openGate(g.mesh, g.openT); }
      g.cardT -= dt;
      if (g.cardT <= 0 && this.prog < 1) { g.cardT = lerp(this.F.cardEvery[0], this.F.cardEvery[1], this.prog) * 1.5; this._spawnCard(g); }
    }
  }
  _breakGate(g) {
    g.open = true; g.hp = 0; g.cardT = 0.5;
    this.fx.spark(_a.set(g.x, 2.0, g.z), 60, 0xffd23f);
    this.fx.ash(_a.set(g.x, 1.4, g.z), 40);
    this.msg = { text: '보급 관문 돌파! 카드가 나옵니다', color: '#ffd23f', t: 2.0 };
    this.coins += 20; this.shake = 0.45;
    this.audio.gateOpen ? this.audio.gateOpen() : this.audio.card && this.audio.card(false);
  }
  _spawnCard(g) {
    const S = this.stage;
    const type = pick(S.cards, this.R);
    let value = 0, text = '';
    if (type === 'plus') { value = Math.round(lerp(S.plusRange[0], S.plusRange[1], this.R())); text = '+' + value; }
    else if (type === 'mul') { value = 2; text = '×2'; }
    else if (type === 'minus') { value = Math.min(24, Math.max(2, Math.round(this.troops * 0.07) + Math.floor(this.R() * 4))); text = '−' + value; }
    else if (type === 'weapon') text = 'WEAPON';
    else text = 'SHIELD';
    const mesh = buildCard(type, text);
    const a = Math.atan2(g.z, g.x), off = (this.R() - 0.5) * 8;
    const cx = g.x - Math.cos(a) * 3 + Math.sin(a) * off, cz = g.z - Math.sin(a) * 3 - Math.cos(a) * off;
    mesh.position.set(cx, 0, cz); mesh.rotation.y = -a - Math.PI / 2; this.group.add(mesh);
    // 카드는 전장 중심 쪽으로 천천히 굴러온다
    this.cards.push({ type, value, x: cx, z: cz, vx: -Math.cos(a), vz: -Math.sin(a), mesh, taken: false, tt: 0, life: 26 });
  }
  _cardsUpdate(dt) {
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      const sp = this.stage.cardSpeed * 0.34;
      c.x += c.vx * sp * dt; c.z += c.vz * sp * dt; c.life -= dt;
      c.mesh.position.set(c.x, c.mesh.position.y, c.z);
      if (c.taken) { c.tt += dt; c.mesh.position.y += dt * 6; c.mesh.scale.multiplyScalar(1 - dt * 3.0); }
      else if (Math.hypot(this.x - c.x, this.z - c.z) < 2.8) this._apply(c);
      if (c.life <= 0 || c.tt > 0.9 || Math.hypot(c.x, c.z) < 2) { this.group.remove(c.mesh); this.cards.splice(i, 1); }
    }
  }
  _apply(c) {
    c.taken = true; c.tt = 0;
    const before = this.troops;
    if (c.type === 'plus') this.troops = Math.min(TROOP_CAP, this.troops + c.value);
    else if (c.type === 'mul') this.troops = Math.min(TROOP_CAP, Math.round(this.troops * c.value));
    else if (c.type === 'minus') this.troops = Math.max(0, this.troops - c.value);
    else if (c.type === 'weapon') {
      const cap = this.stage.wpnMax != null ? this.stage.wpnMax : WEAPON_ORDER.length - 1;
      if (this.weaponIdx < cap) { this.weaponIdx++; this.msg = { text: '▲ ' + this.weapon.name, color: '#c9a8ff', t: 1.6 }; }
      else { this.troops += 6; this.msg = { text: '이 지역 최대 화기 · +6 병력', color: '#c9a8ff', t: 1.4 }; }
    } else if (c.type === 'shield') { this.shieldT = 6; this.msg = { text: 'SHIELD 6초', color: '#7fffe0', t: 1.2 }; }
    this.troops = Math.min(TROOP_CAP, this.troops);
    this.peak = Math.max(this.peak, this.troops);
    if (c.type !== 'weapon' && c.type !== 'shield') {
      const dv = this.troops - before;
      this.msg = { text: (dv >= 0 ? '+' : '') + dv + ' 병력', color: dv >= 0 ? '#8fd6ff' : '#ff8a70', t: 1.0 };
    }
    this.fx.spark(_a.set(c.x, 1.6, c.z), 22, c.type === 'minus' ? 0xe0503a : 0xffd23f);
    this.audio.card && this.audio.card(c.type === 'minus');
  }

  // ── 보스 ────────────────────────────────────────────────────────────────
  _spawnBoss(def) {
    const mesh = buildBoss(def); this.group.add(mesh);
    const a = this.face + (this.R() - 0.5) * 1.2, rr = FIELD_R - 2;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
    mesh.position.set(bx, 0, bz);
    const scale = Math.max(1, Math.min(6, this.troops / 45));
    this.boss = { def, mesh, hp: def.hp * scale, hpMax: def.hp * scale, x: bx, z: bz, state: 'walk',
      slamCd: 1.5, aoeCd: def.aoeEvery, aoeT: 0, aoeX: 0, aoeZ: 0, sumCd: def.summon ? def.summon.every : 1e9, dead: false, deadT: 0 };
    this.msg = { text: def.name, color: '#ff8a70', t: 2.0 };
    this.audio.roar && this.audio.roar();
  }
  _boss(dt) {
    const B = this.boss; if (!B) return;
    if (B.dead) { B.deadT += dt; B.mesh.position.y = -B.deadT * 1.4; B.mesh.rotation.z += dt * 0.5;
      B.mesh.scale.multiplyScalar(Math.max(0.01, 1 - dt * 1.1));
      if (B.deadT > 1.5) { this.group.remove(B.mesh); this.boss = null; this.fx.hideMarker(); } return; }
    const D = B.def, dx = this.x - B.x, dz = this.z - B.z, d = Math.hypot(dx, dz) || 1;
    B.aoeCd -= dt;
    if (B.aoeT <= 0 && B.aoeCd <= 0 && d < 42) {
      B.aoeX = this.x; B.aoeZ = this.z; B.aoeT = 1.35; this.fx.showMarker(B.aoeX, B.aoeZ); B.aoeCd = D.aoeEvery;
      this._launch(B, B.aoeX, B.aoeZ, 1.35, 1.55, Math.min(42, Math.max(4, Math.round(this.troops * D.aoe))), 4.8, true);
      this.audio.roar && this.audio.roar();
    }
    if (B.aoeT > 0) { B.aoeT -= dt; B.state = 'slam'; if (B.aoeT <= 0) { this.fx.hideMarker(); B.state = 'walk'; } }
    B.shotCd = (B.shotCd || D.shotEvery) - dt;
    if (B.shotCd <= 0 && d < 50) { B.shotCd = D.shotEvery;
      const a2 = this.R() * Math.PI * 2, r2 = this.R() * 4;
      this._launch(B, this.x + Math.cos(a2) * r2, this.z + Math.sin(a2) * r2, 0.95, 0.85, D.shotDmg, 3.0, false); }
    if (d > 3.6) { B.state = 'walk'; B.x += dx / d * D.speed * dt; B.z += dz / d * D.speed * dt; }
    else { B.state = 'slam'; B.slamCd -= dt; if (B.slamCd <= 0) { B.slamCd = 1.5;
      if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - D.slam); this.audio.hit && this.audio.hit(); } this.shake = 0.4; } }
    if (D.summon) { B.sumCd -= dt; if (B.sumCd <= 0) { B.sumCd = D.summon.every; B.state = 'scream';
      const hp = this.stage.zombie.hp * (1 + this.troops / 90);
      for (let i = 0; i < D.summon.n; i++) { const a = this.R() * Math.PI * 2, rr = 6 + this.R() * 8;
        this._newZombie(B.x + Math.cos(a) * rr, B.z + Math.sin(a) * rr, 'runner', hp); }
      this.audio.roar && this.audio.roar(); this.msg = { text: '비명! 좀비 소환', color: '#c0ffe0', t: 1.1 }; } }
    B.mesh.position.set(B.x, 0, B.z);
    B.mesh.rotation.y = Math.atan2(dx, dz);
    animateBoss(B.mesh, this.t, B.state);
  }
  // 투사체 발사 · 비행 · 명중
  _launch(B, tx, tz, flight, scale, dmg, radius, big) {
    const mesh = buildProjectile(B.def.ammo, scale * (B.def.scale || 1) * 0.9);
    const sy = 2.6 * (B.def.scale || 1);
    mesh.position.set(B.x, sy, B.z); this.group.add(mesh);
    this.shots.push({ mesh, sx: B.x, sy, sz: B.z, tx, tz, t: 0, dur: flight, dmg, radius, big,
      arc: big ? 9 : 5.5, ammo: B.def.ammo });
    if (!big) this.fx.spark(_a.set(B.x, sy, B.z), 6, 0xff9a50);
  }
  _shots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      const x = s.sx + (s.tx - s.sx) * u, z = s.sz + (s.tz - s.sz) * u;
      const y = s.sy + (0.6 - s.sy) * u + Math.sin(u * Math.PI) * s.arc;
      s.mesh.position.set(x, y, z);
      if (s.ammo === 'bolt') { s.mesh.rotation.y = Math.atan2(s.tx - s.sx, s.tz - s.sz);
        s.mesh.rotation.x = -Math.atan2(s.arc * Math.cos(u * Math.PI) * 3.1, Math.hypot(s.tx - s.sx, s.tz - s.sz)); }
      else s.mesh.rotation.set(s.t * 5, s.t * 3.6, 0);
      if (s.ammo === 'fire' && Math.random() < 0.7) this.fx.spark(_a.set(x, y, z), 2, 0xffa040);
      if (u >= 1) {
        this.group.remove(s.mesh); this.shots.splice(i, 1);
        if (Math.hypot(this.x - s.tx, this.z - s.tz) < s.radius && this.shieldT <= 0) {
          this.troops = Math.max(0, this.troops - s.dmg); this.audio.hit && this.audio.hit(); }
        this.shake = Math.max(this.shake, s.big ? 0.6 : 0.25);
        this.fx.spark(_a.set(s.tx, 0.4, s.tz), s.big ? 34 : 14, s.ammo === 'fire' ? 0xff8a30 : 0xc8bda8);
        if (s.big) this.fx.ash(_a.set(s.tx, 0.5, s.tz), 22);
      }
    }
  }
  _bossDie() {
    const B = this.boss; B.dead = true; B.deadT = 0; this.fx.hideMarker();
    this.fx.ichor(_a.set(B.x, 2.0, B.z), 50); this.fx.ash(_a.set(B.x, 1.6, B.z), 70);
    this.coins += 40; this.shake = 0.7;
    this.msg = { text: B.def.name + ' 격파!', color: '#ffd23f', t: 2.0 };
    this.audio.bossDie && this.audio.bossDie();
  }

  // ── 사격: 바라보는 방향 기준 부채꼴. 상위 무기 = 전방위 ───────────────────
  _fire(dt) {
    const W = this.weapon;
    if (!this.firing || this.troops <= 0) { this.fx.hideBeam(); return; }
    // 대형이 사격 패턴을 결정한다
    const P = this.squad.form.pattern || { mode: 'fan', k: 1 };
    const base = baseFan(this.weaponIdx);
    const angles = [];
    if (P.mode === 'cardinal') {                       // 동서남북(또는 8방향)만, 방향마다 좁게
      for (let d = 0; d < P.dirs; d++) { const c = this.face + (d / P.dirs) * Math.PI * 2;
        for (let k = 0; k < P.per; k++) angles.push(c + (P.per === 1 ? 0 : (k / (P.per - 1) - 0.5)) * P.spread * 2); }
    } else if (P.mode === 'sparse') {                  // 360°지만 갈래가 적어 듬성듬성
      for (let k = 0; k < P.rays; k++) angles.push(this.face + (k / P.rays) * Math.PI * 2);
    } else {                                           // 정면 부채꼴
      const fan0 = Math.min(Math.PI * 2, base * P.k * 1.35), full0 = fan0 >= Math.PI * 1.98;
      for (let k = 0; k < RAYS; k++) { const u = k / (RAYS - 1) - 0.5;
        angles.push(full0 ? this.face + (k / RAYS) * Math.PI * 2 : this.face + u * fan0); }
    }
    const fan = this.fan, full = fan >= Math.PI * 1.98;
    const total = this.troops * W.dps * (this.C.bonus.dps || 1) * this.squad.form.dps * dt;
    // 눈앞(5m 안)에 붙은 놈은 방향과 무관하게 전원이 대응한다 — 뒤로 돌아온 좀비가
    // 영영 안 맞고 계속 물어뜯는 구멍을 막는다.
    this._pointBlank(total * 0.30);
    const N = angles.length;
    const budget = total * 0.70 / N;
    // 갈래가 적을수록(원형 대형) 각 갈래가 담당하는 폭도 좁아 빈틈이 생긴다
    const tol = P.mode === 'cardinal' ? Math.max(0.14, P.spread)
              : P.mode === 'sparse' ? 0.18
              : Math.max(0.16, (full ? Math.PI * 2 : fan) / N * 1.15);
    const shots = [];
    for (let k = 0; k < N; k++) {
      const ang = angles[k];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let left = budget, guard = 0, hitD = RANGE;
      while (left > 0 && guard++ < 8) {
        let tgt = null, bestD = 1e9, isBoss = false, isGate = null;
        // 관문
        for (const g of this.gates) { if (g.open) continue;
          const dx = g.x - this.x, dz = g.z - this.z, d = Math.hypot(dx, dz);
          if (d > RANGE) continue;
          if (Math.abs(angDiff(Math.atan2(dz, dx), ang)) > tol + 2.6 / Math.max(4, d)) continue;
          if (d < bestD) { bestD = d; isGate = g; tgt = null; } }
        const B = this.boss;
        if (B && !B.dead) { const dx = B.x - this.x, dz = B.z - this.z, d = Math.hypot(dx, dz);
          // 보스는 거대한 표적 — 각도 여유를 크게 주고, 붙으면 방향과 무관하게 맞는다
          const wide = tol + (5.0 * (B.def.scale || 1)) / Math.max(6, d);
          if (d <= RANGE && (d < 22 || Math.abs(angDiff(Math.atan2(dz, dx), ang)) < wide) && d < bestD) {
            bestD = d; tgt = B; isBoss = true; isGate = null; } }
        for (const zb of this.zombies.list) {
          if (zb.state === 'dying') continue;
          const dx = zb.x - this.x, dz = zb.z - this.z, d = Math.hypot(dx, dz);
          if (d > RANGE || d >= bestD) continue;
          if (Math.abs(angDiff(Math.atan2(dz, dx), ang)) > tol + 0.9 / Math.max(3, d)) continue;
          bestD = d; tgt = zb; isBoss = false; isGate = null;
        }
        if (isGate) { const share = Math.min(left * 0.85, isGate.hp); isGate.hp -= share; left -= share;
          hitD = Math.min(hitD, bestD); if (isGate.hp <= 0) this._breakGate(isGate); break; }
        if (!tgt) break;
        hitD = Math.min(hitD, bestD);
        const fall = Math.max(FAR_MIN, Math.min(1, 1.15 - bestD / FALL));
        const dmg = Math.min(left * fall, tgt.hp); tgt.hp -= dmg; left -= dmg / Math.max(0.001, fall);
        if (tgt.hp <= 0) { if (isBoss) { this._bossDie(); break; } this._kill(tgt); } else break;
      }
      shots.push([ca, sa, hitD]);
    }
    // ── 이펙트
    this.fx.hideBeam();
    const src = _a.set(0, 0.95, 0);
    if (W.beam) {
      // 넓은 전장에서는 빔이 화면을 덮지 않도록 얇게 · 성기게
      const step = shots.length > 14 ? 3 : shots.length > 8 ? 2 : 1;
      const off = Math.floor(Math.random() * step);
      for (let i = off; i < shots.length; i += step) {
        const [ca, sa, d] = shots[i];
        src.set(this.x + ca * 1.0, 0.95, this.z + sa * 1.0);
        this.fx.tracer(src, _b.set(this.x + ca * d, 0.95, this.z + sa * d), W.tracer, W.w * 0.42);
        if (Math.random() < 0.28) this.fx.flash(_c.set(src.x, 0.95, src.z), W.flash * 0.75, W.tracer);
      }
      this._trAcc += W.rate * dt;
      while (this._trAcc >= 1) { this._trAcc -= 1; this.audio.shot && this.audio.shot(W.key); }
    } else {
      this._trAcc += W.rate * dt * Math.max(1, N * 0.42);
      let fired = 0;
      while (this._trAcc >= 1 && fired < 30) {
        this._trAcc -= 1; fired++;
        const [ca, sa, d] = shots[Math.floor(Math.random() * shots.length)];
        const j = (Math.random() - 0.5) * 0.10;
        const c2 = Math.cos(Math.atan2(sa, ca) + j), s2 = Math.sin(Math.atan2(sa, ca) + j);
        src.set(this.x + ca * 1.0, 0.95, this.z + sa * 1.0);
        for (let p = 0; p < W.pellets; p++)
          this.fx.bullet(src, _b.set(this.x + c2 * d, 0.95 + (Math.random() - 0.5) * 0.25, this.z + s2 * d), W.tracer, W.w * 0.62);
        if (fired <= 8) this.fx.flash(_c.set(src.x, 0.95, src.z), W.flash * 0.8, 0xffd070);
        this.audio.shot && this.audio.shot(W.key);
      }
    }
  }
  // 근접 전방위 대응(방향 무관)
  _pointBlank(budget) {
    let left = budget, guard = 0;
    while (left > 0 && guard++ < 24) {
      let tgt = null, bd = 1e9;
      for (const zb of this.zombies.list) {
        if (zb.state === 'dying') continue;
        const d = Math.hypot(zb.x - this.x, zb.z - this.z);
        if (d > 5.5 || d >= bd) continue; bd = d; tgt = zb;
      }
      const B = this.boss;
      if (B && !B.dead) { const d = Math.hypot(B.x - this.x, B.z - this.z);
        if (d < 6.5 + 1.6 * (B.def.scale || 1) && d < bd) { const dmg = Math.min(left, B.hp); B.hp -= dmg; left -= dmg;
          if (B.hp <= 0) this._bossDie(); continue; } }
      if (!tgt) break;
      const dmg = Math.min(left, tgt.hp); tgt.hp -= dmg; left -= dmg;
      if (tgt.hp <= 0) { this._kill(tgt); this.fx.spark(_a.set(tgt.x, 0.8, tgt.z), 4, 0xffd070); } else break;
    }
  }
  // 장갑차: 분대 옆을 따라다니며 전방위로 사격
  _apc(dt) {
    const A = this.apc; if (!A) return;
    A.a += dt * 0.5;
    const ax = this.x + Math.cos(A.a) * A.off, az = this.z + Math.sin(A.a) * A.off;
    A.mesh.position.set(ax, 0, az); A.mesh.rotation.y = -A.a + Math.PI / 2; A.x = ax; A.z = az;
    if (!this.firing) return;
    let left = A.dps * dt, guard = 0, best = null, bd = 1e9;
    for (const zb of this.zombies.list) { if (zb.state === 'dying') continue;
      const d = Math.hypot(zb.x - ax, zb.z - az); if (d < bd && d < RANGE) { bd = d; best = zb; } }
    const B = this.boss;
    if (B && !B.dead) { const d = Math.hypot(B.x - ax, B.z - az); if (d < bd && d < RANGE) { bd = d; best = B; } }
    while (left > 0 && best && guard++ < 8) {
      const fall = Math.max(FAR_MIN, Math.min(1, 1.15 - bd / FALL));
      const dmg = Math.min(left * fall, best.hp); best.hp -= dmg; left -= dmg / Math.max(0.001, fall);
      if (best.hp <= 0) { if (best === this.boss) { this._bossDie(); break; } this._kill(best); }
      else break;
      best = null; bd = 1e9;
      for (const zb of this.zombies.list) { if (zb.state === 'dying') continue;
        const d = Math.hypot(zb.x - ax, zb.z - az); if (d < bd && d < RANGE) { bd = d; best = zb; } }
    }
    if (bd < 1e9 && Math.random() < 0.6) {
      const a = Math.atan2((best ? best.z : this.z) - az, (best ? best.x : this.x) - ax);
      this.fx.tracer(_a.set(ax, 1.6, az), _b.set(ax + Math.cos(a) * Math.min(bd, RANGE), 1.5, az + Math.sin(a) * Math.min(bd, RANGE)), 0xffb050, 0.15);
      this.fx.flash(_c.set(ax, 1.6, az), 1.5, 0xffc070);
    }
  }
  _camera(dt) {
    const c = this.camera, big = Math.min(1, this.squad.shown / 80);
    // 사방을 보려면 높고 안정적인 시점이 낫다 — 분대를 중심에 두고 위에서 비스듬히
    const up = 26.0 + big * 6.5, back = 18.5 + big * 4.0;
    c.position.x += (this.x - c.position.x) * Math.min(1, dt * 4.0);
    c.position.y += (up - c.position.y) * Math.min(1, dt * 3.0);
    c.position.z += ((this.z + back) - c.position.z) * Math.min(1, dt * 4.0);
    if (this.shake > 0) { this.shake -= dt; c.position.x += (Math.random() - 0.5) * this.shake * 0.7; c.position.y += (Math.random() - 0.5) * this.shake * 0.5; }
    c.lookAt(this.x, 0.6, this.z - 1.5);
  }
  status() {
    const B = this.boss && !this.boss.dead ? { name: this.boss.def.name, frac: this.boss.hp / this.boss.hpMax } : null;
    return { troops: this.troops, cap: TROOP_CAP, weapon: this.weapon.name, kills: this.kills, quota: this.F.quota,
      prog: this.prog, coins: this.coins, boss: B, msg: this.msg, shield: this.shieldT > 0,
      remain: this.zombies.alive, firing: this.firing, formation: this.squad.form.name,
      fan: Math.round(this.fan * 180 / Math.PI) };
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); }
}
function angDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function pick(w, R) { let r = R() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; } return 'plus'; }
