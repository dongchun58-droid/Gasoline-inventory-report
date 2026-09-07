// wave.js — Phase A: 끊기지 않는 한 줄 방어전
// · 좀비는 다리 폭 전체에 넓은 한 줄로 계속 내려온다(웨이브 구간/문 열기 없음).
// · 사격은 오토 타깃이 아니라 '분대 바로 앞 직진'. 무기가 좋아질수록 좌우 포착 폭이 넓어진다.
// · 좀비가 방어선까지 내려오면 병사에게 달려들어 물어뜯는다.
// · 병력/화기 카드는 좌·우 한쪽에 문으로 내려오고, 부수고 지나가면 획득한다.
// · 난이도는 중간중간 내려오는 보스로 조절한다.
import * as THREE from 'three';
import { ROAD_HALF, HORDE_HALF, SIDE_X, buildEnvironment, buildCard, buildSupplyGate, setGateHp, openGate, buildAPC } from './env.js';
import { Squad, FORMATION_KEYS } from './squad.js';
import { ZombiePool, buildBoss, animateBoss } from './zombies.js';
import { WEAPONS, WEAPON_ORDER, CHARACTERS, TROOP_CAP } from './stages.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const SQ_Z = 0;             // 방어선(분대 고정 위치)
const SPAWN_Z = -74;        // 좀비가 나타나는 지점
const CARD_Z = -40;         // 카드가 내려오기 시작하는 지점
const GATE_Z = -30;         // 보급 관문이 서 있는 자리(좌·우 차선)
const LINE_Z = SQ_Z - 1.0;  // 여기까지 오면 달려든다
const RANGE = 58;           // 예광탄이 날아가는 거리(화면 끝)
const FALL = 26;            // 데미지 감쇠 거리 — 멀수록 약하게 맞아 좀비가 눈앞까지 밀고 온다
const FAR_MIN = 0.22;       // 최대 거리에서 남는 데미지 비율
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));

export class WaveDefense {
  constructor(scene, camera, stage, character, fx, audio) {
    this.scene = scene; this.camera = camera; this.stage = stage; this.fx = fx; this.audio = audio;
    this.C = CHARACTERS[character] || CHARACTERS.cool;
    this.F = stage.flow;
    this.group = new THREE.Group(); scene.add(this.group);
    this.env = buildEnvironment(stage.theme, 260); this.group.add(this.env.group);
    this.squad = new Squad(character); this.group.add(this.squad.group);
    this.zombies = new ZombiePool(); this.group.add(this.zombies.group);
    this.x = 0; this.limit = ROAD_HALF - 1.2;
    this.troops = Math.max(4, stage.startTroops + (this.C.bonus.troops || 0)); this.peak = this.troops;
    this.weaponIdx = stage.wpnStart || 0; this.shieldT = 0; this.kills = 0; this.coins = 0; this.time = 0; this.t = 0;
    this.done = null; this.msg = null; this.shake = 0; this.firing = false;
    this.boss = null; this.cards = []; this.bossIdx = 0;
    this.gates = this._buildGates();
    this.apc = null;
    if (stage.apc) { const m = buildAPC(); this.group.add(m); this.apc = { mesh: m, side: 1, ...stage.apc }; }
    this._spawnAcc = 0; this._cardT = 2.4; this._trAcc = 0; this._killAcc = 0;
    this.R = rng(stage.n * 7919 + 13);
    this.squad.pos.set(this.x, 0, SQ_Z); this.squad.setCount(this.troops);
  }
  // 좌·우 차선에 보급 관문 하나씩. 쏴서 부수면 그 차선에서 카드가 계속 내려온다.
  _buildGates() {
    return [-1, 1].map((sx) => {
      const mesh = buildSupplyGate(); mesh.position.set(sx * SIDE_X, 0, GATE_Z); this.group.add(mesh);
      return { x: sx * SIDE_X, mesh, hp: this.F.gateHp, maxHp: this.F.gateHp, open: false, openT: 0, cardT: 1.2 };
    });
  }
  get weapon() { return WEAPONS[WEAPON_ORDER[this.weaponIdx]]; }
  get prog() { return Math.min(1, this.kills / this.F.quota); }

  update(dt, input) {
    if (this.done) return;
    this.t += dt; this.time += dt;
    // ── 좌우 자유 이동
    const speed = 15.5;
    if (input.steer != null) {
      const tx = input.steer * this.limit * 1.15;
      this.x += Math.max(-speed * dt, Math.min(speed * dt, tx - this.x));
    } else if (input.axis) this.x += input.axis * speed * dt;
    this.x = Math.max(-this.limit, Math.min(this.limit, this.x));
    if (input.consumeForm && input.consumeForm()) {
      this.formIdx = ((this.formIdx || 0) + 1) % FORMATION_KEYS.length;
      this.squad.setFormation(FORMATION_KEYS[this.formIdx]);
      this.msg = { text: this.squad.form.name + ' — ' + this.squad.form.desc, color: '#8fd6ff', t: 1.6 };
    }
    this.firing = !!input.fire;
    this.squad.pos.set(this.x, 0, SQ_Z); this.squad.setCount(this.troops);
    this.squad.firing = this.firing && this.troops > 0;
    this.squad.setWeapon(this.weapon.key);
    this.squad.update(dt, this.camera);
    if (this.shieldT > 0) this.shieldT -= dt;

    this._spawn(dt);
    this._gates(dt);
    this._cardsUpdate(dt);
    this._zombies(dt);
    this._boss(dt);
    this._fire(dt);
    this._apc(dt);
    this.zombies.update(dt, this.t);
    this.env.update(dt);
    this._camera(dt);
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (this.troops <= 0) { this.troops = 0; this.done = 'fail'; }
    // 목표 처치 + 최종 보스 격파 → 클리어
    if (this.prog >= 1 && this.bossIdx >= this.F.bosses.length && !this.boss) this.done = 'clear';
  }

  // ── 좀비: 폭 전체에 넓은 한 줄로 끊임없이 ────────────────────────────────
  _spawn(dt) {
    const F = this.F, p = this.prog;
    const B = F.bosses[this.bossIdx];
    if (B && !this.boss && p >= B.at) { this.bossIdx++; this._spawnBoss(B); }
    if (p >= 1) return;                                   // 목표를 채우면 최종 보스만 남는다
    let rate = lerp(F.rate[0], F.rate[1], p);
    rate *= Math.min(1, 0.30 + this.time / 20);           // 초반은 천천히 — 관문을 열 여유
    if (this.boss) rate *= 0.55;                          // 보스 중엔 호위 정도만
    this._spawnAcc += rate * dt;
    const hp = this.stage.zombie.hp * (1 + this.troops / 90);
    while (this._spawnAcc >= 1) {
      this._spawnAcc -= 1;
      const u = (p - F.runnerFrom) / Math.max(0.01, 1 - F.runnerFrom);
      const runner = p > F.runnerFrom && this.R() < lerp(0, 0.5, u);
      // 탱커: 느리지만 아주 단단한 대형 개체 — 뚫리면 방어선이 오래 물어뜯긴다
      const tank = !runner && F.tankFrom != null && p > F.tankFrom && this.R() < (F.tankRate || 0.10);
      const flank = this.stage.flank && this.R() < this.stage.flank;
      const x = flank ? (this.R() < 0.5 ? -1 : 1) * (ROAD_HALF - 0.8) : (this.R() * 2 - 1) * (HORDE_HALF - 0.6);
      const z = flank ? SPAWN_Z + 20 + this.R() * 26 : SPAWN_Z - this.R() * 8;
      const zb = this._newZombie(x, z, tank ? 'tank' : runner ? 'runner' : 'walker', tank ? hp * (F.tankHp || 4.5) : hp);
      if (zb && flank) zb.flank = true;                    // 옆에서 가운데로 파고든다
    }
  }
  _newZombie(x, z, type, hp) {
    const zb = this.zombies.spawn(x, z, type, hp, this.stage.zombie.speed);
    if (zb) { zb.sway = 0.5 + this.R() * 1.9; zb.swayPh = this.R() * 6.28; zb.swaySp = 0.5 + this.R() * 0.8; }
    return zb;
  }
  _zombies(dt) {
    for (const zb of this.zombies.list) {
      if (zb.state === 'dying') continue;
      if (zb.z < LINE_Z) {
        zb.state = 'walk'; zb.z += zb.speed * dt;
        if (zb.flank) {                                   // 가장자리에서 방어선 쪽으로 비스듬히
          const dx = this.x - zb.x;
          zb.x += Math.sign(dx) * Math.min(Math.abs(dx), zb.speed * 0.55 * dt);
          if (Math.abs(dx) < 1.2) zb.flank = false;
        } else {
          zb.x += Math.sin(this.t * zb.swaySp + zb.swayPh) * zb.sway * dt;   // 좌우로 흔들며 내려온다
          zb.x = Math.max(-HORDE_HALF, Math.min(HORDE_HALF, zb.x));
        }
      } else {
        zb.z = LINE_Z; zb.state = 'attack'; zb.atk -= dt;                  // 방어선 도달 → 달려들어 공격
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

  // ── 보급 관문: 부수기 전엔 카드가 안 나온다 ─────────────────────────────
  _gates(dt) {
    for (const g of this.gates) {
      if (!g.open) { setGateHp(g.mesh, g.hp / g.maxHp); continue; }
      if (g.openT < 1) { g.openT = Math.min(1, g.openT + dt * 2.2); openGate(g.mesh, g.openT); }
      g.cardT -= dt;
      if (g.cardT <= 0 && this.prog < 1) { g.cardT = lerp(this.F.cardEvery[0], this.F.cardEvery[1], this.prog); this._spawnCard(g.x); }
    }
  }
  _breakGate(g) {
    g.open = true; g.hp = 0; g.cardT = 0.6;
    this.fx.spark(_a.set(g.x, 2.0, GATE_Z), 60, 0xffd23f);
    this.fx.ash(_a.set(g.x, 1.4, GATE_Z), 40);
    this.msg = { text: '보급 관문 돌파! 카드가 내려옵니다', color: '#ffd23f', t: 2.0 };
    this.coins += 20; this.shake = 0.45;
    this.audio.gateOpen ? this.audio.gateOpen() : this.audio.card && this.audio.card(false);
  }

  // ── 카드: 열린 관문에서 계속 내려온다 ───────────────────────────────────
  _spawnCard(x) {
    const S = this.stage;
    const type = pick(S.cards, this.R);
    let value = 0, text = '';
    if (type === 'plus') { value = Math.round(lerp(S.plusRange[0], S.plusRange[1], this.R())); text = '+' + value; }
    else if (type === 'mul') { value = 2; text = '×2'; }
    else if (type === 'minus') { value = Math.min(24, Math.max(2, Math.round(this.troops * 0.07) + Math.floor(this.R() * 4))); text = '−' + value; }
    else if (type === 'weapon') text = 'WEAPON';
    else text = 'SHIELD';
    const mesh = buildCard(type, text); mesh.position.set(x, 0, CARD_Z); this.group.add(mesh);
    this.cards.push({ type, value, x, z: CARD_Z, mesh, taken: false, tt: 0 });
  }
  _cardsUpdate(dt) {
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      c.z += this.stage.cardSpeed * dt; c.mesh.position.z = c.z;
      if (c.taken) { c.tt += dt; c.mesh.position.y += dt * 6; c.mesh.scale.multiplyScalar(1 - dt * 3.0); }
      else if (c.z >= SQ_Z - 1.0 && Math.abs(this.x - c.x) < 2.6) this._apply(c);
      if (c.z > SQ_Z + 9 || c.tt > 0.9) { this.group.remove(c.mesh); this.cards.splice(i, 1); }
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
    const mesh = buildBoss(def); mesh.position.set(0, 0, SPAWN_Z + 6); this.group.add(mesh);
    const scale = Math.max(1, Math.min(9, this.troops / 90));
    this.boss = { def, mesh, hp: def.hp * scale, hpMax: def.hp * scale, x: 0, z: SPAWN_Z + 6, state: 'walk',
      slamCd: 1.5, aoeCd: def.aoeEvery, aoeT: 0, aoeX: 0, sumCd: def.summon ? def.summon.every : 1e9, dead: false, deadT: 0 };
    this.msg = { text: def.name, color: '#ff8a70', t: 2.0 };
    this.audio.roar && this.audio.roar();
  }
  _boss(dt) {
    const B = this.boss; if (!B) return;
    if (B.dead) { B.deadT += dt; B.mesh.position.y = -B.deadT * 1.4; B.mesh.rotation.z += dt * 0.5;
      B.mesh.scale.setScalar(Math.max(0.01, 1 - B.deadT * 0.5));
      if (B.deadT > 1.5) { this.group.remove(B.mesh); this.boss = null; } return; }
    const D = B.def, dx = this.x - B.x, dz = SQ_Z - B.z, d = Math.hypot(dx, dz);
    B.aoeCd -= dt;
    if (B.aoeT <= 0 && B.aoeCd <= 0 && d < 30) { B.aoeX = this.x; B.aoeT = 1.3; this.fx.showMarker(B.aoeX, SQ_Z); B.aoeCd = D.aoeEvery; }
    if (B.aoeT > 0) {
      B.aoeT -= dt; B.state = 'slam';
      if (B.aoeT <= 0) { this.fx.hideMarker();
        if (Math.abs(this.x - B.aoeX) < 4.2 && this.shieldT <= 0) {
          this.troops = Math.max(0, this.troops - Math.min(42, Math.max(3, Math.round(this.troops * D.aoe)))); this.shake = 0.55; this.audio.hit && this.audio.hit(); }
        this.fx.spark(_a.set(B.aoeX, 0.4, SQ_Z), 30, 0xff9a50); B.state = 'walk'; }
    } else if (d > 3.6) { B.state = 'walk'; B.x += dx / d * D.speed * dt; B.z += dz / d * D.speed * dt;
      B.x = Math.max(-HORDE_HALF, Math.min(HORDE_HALF, B.x)); }
    else { B.state = 'slam'; B.slamCd -= dt; if (B.slamCd <= 0) { B.slamCd = 1.5;
      if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - D.slam); this.audio.hit && this.audio.hit(); } this.shake = 0.4; } }
    if (D.summon) { B.sumCd -= dt; if (B.sumCd <= 0) { B.sumCd = D.summon.every; B.state = 'scream';
      const hp = this.stage.zombie.hp * (1 + this.troops / 90);
      for (let i = 0; i < D.summon.n; i++) this._newZombie(Math.max(-HORDE_HALF, Math.min(HORDE_HALF, B.x + (this.R() - 0.5) * 9)), B.z - 1 - this.R() * 5, 'runner', hp);
      this.audio.roar && this.audio.roar(); this.msg = { text: '비명! 좀비 소환', color: '#c0ffe0', t: 1.1 }; } }
    B.mesh.position.x = B.x; B.mesh.position.z = B.z;
    B.mesh.rotation.y = Math.atan2(this.x - B.x, SQ_Z - B.z);
    animateBoss(B.mesh, this.t, B.state);
  }
  _bossDie() {
    const B = this.boss; B.dead = true; B.deadT = 0; this.fx.hideMarker();
    this.fx.ichor(_a.set(B.x, 2.0, B.z), 50); this.fx.ash(_a.set(B.x, 1.6, B.z), 70);
    this.coins += 40; this.shake = 0.7;
    this.msg = { text: B.def.name + ' 격파!', color: '#ffd23f', t: 2.0 };
    this.audio.bossDie && this.audio.bossDie();
  }

  // ── 사격: 오토 타깃 없음. 각 열이 '자기 바로 앞'만 쏜다 ────────────────────
  _fire(dt) {
    const W = this.weapon;
    if (!this.firing || this.troops <= 0) { this.fx.hideBeam(); return; }
    const cols = this.squad.cols, colX = this.squad.colX;
    const catchW = W.arc * this.squad.form.fan;            // 무기 + 대형에 따라 좌우 포착 폭이 달라진다
    const budget = this.troops * W.dps * (this.C.bonus.dps || 1) * this.squad.form.dps * dt / cols;
    const shots = [];
    for (let c = 0; c < cols; c++) {
      const mx = this.x + colX[c];
      let left = budget, guard = 0, hitZ = SQ_Z - RANGE;
      // 부수지 않은 보급 관문이 정면에 있으면 그것부터 때린다
      let gate = null;
      for (const g of this.gates) if (!g.open && Math.abs(g.x - mx) < 2.5 + catchW) gate = g;
      if (gate) {                                          // 관문에는 화력의 일부만 — 방어선이 완전히 비지 않게
        const share = Math.min(left * 0.45, gate.hp); gate.hp -= share; left -= share;
        hitZ = GATE_Z;
        if (gate.hp <= 0) this._breakGate(gate);
      }
      while (left > 0 && guard++ < 10) {
        let tgt = null, best = -1e9, isBoss = false;
        const B = this.boss;
        if (B && !B.dead && Math.abs(B.x - mx) < 1.9 * (B.def.scale || 1) + catchW && B.z > SQ_Z - RANGE) { tgt = B; best = B.z; isBoss = true; }
        for (const zb of this.zombies.list) {
          if (zb.state === 'dying') continue;
          // 가까이 붙을수록 좌우로 더 넓게 대응한다(방어선에 달라붙은 좀비를 반드시 칠 수 있게)
          const near = 1 - Math.min(1, (SQ_Z - zb.z) / 14);
          if (Math.abs(zb.x - mx) > catchW + near * 2.8) continue;
          if (zb.z < SQ_Z - RANGE || zb.z > SQ_Z + 1.5) continue;
          if (zb.z > best) { best = zb.z; tgt = zb; isBoss = false; }
        }
        if (!tgt) break;
        hitZ = Math.max(hitZ, best);
        // 거리 감쇠: 가까이 붙을수록 훨씬 아프게 맞는다
        const fall = Math.max(FAR_MIN, Math.min(1, 1.15 - (SQ_Z - best) / FALL));
        const dmg = Math.min(left * fall, tgt.hp); tgt.hp -= dmg; left -= dmg / Math.max(0.001, fall);
        if (tgt.hp <= 0) { if (isBoss) { this._bossDie(); break; } this._kill(tgt); } else break;
      }
      shots.push([mx, hitZ]);
    }
    // 표적이 없어도 정면으로 직사한다(조준하지 않는다는 느낌)
    this.fx.hideBeam();
    if (W.beam) {
      for (let i = 0; i < shots.length; i += 2) {          // 한 칸 걸러 — 빔이 한 덩어리로 뭉치지 않게
        const sh = shots[i];
        this.fx.tracer(_a.set(sh[0], 0.92, SQ_Z - 0.7), _b.set(sh[0], 0.92, sh[1]), W.tracer, W.w);
        if (Math.random() < 0.35) this.fx.flash(_c.set(sh[0], 0.92, SQ_Z - 0.9), W.flash, 0x9ff4ff);
      }
      this._trAcc += W.rate * dt;
      while (this._trAcc >= 1) { this._trAcc -= 1; this.audio.shot && this.audio.shot(W.key); }
    } else {
      this._trAcc += W.rate * dt * Math.max(1, cols * 0.55);
      let fired = 0;
      while (this._trAcc >= 1 && fired < 40) {
        this._trAcc -= 1; fired++;
        const c = Math.floor(Math.random() * cols), sh = shots[c];
        for (let p = 0; p < W.pellets; p++) {
          const jx = (Math.random() - 0.5) * catchW * 1.7;
          this.fx.tracer(_a.set(sh[0], 0.92, SQ_Z - 0.7), _b.set(sh[0] + jx, 0.92 + (Math.random() - 0.5) * 0.3, sh[1]), W.tracer, W.w);
        }
        if (fired <= 14) this.fx.flash(_c.set(sh[0], 0.92, SQ_Z - 0.9), W.flash, 0xffd070);
        this.audio.shot && this.audio.shot(W.key);
      }
    }
  }
  // 장갑차: 분대 바깥쪽에 붙어 넓은 폭으로 함께 쏜다
  _apc(dt) {
    const A = this.apc; if (!A) return;
    const want = this.x > 0 ? -1 : 1;                       // 도로 안쪽에 오도록 반대편에 배치
    A.side += (want - A.side) * Math.min(1, dt * 2.2);
    const ax = Math.max(-ROAD_HALF + 1.4, Math.min(ROAD_HALF - 1.4, this.x + A.side * A.off));
    A.mesh.position.set(ax, 0, SQ_Z + 0.6);
    A.x = ax;
    if (!this.firing) return;
    let left = A.dps * dt, guard = 0, hitZ = SQ_Z - RANGE;
    while (left > 0 && guard++ < 8) {
      let tgt = null, best = -1e9, isBoss = false;
      const B = this.boss;
      if (B && !B.dead && Math.abs(B.x - ax) < 1.9 * (B.def.scale || 1) + A.arc && B.z > SQ_Z - RANGE) { tgt = B; best = B.z; isBoss = true; }
      for (const zb of this.zombies.list) {
        if (zb.state === 'dying') continue;
        if (Math.abs(zb.x - ax) > A.arc) continue;
        if (zb.z < SQ_Z - RANGE || zb.z > SQ_Z + 1.5) continue;
        if (zb.z > best) { best = zb.z; tgt = zb; isBoss = false; }
      }
      if (!tgt) break;
      hitZ = Math.max(hitZ, best);
      const fall = Math.max(FAR_MIN, Math.min(1, 1.15 - (SQ_Z - best) / FALL));
      const dmg = Math.min(left * fall, tgt.hp); tgt.hp -= dmg; left -= dmg / Math.max(0.001, fall);
      if (tgt.hp <= 0) { if (isBoss) { this._bossDie(); break; } this._kill(tgt); } else break;
    }
    if (Math.random() < 0.6) {
      this.fx.tracer(_a.set(ax, 1.55, SQ_Z - 0.4), _b.set(ax + (Math.random() - 0.5) * A.arc, 1.5, hitZ), 0xffb050, 0.15);
      this.fx.flash(_c.set(ax, 1.55, SQ_Z - 0.6), 1.5, 0xffc070);
    }
  }
  _camera(dt) {
    const c = this.camera, big = Math.min(1, this.squad.shown / 80);
    const tx = this.x * 0.62, ty = 8.8 + big * 2.8, tz = SQ_Z + 11.6 + big * 4.0;
    c.position.x += (tx - c.position.x) * Math.min(1, dt * 5);
    c.position.y += (ty - c.position.y) * Math.min(1, dt * 4);
    c.position.z += (tz - c.position.z) * Math.min(1, dt * 4);
    if (this.shake > 0) { this.shake -= dt; c.position.x += (Math.random() - 0.5) * this.shake * 0.6; c.position.y += (Math.random() - 0.5) * this.shake * 0.45; }
    c.lookAt(this.x * 0.40, 0.6, SQ_Z - 17);
  }
  status() {
    const B = this.boss && !this.boss.dead ? { name: this.boss.def.name, frac: this.boss.hp / this.boss.hpMax } : null;
    return { troops: this.troops, cap: TROOP_CAP, formation: this.squad.form.name, weapon: this.weapon.name, kills: this.kills, quota: this.F.quota,
      prog: this.prog, coins: this.coins, boss: B, msg: this.msg, shield: this.shieldT > 0,
      remain: this.zombies.alive, firing: this.firing };
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); }
}
function pick(w, R) { let r = R() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; } return 'plus'; }
