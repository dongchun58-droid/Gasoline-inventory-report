// lane.js — Phase A 레인 러너: 카드·문·병력·좀비·보스. 전진 = -z
import * as THREE from 'three';
import { LANE_X, buildEnvironment, buildCard, buildGate, openDoor } from './env.js';
import { Squad } from './squad.js';
import { ZombiePool, buildBoss, animateBoss } from './zombies.js';
import { WEAPONS, WEAPON_ORDER, CHARACTERS } from './stages.js';
import { updatePlate } from './textures.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class LaneRunner {
  constructor(scene, camera, stage, character, fx, audio) {
    this.scene = scene; this.camera = camera; this.stage = stage; this.fx = fx; this.audio = audio;
    this.char = CHARACTERS[character] || CHARACTERS.cool;
    this.group = new THREE.Group(); scene.add(this.group);
    this.env = buildEnvironment(stage.theme, stage.length); this.group.add(this.env.group);
    this.squad = new Squad(character); this.group.add(this.squad.group);
    this.zombies = new ZombiePool(); this.group.add(this.zombies.group);
    this.lane = 1; this.laneX = LANE_X[1]; this.z = 0;
    this.troops = stage.startTroops + (this.char.bonus.troops || 0); this.peak = this.troops;
    this.weaponIdx = 0; this.shieldT = 0; this.kills = 0; this.coins = 0; this.time = 0; this.t = 0;
    this.state = 'run'; this.done = null; this.holdZ = null; this.msg = null; this.shake = 0;
    this.squad.pos.set(this.laneX, 0, 0); this.squad.setCount(this.troops);
    this.events = this._genEvents(); this.live = [];    // 생성된(가시) 이벤트
    this.boss = null; this.bossSpawned = false; this.miniDone = false;
    this._trAcc = 0; this._shotCd = 0; this._nextEvt = 0;
  }
  get weapon() { return WEAPONS[WEAPON_ORDER[this.weaponIdx]]; }

  _genEvents() {
    const S = this.stage, R = rng(S.n * 7919 + 17), ev = [];
    const nCards = Math.floor(S.length / S.cardGap);
    for (let k = 1; k <= nCards; k++) {
      const z = -k * S.cardGap; const prog = k / nCards;
      // 문·팩 근처(±8)엔 카드 안 놓음
      if (S.gates.some((g) => Math.abs(-g.at * S.length - z) < 9) || S.packs.some((p) => Math.abs(-p.at * S.length - z) < 9)) continue;
      const pair = [];
      for (let lane = 0; lane < 2; lane++) {
        let type = pick(S.cards, R); if (lane === 1 && pair[0].type === 'minus' && type === 'minus') type = 'plus';
        if (lane === 1 && pair[0].type === 'weapon' && type === 'weapon') type = 'plus';
        let value = 0, text = '';
        if (type === 'plus') { value = Math.round((S.plusRange[0] + R() * (S.plusRange[1] - S.plusRange[0])) * (0.7 + prog * 1.3)); text = '+' + value; }
        else if (type === 'mul') { value = (S.n >= 2 && R() < 0.15) ? 3 : 2; text = 'x' + value; }
        else if (type === 'minus') { value = Math.round(6 + prog * 34 + R() * 8); text = '-' + value; }
        else if (type === 'weapon') { text = 'WEAPON↑'; }
        else { text = 'SHIELD'; }
        pair.push({ type, value, text });
      }
      // 두 카드가 완전히 같은 +면 하나를 살짝 다르게(선택 의미 부여)
      if (pair[0].type === 'plus' && pair[1].type === 'plus' && pair[0].value === pair[1].value) { pair[1].value += 2; pair[1].text = '+' + pair[1].value; }
      ev.push({ kind: 'card', z, cards: pair, used: [false, false] });
    }
    for (const g of S.gates) ev.push({ kind: 'gate', z: -g.at * S.length, counts: g.counts.slice(), alive: [0, 0], released: [false, false], spawned: false, open: [0, 0] });
    for (const p of S.packs) ev.push({ kind: 'pack', z: -p.at * S.length, n: p.n, type: p.type, spawned: false });
    if (S.miniBoss) ev.push({ kind: 'mini', z: -S.miniBoss.at * S.length, def: S.miniBoss, spawned: false });
    ev.sort((a, b) => b.z - a.z);   // z 큰(가까운) 순
    return ev;
  }

  setLane(l) { this.lane = Math.max(0, Math.min(1, l)); }

  update(dt, input) {
    if (this.done) return;
    this.t += dt; this.time += dt;
    const S = this.stage, W = this.weapon;
    const l = input.consumeLane(); if (l) this.setLane(this.lane + l);
    // 목표 레인으로 부드럽게
    this.laneX += (LANE_X[this.lane] - this.laneX) * Math.min(1, dt * 8);
    // 전진(문/보스 앞에서는 정지)
    const holding = this.holdZ !== null && this.z <= this.holdZ;
    // 교전 자세: 활성 좀비가 전방 12 이내면 멈춰 서서 사격(광고처럼 문 앞에서 한판)
    let engaged = false;
    for (const zb of this.zombies.list) { if (zb.state === 'dying' || zb.penned || zb.active === false) continue; const d = this.z - zb.z; if (d > -2 && d < 16) { engaged = true; break; } }
    if (this.boss && !this.boss.dead && this.boss.z > this.z - 14) engaged = true;
    const spd = holding ? 0 : (engaged ? S.speed * 0.12 : S.speed);
    this.z -= spd * dt;
    this.squad.pos.set(this.laneX, 0, this.z); this.squad.setCount(this.troops);
    this.squad.update(dt, spd / S.speed);
    if (this.shieldT > 0) this.shieldT -= dt;

    // 이벤트 활성화(전방 150 이내 생성) / 뒤로 지나간 것 제거
    while (this._nextEvt < this.events.length && this.events[this._nextEvt].z > this.z - 150) { this._activate(this.events[this._nextEvt]); this._nextEvt++; }
    for (let i = this.live.length - 1; i >= 0; i--) { const e = this.live[i]; if (e.z > this.z + 14 && e.kind !== 'mini') { if (e.mesh) this.group.remove(e.mesh); this.live.splice(i, 1); } }

    // 카드/문/팩 처리
    for (const e of this.live) {
      if (e.kind === 'card') {
        if (!e.used[this.lane] && this.z <= e.z + 0.6 && this.z > e.z - 3) this._applyCard(e, this.lane);
        // 통과 애니(선택된 카드 위로 튀어 사라짐)
        for (let ln = 0; ln < 2; ln++) if (e.used[ln] && e.mesh) { const m = e.mesh.children[ln]; m.position.y += dt * 6; m.scale.multiplyScalar(1 - dt * 3); }
      } else if (e.kind === 'gate') {
        const dz = this.z - e.z;
        if (!e.spawned && dz < 60) this._spawnGate(e);
        // 내 레인 문: 접근 시 그 레인 좀비 방출, 문 앞 정지
        // 문은 '한 레인에 커밋': 처음 진입한 레인만 방출, 반대 레인은 잠긴 채 유지(광고 규칙)
        if (e.spawned && e.lockedLane === undefined && dz < 34) { e.lockedLane = this.lane; e.released[this.lane] = true; this._release(e, this.lane); }
        // 커밋한 레인을 다 쓸어내면 성벽 돌파: 양쪽 문 모두 열리고 반대 레인 우리는 해산
        const cleared = e.lockedLane !== undefined && e.alive[e.lockedLane] === 0;
        if (cleared && !e.cleared) { e.cleared = true; const other = 1 - e.lockedLane; for (let i = this.zombies.list.length - 1; i >= 0; i--) { const zb = this.zombies.list[i]; if (zb.gate === e && zb.lane === other && zb.penned) this.zombies.list.splice(i, 1); } e.alive[other] = 0; updatePlate(e.mesh.userData.plates[other], 0); }
        const mine = cleared ? false : (e.lockedLane !== undefined && this.lane !== e.lockedLane ? true : e.alive[this.lane] > 0);   // 잠긴 반대 레인 문도 막힘
        if (mine && dz < 3.5 && dz > -2) this.holdZ = e.z + 3.0; else if (this.holdZ === e.z + 3.0 && !mine) this.holdZ = null;
        if (cleared) for (let ln = 0; ln < 2; ln++) { if (e.open[ln] < 1) { e.open[ln] = Math.min(1, e.open[ln] + dt * 1.8); openDoor(e.mesh, ln, e.open[ln]); } }
      } else if (e.kind === 'pack') {
        if (!e.spawned && this.z - e.z < 55) { e.spawned = true; for (let i = 0; i < e.n; i++) { const zb = this.zombies.spawn((Math.random() - 0.5) * 11, e.z - 2 - Math.random() * 14, e.type, S.zombie.hp, S.zombie.speed); if (zb) zb.active = false; } }
      } else if (e.kind === 'mini') {
        if (!e.spawned && this.z - e.z < 40) { e.spawned = true; this._spawnBoss(e.def, e.z - 26, e.z + 2); }
      }
    }
    // 좀비 활성(전방 32 이내면 돌진)
    for (const zb of this.zombies.list) if (zb.active === false && zb.z > this.z - 34) zb.active = true;

    // 보스 등장(길이 끝)
    if (!this.bossSpawned && this.z <= -S.length) { this.bossSpawned = true; this._spawnBoss(S.boss, this.z - 30, this.z, true); }

    this._updateZombies(dt);
    this._updateBoss(dt);
    this._fire(dt);
    this.zombies.update(dt, this.t);
    this.env.update(dt);
    this._camera(dt);
    if (this.troops <= 0) { this.troops = 0; this.done = 'fail'; }
  }

  _activate(e) {
    if (e.kind === 'card') { e.mesh = new THREE.Group(); for (let ln = 0; ln < 2; ln++) { const c = buildCard(e.cards[ln].type, e.cards[ln].text); c.position.set(LANE_X[ln], 0, e.z); e.mesh.add(c); } this.group.add(e.mesh); }
    else if (e.kind === 'gate') { e.mesh = buildGate(e.counts); e.mesh.position.z = e.z; this.group.add(e.mesh); }
    this.live.push(e);
  }
  _applyCard(e, ln) {
    e.used[ln] = true; const c = e.cards[ln]; this.audio.sfxCard && this.audio.sfxCard(c.type);
    if (c.type === 'plus') this.troops += c.value;
    else if (c.type === 'mul') this.troops = Math.min(999, this.troops * c.value);
    else if (c.type === 'minus') { if (this.shieldT <= 0) this.troops = Math.max(1, this.troops - c.value); }
    else if (c.type === 'weapon') this.weaponIdx = Math.min(WEAPON_ORDER.length - 1, this.weaponIdx + 1);
    else if (c.type === 'shield') this.shieldT = 5;
    this.peak = Math.max(this.peak, this.troops);
    this.msg = { text: c.text, color: { plus: '#8fd6ff', mul: '#ffd23f', minus: '#ff8a70', weapon: '#c9a8ff', shield: '#7fffe0' }[c.type], t: 0.9 };
  }
  _spawnGate(e) {
    e.spawned = true;
    for (let ln = 0; ln < 2; ln++) {
      const n = e.counts[ln]; const S = this.stage;
      for (let i = 0; i < n; i++) { const zb = this.zombies.spawn(LANE_X[ln] + (Math.random() - 0.5) * 3.6, e.z - 3 - Math.random() * Math.min(16, 3 + n * 0.22), 'walker', S.zombie.hp, S.zombie.speed, e); if (!zb) break; zb.active = false; zb.lane = ln; zb.penned = true; }
      e.alive[ln] = this.zombies.list.filter((z) => z.gate === e && z.lane === ln).length;
    }
  }
  _release(e, ln) { for (const zb of this.zombies.list) if (zb.gate === e && zb.lane === ln) { zb.penned = false; zb.active = true; } }

  _updateZombies(dt) {
    const sx = this.laneX, sz = this.z + 0.6;
    for (const zb of this.zombies.list) {
      if (zb.state === 'dying') continue;
      if (zb.penned) { zb.state = 'walk'; continue; }
      if (zb.active === false) continue;
      const dx = sx - zb.x, dz = sz - zb.z, d = Math.hypot(dx, dz);
      if (d > 1.15) { zb.state = 'walk'; zb.x += dx / d * zb.speed * dt; zb.z += dz / d * zb.speed * dt; }
      else {
        // 접촉 = 1:1 교환: 병사 1명 잃고 좀비도 쓰러짐(광고 규칙). 방패 중엔 좀비만 쓰러짐
        zb.state = 'attack'; zb.attackCd -= dt;
        if (zb.attackCd <= 0) { this._hurt(1, zb.x, zb.z); this._killZombie(zb); }
      }
      // 다리 밖으로 못 나감
      zb.x = Math.max(-6.2, Math.min(6.2, zb.x));
    }
  }
  _hurt(n, x, z) {
    if (this.shieldT > 0) return;
    this.troops = Math.max(0, this.troops - n);
    this.fx.spark(_a.set(x, 0.3, z), 4);
    this.audio.sfxHurt && this.audio.sfxHurt();
  }
  _killZombie(zb) {
    zb.state = 'dying'; zb.dieT = 0; this.kills++; this.coins += 1;
    this.fx.ichor(_a.set(zb.x, 0.2, zb.z), 8); this.fx.ash(_a, 10);
    if (zb.gate) { zb.gate.alive[zb.lane]--; updatePlate(zb.gate.mesh.userData.plates[zb.lane], Math.max(0, zb.gate.alive[zb.lane])); }
    this.audio.sfxZombieDie && this.audio.sfxZombieDie();
  }

  _spawnBoss(def, z, holdZ, final = false) {
    const mesh = buildBoss(def.type); mesh.position.set(0, 0, z); this.group.add(mesh);
    this.boss = { def, mesh, hp: def.hp, x: 0, z, state: 'walk', slamCd: 1.2, aoeCd: def.aoeEvery, aoeT: 0, aoeLane: -1, sumCd: def.summon ? def.summon.every : 1e9, final, dead: false };
    this.holdZ = holdZ; this.msg = { text: def.name + ' 등장!', color: '#ff8a70', t: 1.6 };
    this.audio.sfxRoar && this.audio.sfxRoar();
  }
  _updateBoss(dt) {
    const B = this.boss; if (!B) return;
    if (B.dead) { B.mesh.position.y -= dt * 1.2; B.mesh.rotation.x += dt * 0.4; B.deadT += dt; if (B.deadT > 1.4) { this.group.remove(B.mesh); this.boss = null; if (B.final) this.done = 'clear'; else { this.holdZ = null; } } return; }
    const D = B.def; const sx = this.laneX, sz = this.z + 0.8;
    const dx = sx - B.x, dz = sz - B.z, d = Math.hypot(dx, dz);
    // 광역(레인 예고 → 강타)
    B.aoeCd -= dt;
    if (B.aoeLane < 0 && B.aoeCd <= 0) { B.aoeLane = this.lane; B.aoeT = 1.3; this.fx.showMarker(LANE_X[B.aoeLane], this.z + 0.5); B.aoeCd = D.aoeEvery; }
    if (B.aoeLane >= 0) { B.aoeT -= dt; B.state = 'slam'; if (B.aoeT <= 0) { this.fx.hideMarker(); if (this.lane === B.aoeLane) { this._hurt(Math.max(3, Math.round(this.troops * D.aoe)), LANE_X[B.aoeLane], this.z); this.shake = 0.5; } this.fx.spark(_a.set(LANE_X[B.aoeLane], 0.3, this.z), 24); B.aoeLane = -1; B.state = 'walk'; } }
    else if (d > 3.2) { B.state = 'walk'; B.x += dx / d * D.speed * dt; B.z += dz / d * D.speed * dt; }
    else { B.state = 'slam'; B.slamCd -= dt; if (B.slamCd <= 0) { B.slamCd = 1.4; this._hurt(D.slam, B.x, B.z); this.shake = 0.35; } }
    // 스크리머 소환
    if (D.summon) { B.sumCd -= dt; if (B.sumCd <= 0) { B.sumCd = D.summon.every; B.state = 'scream'; for (let i = 0; i < D.summon.n; i++) { const zb = this.zombies.spawn(B.x + (Math.random() - 0.5) * 6, B.z - 1 - Math.random() * 5, 'runner', this.stage.zombie.hp, this.stage.zombie.speed); if (zb) zb.active = true; } this.msg = { text: '비명! 좀비 소환', color: '#c0ffe0', t: 1.0 }; } }
    B.mesh.position.x = B.x; B.mesh.position.z = B.z; B.mesh.lookAt(sx, 0, sz + 100); B.mesh.rotation.y += Math.PI;
    animateBoss(B.mesh, this.t, B.state);
  }

  _fire(dt) {
    const W = this.weapon, S = this.stage;
    const n = this.troops; if (n <= 0) return;
    const range = W.range, front = this.z - 0.5;
    // 타겟: 보스 우선(사거리 내), 아니면 가장 가까운 활성 좀비
    let target = null, tz = -1e9;
    if (this.boss && !this.boss.dead && this.boss.z < front + 2 && this.boss.z > front - range) target = this.boss;
    if (!target) { for (const zb of this.zombies.list) { if (zb.state === 'dying' || zb.penned || zb.active === false) continue; if (zb.z > front + 1.5 || zb.z < front - range) continue; if (zb.z > tz) { tz = zb.z; target = zb; } } }
    if (!target) return;
    // 데미지 예산(병력 × 무기 DPS × 캐릭터) — 사거리 내 다수 대상에 순차 배분
    let budget = n * W.dps * (this.char.bonus.dps || 1) * dt;
    const hitPos = target === this.boss ? _a.set(target.x, 1.6, target.z) : _a.set(target.x, 1.0, target.z);
    while (budget > 0 && target) {
      if (target === this.boss) { const dmg = Math.min(budget, target.hp); target.hp -= dmg; budget -= dmg; if (target.hp <= 0) { this._bossDie(); target = null; break; } break; }
      const dmg = Math.min(budget, target.hp); target.hp -= dmg; budget -= dmg;
      if (target.hp <= 0) { this._killZombie(target); let nt = null, nz = -1e9; for (const zb of this.zombies.list) { if (zb.state === 'dying' || zb.penned || zb.active === false) continue; if (zb.z > front + 1.5 || zb.z < front - range) continue; if (zb.z > nz) { nz = zb.z; nt = zb; } } target = nt; }
    }
    // 예광탄/머즐(속도 제한)
    this._trAcc += Math.min(n, W.rate) * dt;
    while (this._trAcc >= 1) {
      this._trAcc -= 1; const k = Math.floor(Math.random() * Math.max(1, Math.min(this.squad.shown, 16)));
      const sl = this.squad.slots[k]; _b.set(this.laneX + sl.x * 0.85, 1.25, this.z + sl.z - 0.3);
      this.fx.tracer(_b, hitPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 0)), W.tracer);
      if (Math.random() < 0.35) this.fx.flash(_b.clone().add(new THREE.Vector3(0, 0.05, -0.5)));
    }
    this._shotCd -= dt; if (this._shotCd <= 0) { this._shotCd = 0.09; this.audio.sfxShot && this.audio.sfxShot(); }
  }
  _bossDie() {
    const B = this.boss; B.dead = true; B.deadT = 0; this.fx.hideMarker();
    this.fx.ichor(_a.set(B.x, 1.2, B.z), 40); this.fx.ash(_a, 60); this.kills++; this.coins += 25; this.shake = 0.6;
    this.msg = { text: B.def.name + ' 격파!', color: '#ffd23f', t: 1.8 }; this.audio.sfxBossDie && this.audio.sfxBossDie();
  }

  _camera(dt) {
    const c = this.camera; const big = Math.min(1, this.squad.shown / 72); const tx = this.laneX * 0.55, ty = 8.4 + big * 2.2, tz = this.z + 12.5 + big * 2.5;
    c.position.x += (tx - c.position.x) * Math.min(1, dt * 5); c.position.y += (ty - c.position.y) * Math.min(1, dt * 5); c.position.z += (tz - c.position.z) * Math.min(1, dt * 10);
    if (this.shake > 0) { this.shake -= dt; c.position.x += (Math.random() - 0.5) * this.shake * 0.5; c.position.y += (Math.random() - 0.5) * this.shake * 0.4; }
    c.lookAt(this.laneX * 0.35, 1.0, this.z - 12);
  }
  status() {
    const S = this.stage; const prog = Math.min(1, Math.max(0, -this.z / S.length));
    const B = this.boss && !this.boss.dead ? { name: this.boss.def.name, frac: this.boss.hp / this.boss.def.hp } : null;
    return { troops: this.troops, weapon: this.weapon.name, prog, coins: this.coins, boss: B, msg: this.msg, shield: this.shieldT > 0 };
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); }
}
function pick(w, R) { let r = R() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; } return 'plus'; }
