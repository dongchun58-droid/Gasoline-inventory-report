// wave.js — Phase A: 끊기지 않는 한 줄 방어전
// · 좀비는 다리 폭 전체에 넓은 한 줄로 계속 내려온다(웨이브 구간/문 열기 없음).
// · 사격은 오토 타깃이 아니라 '분대 바로 앞 직진'. 무기가 좋아질수록 좌우 포착 폭이 넓어진다.
// · 좀비가 방어선까지 내려오면 병사에게 달려들어 물어뜯는다.
// · 병력/화기 카드는 좌·우 한쪽에 문으로 내려오고, 부수고 지나가면 획득한다.
// · 난이도는 중간중간 내려오는 보스로 조절한다.
import * as THREE from 'three';
import { ROAD_HALF, HORDE_HALF, SIDE_X, buildEnvironment, buildCardDoor, breakDoor } from './env.js';
import { Squad } from './squad.js';
import { ZombiePool, buildBoss, animateBoss } from './zombies.js';
import { WEAPONS, WEAPON_ORDER, CHARACTERS } from './stages.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const SQ_Z = 0;             // 방어선(분대 고정 위치)
const SPAWN_Z = -74;        // 좀비가 나타나는 지점
const DOOR_Z = -40;         // 카드 문이 나타나는 지점(앞쪽 — 바로 눈에 들어오게)
const LINE_Z = SQ_Z - 1.0;  // 여기까지 오면 달려든다
const RANGE = 58;           // 사격이 닿는 거리(화면 끝)
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
    this.weaponIdx = 0; this.shieldT = 0; this.kills = 0; this.coins = 0; this.time = 0; this.t = 0;
    this.done = null; this.msg = null; this.shake = 0; this.firing = false;
    this.boss = null; this.doors = []; this.bossIdx = 0;
    this._spawnAcc = 0; this._cardT = 2.4; this._trAcc = 0; this._killAcc = 0;
    this.R = rng(stage.n * 7919 + 13);
    this.squad.pos.set(this.x, 0, SQ_Z); this.squad.setCount(this.troops);
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
    this.firing = !!input.fire;
    this.squad.pos.set(this.x, 0, SQ_Z); this.squad.setCount(this.troops);
    this.squad.firing = this.firing && this.troops > 0;
    this.squad.setWeapon(this.weapon.key);
    this.squad.update(dt, this.camera);
    if (this.shieldT > 0) this.shieldT -= dt;

    this._spawn(dt);
    this._doors(dt);
    this._zombies(dt);
    this._boss(dt);
    this._fire(dt);
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
    if (this.boss) rate *= 0.55;                          // 보스 중엔 호위 정도만
    this._spawnAcc += rate * dt;
    const hp = this.stage.zombie.hp * (1 + this.troops / 26);
    while (this._spawnAcc >= 1) {
      this._spawnAcc -= 1;
      const u = (p - F.runnerFrom) / Math.max(0.01, 1 - F.runnerFrom);
      const runner = p > F.runnerFrom && this.R() < lerp(0, 0.5, u);
      const x = (this.R() * 2 - 1) * (HORDE_HALF - 0.6);
      const z = SPAWN_Z - this.R() * 8;
      this._newZombie(x, z, runner ? 'runner' : 'walker', hp);
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
        zb.x += Math.sin(this.t * zb.swaySp + zb.swayPh) * zb.sway * dt;   // 좌우로 흔들며 내려온다
        zb.x = Math.max(-HORDE_HALF, Math.min(HORDE_HALF, zb.x));
      } else {
        zb.z = LINE_Z; zb.state = 'attack'; zb.atk -= dt;                  // 방어선 도달 → 달려들어 공격
        if (zb.atk <= 0) {
          zb.atk = 0.85;
          if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - 1); this.shake = Math.max(this.shake, 0.18); this.audio.hit && this.audio.hit(); }
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

  // ── 카드 문: 좌 또는 우로 내려온다. 부수고 지나가면 획득 ──────────────────
  _doors(dt) {
    const F = this.F;
    this._cardT -= dt;
    if (this._cardT <= 0 && this.prog < 1) { this._cardT = lerp(F.cardEvery[0], F.cardEvery[1], this.prog); this._spawnDoors(); }
    for (let i = this.doors.length - 1; i >= 0; i--) {
      const d = this.doors[i];
      d.z += this.stage.cardSpeed * dt; d.mesh.position.z = d.z;
      if (d.broken) { d.bt += dt; breakDoor(d.mesh, Math.min(1, d.bt * 2.6)); }
      else if (d.z >= SQ_Z - 1.2 && Math.abs(this.x - d.x) < 2.5) this._apply(d);
      if (d.z > SQ_Z + 10) { this.group.remove(d.mesh); this.doors.splice(i, 1); }
    }
  }
  _spawnDoors() {
    const S = this.stage;
    const mk = (x) => {
      const type = pick(S.cards, this.R);
      let value = 0, text = '';
      if (type === 'plus') { value = Math.round(lerp(S.plusRange[0], S.plusRange[1], this.R())); text = '+' + value; }
      else if (type === 'mul') { value = 2; text = '×2'; }
      else if (type === 'minus') { value = Math.max(2, Math.round(this.troops * (0.12 + this.R() * 0.12))); text = '−' + value; }
      else if (type === 'weapon') text = 'WEAPON';
      else text = 'SHIELD';
      const mesh = buildCardDoor(type, text);
      mesh.position.set(x, 0, DOOR_Z); this.group.add(mesh);
      const d = { type, value, x, z: DOOR_Z, mesh, broken: false, bt: 0 };
      this.doors.push(d); return d;
    };
    if (this.R() < 0.55) { mk(-SIDE_X); mk(SIDE_X); }        // 바깥 좌·우 둘 중 선택
    else mk((this.R() < 0.5 ? -1 : 1) * SIDE_X);             // 한쪽만
  }
  _apply(d) {
    d.broken = true; d.bt = 0;
    const before = this.troops;
    if (d.type === 'plus') this.troops += d.value;
    else if (d.type === 'mul') this.troops = Math.min(400, Math.round(this.troops * d.value));
    else if (d.type === 'minus') this.troops = Math.max(0, this.troops - d.value);
    else if (d.type === 'weapon') {
      if (this.weaponIdx < WEAPON_ORDER.length - 1) { this.weaponIdx++; this.msg = { text: '▲ ' + this.weapon.name, color: '#c9a8ff', t: 1.6 }; }
      else this.troops += 12;
    } else if (d.type === 'shield') { this.shieldT = 6; this.msg = { text: 'SHIELD 6초', color: '#7fffe0', t: 1.2 }; }
    this.peak = Math.max(this.peak, this.troops);
    if (d.type !== 'weapon' && d.type !== 'shield') {
      const dv = this.troops - before;
      this.msg = { text: (dv >= 0 ? '+' : '') + dv + ' 병력', color: dv >= 0 ? '#8fd6ff' : '#ff8a70', t: 1.0 };
    }
    this.fx.spark(_a.set(d.x, 1.6, d.z), 26, d.type === 'minus' ? 0xe0503a : 0xffd23f);
    this.audio.card && this.audio.card(d.type === 'minus');
  }

  // ── 보스 ────────────────────────────────────────────────────────────────
  _spawnBoss(def) {
    const mesh = buildBoss(def.type); mesh.position.set(0, 0, SPAWN_Z + 6); this.group.add(mesh);
    const scale = Math.max(1, Math.min(9, this.troops / 26));
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
          this.troops = Math.max(0, this.troops - Math.max(3, Math.round(this.troops * D.aoe))); this.shake = 0.55; this.audio.hit && this.audio.hit(); }
        this.fx.spark(_a.set(B.aoeX, 0.4, SQ_Z), 30, 0xff9a50); B.state = 'walk'; }
    } else if (d > 3.6) { B.state = 'walk'; B.x += dx / d * D.speed * dt; B.z += dz / d * D.speed * dt;
      B.x = Math.max(-HORDE_HALF, Math.min(HORDE_HALF, B.x)); }
    else { B.state = 'slam'; B.slamCd -= dt; if (B.slamCd <= 0) { B.slamCd = 1.5;
      if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - D.slam); this.audio.hit && this.audio.hit(); } this.shake = 0.4; } }
    if (D.summon) { B.sumCd -= dt; if (B.sumCd <= 0) { B.sumCd = D.summon.every; B.state = 'scream';
      const hp = this.stage.zombie.hp * (1 + this.troops / 26);
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
    const catchW = W.arc;                                  // 무기가 좋아질수록 좌우 포착 폭이 넓어진다
    const budget = this.troops * W.dps * (this.C.bonus.dps || 1) * dt / cols;
    const shots = [];
    for (let c = 0; c < cols; c++) {
      const mx = this.x + colX[c];
      let left = budget, guard = 0, hitZ = SQ_Z - RANGE;
      while (left > 0 && guard++ < 8) {
        let tgt = null, best = -1e9, isBoss = false;
        const B = this.boss;
        if (B && !B.dead && Math.abs(B.x - mx) < 1.9 + catchW && B.z > SQ_Z - RANGE) { tgt = B; best = B.z; isBoss = true; }
        for (const zb of this.zombies.list) {
          if (zb.state === 'dying') continue;
          if (Math.abs(zb.x - mx) > catchW) continue;
          if (zb.z < SQ_Z - RANGE || zb.z > SQ_Z + 1.5) continue;
          if (zb.z > best) { best = zb.z; tgt = zb; isBoss = false; }
        }
        if (!tgt) break;
        hitZ = Math.max(hitZ, best);
        const dmg = Math.min(left, tgt.hp); tgt.hp -= dmg; left -= dmg;
        if (tgt.hp <= 0) { if (isBoss) { this._bossDie(); break; } this._kill(tgt); } else break;
      }
      shots.push([mx, hitZ]);
    }
    // 표적이 없어도 정면으로 직사한다(조준하지 않는다는 느낌)
    this.fx.hideBeam();
    if (W.beam) {
      for (const [mx, hz] of shots) {
        this.fx.tracer(_a.set(mx, 0.92, SQ_Z - 0.7), _b.set(mx, 0.92, hz), W.tracer, W.w);
        if (Math.random() < 0.30) this.fx.flash(_c.set(mx, 0.92, SQ_Z - 0.9), W.flash, 0x9ff4ff);
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
    return { troops: this.troops, weapon: this.weapon.name, kills: this.kills, quota: this.F.quota,
      prog: this.prog, coins: this.coins, boss: B, msg: this.msg, shield: this.shieldT > 0,
      remain: this.zombies.alive, firing: this.firing };
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); }
}
function pick(w, R) { let r = R() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; } return 'plus'; }
