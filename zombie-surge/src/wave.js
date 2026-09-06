// wave.js — 웨이브 방어(Phase A): 분대는 다리를 '지키며 제자리', 좀비가 문에서 쏟아져 달려온다.
// 카드는 분대 쪽으로 미끄러져 내려오고, 플레이어는 레인 선택 + 발사(스페이스/버튼 홀드)만 한다.
import * as THREE from 'three';
import { LANE_X, buildEnvironment, buildCard, buildGate, openDoor } from './env.js';
import { Squad } from './squad.js';
import { ZombiePool, buildBoss, animateBoss } from './zombies.js';
import { WEAPONS, WEAPON_ORDER, CHARACTERS } from './stages.js';
import { updatePlate } from './textures.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const SQ_Z = 0;          // 분대 고정 위치(방어선)
const GATE_Z = -42;      // 문(좀비가 쏟아지는 곳) — 교전이 화면 안에서 크게 보이도록 가깝게
const CARD_START = -88;  // 카드 생성 지점
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class WaveDefense {
  constructor(scene, camera, stage, character, fx, audio) {
    this.scene = scene; this.camera = camera; this.stage = stage; this.fx = fx; this.audio = audio;
    this.C = CHARACTERS[character] || CHARACTERS.cool;
    this.group = new THREE.Group(); scene.add(this.group);
    this.env = buildEnvironment(stage.theme, 260); this.group.add(this.env.group);
    this.squad = new Squad(character); this.group.add(this.squad.group);
    this.zombies = new ZombiePool(); this.group.add(this.zombies.group);
    // 문(양 레인) — 항상 화면 안쪽에 고정
    this.gate = buildGate([0, 0]); this.gate.position.z = GATE_Z; this.group.add(this.gate);
    this.gateOpen = [0, 0];
    this.lane = 1; this.laneX = LANE_X[1];
    this.troops = Math.max(4, stage.startTroops + (this.C.bonus.troops || 0)); this.peak = this.troops;
    this.weaponIdx = 0; this.shieldT = 0; this.kills = 0; this.coins = 0; this.time = 0; this.t = 0;
    this.waveIdx = 0; this.phase = 'intro'; this.phaseT = 1.2; this.done = null; this.msg = null; this.shake = 0;
    this.boss = null; this.cards = []; this.cardQueue = 0; this.cardTimer = 0; this.firing = false; this.spawnQ = null;
    this.R = rng(stage.n * 7919 + 13); this._trAcc = 0; this._killAcc = 0;
    this.squad.pos.set(this.laneX, 0, SQ_Z); this.squad.setCount(this.troops);
    this.totalWaves = stage.waves.length;
  }
  get weapon() { return WEAPONS[WEAPON_ORDER[this.weaponIdx]]; }
  get wave() { return this.stage.waves[this.waveIdx]; }

  update(dt, input) {
    if (this.done) return;
    this.t += dt; this.time += dt;
    // 입력: 레인 이동 · 발사 홀드
    const l = input.consumeLane(); if (l) this.lane = Math.max(0, Math.min(1, this.lane + l));
    this.firing = !!input.fire;
    this.laneX += (LANE_X[this.lane] - this.laneX) * Math.min(1, dt * 9);
    this.squad.pos.set(this.laneX, 0, SQ_Z); this.squad.setCount(this.troops);
    this.squad.firing = this.firing && this.troops > 0;
    this.squad.setWeapon(this.weapon.key);
    this.squad.update(dt, this.camera);
    if (this.shieldT > 0) this.shieldT -= dt;

    this._phase(dt);
    this._cards(dt);
    this._drain(dt);
    this._zombies(dt);
    this._boss(dt);
    this._fire(dt);
    this.zombies.update(dt, this.t);
    this.env.update(dt);
    // 문 개폐 애니
    for (let ln = 0; ln < 2; ln++) openDoor(this.gate, ln, this.gateOpen[ln]);
    this._camera(dt);
    if (this.troops <= 0) { this.troops = 0; this.done = 'fail'; }
  }

  // ── 웨이브 상태 머신: intro → cards(보급) → assault(돌격) → clear → 다음
  _phase(dt) {
    this.phaseT -= dt;
    const w = this.wave;
    if (this.phase === 'intro') {
      if (this.phaseT <= 0) { this.phase = 'cards'; this.cardQueue = w.cards; this.cardTimer = 0.3;
        this.msg = { text: `WAVE ${this.waveIdx + 1} — 보급`, color: '#8fd6ff', t: 1.4 }; }
    } else if (this.phase === 'cards') {
      if (this.cardQueue <= 0 && this.cards.length === 0) {
        this.phase = 'assault'; this.phaseT = 0.9;
        this.audio.waveStart && this.audio.waveStart();
        this.msg = { text: w.type === 'boss' ? '보스 접근!' : `WAVE ${this.waveIdx + 1} — 방어!`, color: '#ff8a70', t: 1.6 };
      }
    } else if (this.phase === 'assault') {
      if (this.phaseT > 0) return;
      if (!this._released) {
        this._released = true;
        this.audio.gateOpen && this.audio.gateOpen();
        if (w.type === 'boss') { this._spawnBoss(w.boss); if (w.boss.escort) this._horde(w.boss.escort, 'walker'); }
        else this._horde(w.horde, w.type);
        for (let ln = 0; ln < 2; ln++) this.gateOpen[ln] = 0.001;
      }
      // 문 서서히 열림
      for (let ln = 0; ln < 2; ln++) if (this.gateOpen[ln] > 0 && this.gateOpen[ln] < 1) this.gateOpen[ln] = Math.min(1, this.gateOpen[ln] + dt * 2.8);
      const bossAlive = this.boss && !this.boss.gone;
      const pending = this.spawnQ && this.spawnQ.left > 0;
      if (this.zombies.alive === 0 && !bossAlive && !pending) {
        this.phase = 'clear'; this.phaseT = 1.0; this._released = false;
        this.coins += 15; this.msg = { text: `WAVE ${this.waveIdx + 1} 격퇴!`, color: '#7fffb0', t: 1.4 };
      }
    } else if (this.phase === 'clear') {
      for (let ln = 0; ln < 2; ln++) if (this.gateOpen[ln] > 0) this.gateOpen[ln] = Math.max(0, this.gateOpen[ln] - dt * 1.4);
      if (this.phaseT <= 0) {
        this.waveIdx++;
        if (this.waveIdx >= this.totalWaves) { this.done = 'clear'; return; }
        this.phase = 'intro'; this.phaseT = 0.8;
        this.audio.setScene && this.audio.setScene(this.wave.type === 'boss' ? 'boss' : 'wave');
      }
    }
  }
  // 무리를 한 번에 놓지 않고 문에서 끊임없이 밀려나오게 예약한다.
  _horde(n, type) {
    const hp = this.stage.zombie.hp * (1 + this.troops / 12);   // 분대가 커질수록 좀비도 단단해진다
    this.spawnQ = { left: n, type, hp, timer: 0, batch: Math.max(4, Math.ceil(n / 9)) };
    updatePlate(this.gate.userData.plates[0], n); updatePlate(this.gate.userData.plates[1], n);
  }
  _drain(dt) {
    const q = this.spawnQ; if (!q || q.left <= 0) return;
    q.timer -= dt; if (q.timer > 0) return;
    q.timer = 0.42;
    const S = this.stage, k = Math.min(q.batch, q.left); q.left -= k;
    for (let i = 0; i < k; i++) {
      const t = q.type === 'mixed' ? (this.R() < 0.42 ? 'runner' : 'walker') : q.type;
      const lane = this.R() < 0.5 ? 0 : 1;
      const x = LANE_X[lane] + (this.R() - 0.5) * 5.2;   // 레인 안에서 촘촘하게
      const z = GATE_Z - 2 - this.R() * 7;
      this.zombies.spawn(x, z, t, q.hp, S.zombie.speed);
    }
  }

  // ── 카드: 위(문 쪽)에서 분대 쪽으로 미끄러져 내려옴 ──────────────────────
  _cards(dt) {
    const S = this.stage;
    if (this.phase === 'cards' && this.cardQueue > 0) {
      this.cardTimer -= dt;
      if (this.cardTimer <= 0) { this._spawnCardPair(); this.cardQueue--; this.cardTimer = 1.05; }
    }
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const e = this.cards[i];
      e.z += S.cardSpeed * dt;
      e.mesh.position.z = e.z;
      for (let ln = 0; ln < 2; ln++) if (e.used[ln]) { const m = e.mesh.children[ln]; m.position.y += dt * 7; m.scale.multiplyScalar(1 - dt * 3.2); }
      if (!e.used[0] && !e.used[1] && e.z >= SQ_Z - 0.7) this._apply(e, this.lane);
      if (e.z > SQ_Z + 8) { this.group.remove(e.mesh); this.cards.splice(i, 1); }
    }
  }
  _spawnCardPair() {
    const S = this.stage, R = this.R, prog = (this.waveIdx + 1) / this.totalWaves;
    const pair = [];
    for (let ln = 0; ln < 2; ln++) {
      let type = pick(S.cards, R);
      if (ln === 1 && pair[0].type === type && (type === 'minus' || type === 'weapon' || type === 'shield')) type = 'plus';
      let value = 0, text = '';
      if (type === 'plus') { value = Math.round((S.plusRange[0] + R() * (S.plusRange[1] - S.plusRange[0])) * (0.8 + prog * 1.4)); text = '+' + value; }
      else if (type === 'mul') { value = R() < 0.85 ? 2 : 3; text = 'x' + value; }
      else if (type === 'minus') { value = Math.round(5 + prog * 26 + R() * 7); text = '-' + value; }
      else if (type === 'weapon') text = 'WEAPON';
      else text = 'SHIELD';
      pair.push({ type, value, text });
    }
    if (pair[0].type === 'plus' && pair[1].type === 'plus' && pair[0].value === pair[1].value) { pair[1].value += 2; pair[1].text = '+' + pair[1].value; }
    const mesh = new THREE.Group();
    for (let ln = 0; ln < 2; ln++) { const c = buildCard(pair[ln].type, pair[ln].text); c.position.set(LANE_X[ln], 0, 0); mesh.add(c); }
    mesh.position.z = CARD_START; this.group.add(mesh);
    this.cards.push({ mesh, z: CARD_START, cards: pair, used: [false, false] });
  }
  _apply(e, ln) {
    e.used[ln] = true; const c = e.cards[ln];
    this.audio.card && this.audio.card(c.type);
    if (c.type === 'plus') this.troops += c.value;
    else if (c.type === 'mul') this.troops = Math.min(999, Math.round(this.troops * c.value));
    else if (c.type === 'minus') { if (this.shieldT <= 0) this.troops = Math.max(1, this.troops - c.value); }
    else if (c.type === 'weapon') { const was = this.weaponIdx; this.weaponIdx = Math.min(WEAPON_ORDER.length - 1, this.weaponIdx + 1);
      if (this.weaponIdx !== was) this.msg = { text: this.weapon.name + ' 획득!', color: '#c9a8ff', t: 1.5 }; }
    else if (c.type === 'shield') this.shieldT = 6;
    this.peak = Math.max(this.peak, this.troops);
    if (c.type !== 'weapon') this.msg = { text: c.text, color: { plus: '#8fd6ff', mul: '#ffd23f', minus: '#ff8a70', shield: '#7fffe0' }[c.type], t: 0.85 };
  }

  // ── 좀비: 분대(방어선)로 달려온다 ────────────────────────────────────────
  _zombies(dt) {
    const sx = this.laneX, sz = SQ_Z;
    for (const zb of this.zombies.list) {
      if (zb.state === 'dying') continue;
      const dx = sx - zb.x, dz = sz - zb.z, d = Math.hypot(dx, dz);
      if (d > 1.25) { zb.state = 'walk'; zb.x += dx / d * zb.speed * dt; zb.z += dz / d * zb.speed * dt; }
      else {
        zb.state = 'attack'; zb.atk -= dt;
        if (zb.atk <= 0) {   // 접촉 = 1:1 교환(방패 중엔 병력 손실 없음)
          if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - 1); this.audio.hit && this.audio.hit(); this.fx.spark(_a.set(zb.x, 0.6, zb.z), 5, 0xff8a50); }
          this._kill(zb, false);
        }
      }
      zb.x = Math.max(-6.0, Math.min(6.0, zb.x));
    }
  }
  _kill(zb, byGun = true) {
    zb.state = 'dying'; zb.dieT = 0; this.kills++; this.coins += 1;
    this.fx.ichor(_a.set(zb.x, 0.5, zb.z), 7); this.fx.ash(_a.set(zb.x, 0.4, zb.z), 9);
    if (byGun) { this._killAcc++; if (this._killAcc % 2 === 0) this.audio.zdie && this.audio.zdie(); }
    else this.audio.zdie && this.audio.zdie();
  }

  // ── 보스 ────────────────────────────────────────────────────────────────
  _spawnBoss(def) {
    const mesh = buildBoss(def.type); mesh.position.set(0, 0, GATE_Z - 4); this.group.add(mesh);
    const scale = Math.max(1, Math.min(9, this.troops / 12));
    this.boss = { def, mesh, hp: def.hp * scale, hpMax: def.hp * scale, x: 0, z: GATE_Z - 4, state: 'walk', slamCd: 1.5,
      aoeCd: def.aoeEvery, aoeT: 0, aoeLane: -1, sumCd: def.summon ? def.summon.every : 1e9, gone: false, dead: false, deadT: 0 };
    this.msg = { text: def.name, color: '#ff8a70', t: 2.0 };
    this.audio.roar && this.audio.roar();
  }
  _boss(dt) {
    const B = this.boss; if (!B) return;
    if (B.dead) { B.deadT += dt; B.mesh.position.y = -B.deadT * 1.4; B.mesh.rotation.z += dt * 0.5;
      B.mesh.scale.setScalar(Math.max(0.01, 1 - B.deadT * 0.5));
      if (B.deadT > 1.5) { this.group.remove(B.mesh); B.gone = true; this.boss = null; } return; }
    const D = B.def, sx = this.laneX, sz = SQ_Z;
    const dx = sx - B.x, dz = sz - B.z, d = Math.hypot(dx, dz);
    B.aoeCd -= dt;
    if (B.aoeLane < 0 && B.aoeCd <= 0 && d < 26) { B.aoeLane = this.lane; B.aoeT = 1.25; this.fx.showMarker(LANE_X[B.aoeLane], SQ_Z); B.aoeCd = D.aoeEvery; }
    if (B.aoeLane >= 0) {
      B.aoeT -= dt; B.state = 'slam';
      if (B.aoeT <= 0) { this.fx.hideMarker();
        if (this.lane === B.aoeLane && this.shieldT <= 0) { this.troops = Math.max(0, this.troops - Math.max(3, Math.round(this.troops * D.aoe))); this.shake = 0.55; this.audio.hit && this.audio.hit(); }
        this.fx.spark(_a.set(LANE_X[B.aoeLane], 0.4, SQ_Z), 30, 0xff9a50); B.aoeLane = -1; B.state = 'walk'; }
    } else if (d > 3.4) { B.state = 'walk'; B.x += dx / d * D.speed * dt; B.z += dz / d * D.speed * dt; }
    else { B.state = 'slam'; B.slamCd -= dt; if (B.slamCd <= 0) { B.slamCd = 1.5;
      if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - D.slam); this.audio.hit && this.audio.hit(); } this.shake = 0.4; } }
    if (D.summon) { B.sumCd -= dt; if (B.sumCd <= 0) { B.sumCd = D.summon.every; B.state = 'scream';
      for (let i = 0; i < D.summon.n; i++) this.zombies.spawn(B.x + (this.R() - 0.5) * 7, B.z - 1 - this.R() * 5, 'runner', this.stage.zombie.hp * (1 + this.troops / 12), this.stage.zombie.speed);
      this.audio.roar && this.audio.roar(); this.msg = { text: '비명! 좀비 소환', color: '#c0ffe0', t: 1.1 }; } }
    B.mesh.position.x = B.x; B.mesh.position.z = B.z;
    B.mesh.rotation.y = Math.atan2(sx - B.x, sz - B.z);
    animateBoss(B.mesh, this.t, B.state);
  }

  // ── 사격: 발사 홀드 중에만 데미지 ────────────────────────────────────────
  _fire(dt) {
    const W = this.weapon;
    if (!this.firing || this.troops <= 0) { this.fx.hideBeam(); return; }
    // 사거리 안 타겟 목록(가까운 순)
    const range = 50;   // 화면에 보이는 끝(문 부근)까지 사격
    let target = null, best = -1e9;
    if (this.boss && !this.boss.dead && this.boss.z > GATE_Z + 8) { target = this.boss; }
    if (!target) for (const zb of this.zombies.list) { if (zb.state === 'dying') continue; if (zb.z < SQ_Z - range || zb.z > SQ_Z + 2) continue; if (zb.z > best) { best = zb.z; target = zb; } }
    if (!target) { this.fx.hideBeam(); return; }
    const isBoss = target === this.boss;
    const tp = _c.set(target.x, isBoss ? 1.9 : 0.9, target.z);
    // 데미지: 병력 × 무기 DPS × 캐릭터 보정
    let budget = this.troops * W.dps * (this.C.bonus.dps || 1) * dt;
    let guard = 0;
    while (budget > 0 && target && guard++ < 60) {
      if (target === this.boss) { const dmg = Math.min(budget, target.hp); target.hp -= dmg; budget = 0;
        if (target.hp <= 0) this._bossDie(); break; }
      const dmg = Math.min(budget, target.hp); target.hp -= dmg; budget -= dmg;
      if (target.hp <= 0) { this._kill(target, true);
        let nt = null, nb = -1e9;
        for (const zb of this.zombies.list) { if (zb.state === 'dying') continue; if (zb.z < SQ_Z - range || zb.z > SQ_Z + 2) continue; if (zb.z > nb) { nb = zb.z; nt = zb; } }
        target = nt; if (target) tp.set(target.x, 0.9, target.z);
      } else break;
    }
    // ── 이펙트: 무기별로 확실히 다르게
    const shooters = Math.min(this.squad.shown, 26);
    if (W.beam) {
      // 레이저: 굵은 연속 빔 + 강한 플래시
      const src = _a.set(this.laneX, 0.86, SQ_Z - 0.5);
      this.fx.showBeam(src, tp, this.camera);
      this.fx.flash(src.clone().add(_b.set(0, 0, -0.4)), 1.3, 0x9ff4ff);
      if (Math.random() < 0.5) this.fx.spark(tp, 3, 0x9ff4ff);
      this._trAcc += W.rate * dt;
      while (this._trAcc >= 1) { this._trAcc -= 1; this.audio.shot && this.audio.shot(W.key); }
    } else {
      this.fx.hideBeam();
      this._trAcc += W.rate * dt * Math.max(3, shooters * 1.1);
      let fired = 0;
      while (this._trAcc >= 1 && fired < 44) {
        this._trAcc -= 1; fired++;
        const k = Math.floor(Math.random() * Math.max(1, shooters));
        const sl = this.squad.slots[k];
        const mz = _a.set(this.laneX + sl.x + 0.08, 0.86, SQ_Z + sl.z - 0.72);
        for (let p = 0; p < W.pellets; p++) {
          const jitter = _b.set((Math.random() - 0.5) * W.spread * 22, (Math.random() - 0.5) * W.spread * 7, 0);
          const end = tp.clone().add(jitter);
          this.fx.tracer(mz, end, W.tracer, W.w);
        }
        if (fired <= 14) this.fx.flash(mz.clone(), W.flash, 0xffd070);
        this.audio.shot && this.audio.shot(W.key);
      }
      this.fx.spark(tp, 3, 0xffd070);
    }
  }
  _bossDie() {
    const B = this.boss; B.dead = true; B.deadT = 0; this.fx.hideMarker();
    this.fx.ichor(_a.set(B.x, 2.0, B.z), 50); this.fx.ash(_a.set(B.x, 1.6, B.z), 70);
    this.kills++; this.coins += 40; this.shake = 0.7;
    this.msg = { text: B.def.name + ' 격파!', color: '#ffd23f', t: 2.0 };
    this.audio.bossDie && this.audio.bossDie();
  }
  _camera(dt) {
    const c = this.camera, big = Math.min(1, this.squad.shown / 80);
    const tx = this.laneX * 0.42, ty = 8.6 + big * 3.0, tz = SQ_Z + 9.6 + big * 4.4;
    c.position.x += (tx - c.position.x) * Math.min(1, dt * 5);
    c.position.y += (ty - c.position.y) * Math.min(1, dt * 4);
    c.position.z += (tz - c.position.z) * Math.min(1, dt * 4);
    if (this.shake > 0) { this.shake -= dt; c.position.x += (Math.random() - 0.5) * this.shake * 0.6; c.position.y += (Math.random() - 0.5) * this.shake * 0.45; }
    c.lookAt(this.laneX * 0.24, 0.6, SQ_Z - 19);
  }
  status() {
    const B = this.boss && !this.boss.dead ? { name: this.boss.def.name, frac: this.boss.hp / this.boss.hpMax } : null;
    return { troops: this.troops, weapon: this.weapon.name, wave: Math.min(this.waveIdx + 1, this.totalWaves), waves: this.totalWaves,
      prog: this.waveIdx / this.totalWaves, coins: this.coins, boss: B, msg: this.msg, shield: this.shieldT > 0,
      remain: this.zombies.alive, firing: this.firing, phase: this.phase };
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); }
}
function pick(w, R) { let r = R() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; } return 'plus'; }
