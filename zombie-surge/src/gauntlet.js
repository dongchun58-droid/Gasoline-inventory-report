// gauntlet.js — 보너스 스테이지 <황금 관문>
// 3개 레인이 동시에 내려온다.
//   왼쪽  : 적 무리 + 황금 석상. 석상은 방어선에 닿기 전에 부숴야 한다.
//           부수면 무기 강화 + 더 강한 대장, 못 부수면 병력의 70%를 잃는다.
//           석상은 나올 때마다 단단해진다.
//   가운데: 숫자 블록(1 → 2 → 5 → 10 → 20 → 50). 쏴서 부수면 배수가 오르고,
//           다음 숫자는 더 단단해진다.
//   오른쪽: +병력 게이트. 값은 현재 배수와 같다(부술수록 커진다).
// 중간중간 거인이 내려온다 — 체력이 있는 건 거인뿐이고, 나올수록 강해진다.
import * as THREE from 'three';
import { ROAD_HALF, buildEnvironment, buildCard, buildNumberBlock, buildNumberGate, buildStatue, setStatueHp, spinStatue, buildLaneBarrier, buildGodzillaSign } from './env.js';
import { Squad, FORMATION_KEYS, buildGun, buildHero } from './squad.js';
import { ZombiePool, buildBoss, animateBoss, buildGodzilla, animateGodzilla } from './zombies.js';
import { WEAPONS, WEAPON_ORDER, CHARACTERS, CHARACTER_ORDER, TROOP_CAP } from './stages.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const SQ_Z = 0, SPAWN_Z = -72, LINE_Z = SQ_Z - 1.0;
const RANGE = 58, FALL = 26, FAR_MIN = 0.22;
const LANE = { left: -7.2, mid: 0, right: 7.2 };
const BARRIER_X = -3.6;                  // 좀비는 이 선을 넘어오지 못한다
const ZOMBIE_MAX_X = BARRIER_X - 0.75;
const NUM_Z = -26;                       // 가운데 숫자 관문이 고정된 자리
// 배수는 끝없이 이어진다: 1 · 2 · 5 · 10 · 20 · 50 · 100 · 200 · 500 …
function tierValue(i) { const base = [1, 2, 5][i % 3]; return base * Math.pow(10, Math.floor(i / 3)); }
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class GauntletRun {
  constructor(scene, camera, stage, character, fx, audio) {
    this.scene = scene; this.camera = camera; this.stage = stage; this.fx = fx; this.audio = audio;
    this.C = CHARACTERS[character] || CHARACTERS.cool;
    this.G = stage.gauntlet;
    this.R = rng(1337);
    this.group = new THREE.Group(); scene.add(this.group);
    this.env = buildEnvironment(stage.theme, 260); this.group.add(this.env.group);
    this.squad = new Squad(character); this.group.add(this.squad.group);
    this.zombies = new ZombiePool(); this.group.add(this.zombies.group);
    this.x = 0; this.limit = ROAD_HALF - 1.0;
    this.cap = stage.troopCap || TROOP_CAP;
    this.troops = Math.max(1, stage.startTroops + (this.C.bonus.troops || 0)); this.peak = this.troops;
    this.weaponIdx = stage.wpnStart || 0; this.shieldT = 0; this.kills = 0; this.coins = 0; this.time = 0; this.t = 0;
    this.done = null; this.msg = null; this.shake = 0; this.firing = false; this.formIdx = 0;
    this.tier = 0;                       // TIERS 인덱스
    this.statues = []; this.numberBlock = null; this.plus = []; this.giant = null;
    this.statueN = 0; this.numberN = 0; this.giantN = 0;
    this.smashed = 0; this.missed = 0; this.escaped = 0;   // 석상 격파 / 놓침 / 지나쳐 간 좀비
    this._statueT = this.G.statueEvery[0]; this._numberT = 2.0; this._plusT = 1.0;
    this._giantT = this.G.giantEvery[0]; this._spawnAcc = 0; this._trAcc = 0; this._killAcc = 0;
    this.gate = buildNumberGate(); this.gate.position.set(LANE.mid, 0, NUM_Z); this.group.add(this.gate);
    this.group.add(buildLaneBarrier(BARRIER_X, -96, 3));   // 왼쪽 좀비 채널을 막는 방책
    this.best = 0; this.wipes = 0;
    this.godz = null; this.sign = null; this._signDone = false;
    this.flyer = null; this._charIdx = CHARACTER_ORDER.indexOf(character);
    this.squad.pos.set(this.x, 0, SQ_Z); this.squad.setCount(this.troops);
    this.msg = { text: '← 황금 석상 부수기  ·  가운데 숫자 = 보급 강화  ·  +병력 →', color: '#ffd23f', t: 4.5 };
    this._tips = [[10, '가운데 숫자를 부수면 오른쪽 +병력이 커진다', '#c9a8ff'],
                  [21, '왼쪽 석상이 닿으면 병력 70%를 잃는다 — 반드시 부숴라', '#ff8a70']];
  }
  get weapon() { return WEAPONS[WEAPON_ORDER[this.weaponIdx]]; }
  get mult() { return tierValue(this.tier); }
  get prog() { return Math.min(1, this.tier / 5); }

  update(dt, input) {
    if (this.done) return;
    this.t += dt; this.time += dt;
    const speed = 15.5;
    const ax = input.steer != null ? input.steer : (input.axis || 0);
    if (ax) this.x += Math.max(-1, Math.min(1, ax)) * speed * dt;
    this.x = Math.max(-this.limit, Math.min(this.limit, this.x));
    if (input.consumeForm && input.consumeForm()) {
      this.formIdx = (this.formIdx + 1) % FORMATION_KEYS.length;
      this.squad.setFormation(FORMATION_KEYS[this.formIdx]);
      this.msg = { text: this.squad.form.name + ' — ' + this.squad.form.desc, color: '#8fd6ff', t: 1.6 };
    }
    this.firing = !!input.fire;
    this.squad.pos.set(this.x, 0, SQ_Z); this.squad.setCount(this.godz ? 0 : this.troops);
    this.squad.firing = this.firing && this.troops > 0;
    this.squad.setWeapon(this.weapon.key);
    this.squad.update(dt, this.camera);
    if (this.shieldT > 0) this.shieldT -= dt;

    this._enemies(dt);
    this._statues(dt);
    this._numbers(dt);
    this._plusGates(dt);
    this._godzilla(dt);
    this._flyer(dt);
    this._giant(dt);
    this._fire(dt);
    this.zombies.update(dt, this.t);
    this.env.update(dt);
    this._camera(dt);
    if (this._tips && this._tips.length && this.time >= this._tips[0][0]) {
      const [, text, color] = this._tips.shift(); this.msg = { text, color, t: 3.0 };
    }
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    this.best = Math.max(this.best, this.mult);
    if (this.troops <= 0 && !this.godz) this._rally();
  }

  // ── 고질라: ×200 이후 표지판이 내려온다. 먹으면 변신하고 그대로 영원히 고질라 ──
  _godzilla(dt) {
    // 변신 중
    if (this.godz) {
      const G = this.godz; G.t -= dt;
      G.mesh.position.set(this.x, 0, SQ_Z - 1.0); G.mesh.rotation.y = Math.PI;
      animateGodzilla(G.mesh, this.t, G.roar > 0);
      G.roar -= dt;
      if (isFinite(G.t) && G.t <= 0) {         // 무한(Infinity)이면 절대 풀리지 않는다
        this.group.remove(G.mesh); this.godz = null;
        this.squad.group.visible = true;
        this.troops = 1;                       // 변신이 끝나면 다시 한 명부터
        this.msg = { text: '고질라 종료 — 병력 1부터 다시', color: '#8affd0', t: 2.4 };
      }
      return;
    }
    // 표지판 등장/이동
    if (!this.sign) {
      if (!this._signDone && this.mult >= 200) {
        const mesh = buildGodzillaSign();
        const x = LANE.right;
        mesh.position.set(x, 0, SPAWN_Z); this.group.add(mesh);
        this.sign = { mesh, x, z: SPAWN_Z };
        this.msg = { text: 'GODZILLA 해금! 오른쪽에서 받아라', color: '#8affd0', t: 3.0 };
        this.audio.roar && this.audio.roar();
      }
      return;
    }
    const S = this.sign;
    S.z += this.G.plusSpeed * 0.62 * dt; S.mesh.position.z = S.z;
    S.mesh.rotation.y = Math.sin(this.t * 1.4) * 0.16;
    if (S.z >= SQ_Z - 1.0 && Math.abs(this.x - S.x) < 3.0) { this.group.remove(S.mesh); this.sign = null; this._transform(); }
    else if (S.z > SQ_Z + 9) { this.group.remove(S.mesh); this.sign = null; this._signDone = false; }
  }
  _transform() {
    this._signDone = true;
    const mesh = buildGodzilla(1.0); mesh.rotation.y = Math.PI; this.group.add(mesh);   // 도로 위쪽(-z)을 본다
    this.godz = { mesh, t: this.G.godzillaTime > 0 ? this.G.godzillaTime : Infinity, roar: 1.2 };
    this.squad.group.visible = false;
    this.troops = 1;                            // 오직 하나 — 고질라
    this.shake = 1.0;
    this.fx.spark(_a.set(this.x, 3.0, SQ_Z), 90, 0x8affd0);
    this.msg = { text: isFinite(this.godz.t) ? 'GODZILLA 변신!' : 'GODZILLA 변신! — 영원히', color: '#8affd0', t: 2.6 };
    this.audio.roar && this.audio.roar();
  }

  // 전멸해도 끝나지 않는다 — 1명으로 재편성하고 배수만 떨어진다
  _rally() {
    this.wipes = (this.wipes || 0) + 1;
    this.troops = 1;
    this.tier = Math.max(0, this.tier - 2);
    this.weaponIdx = Math.max(this.stage.wpnStart || 0, this.weaponIdx - 1);
    this.shieldT = 5;                                   // 재편성 직후 잠깐 무적
    for (const zb of this.zombies.list) if (zb.state !== 'dying') { zb.state = 'dying'; zb.dieT = 0; }
    for (let i = this.statues.length - 1; i >= 0; i--) { this.group.remove(this.statues[i].mesh); }
    this.statues.length = 0; this._statueT = this.G.statueEvery[0] * 0.6;
    if (this.giant && !this.giant.dead) { this.giant.dead = true; this.giant.deadT = 0; }
    this.shake = 0.9;
    this.fx.ash(_a.set(this.x, 1.0, SQ_Z), 60);
    this.msg = { text: '전멸! 1명으로 재편성 — ×' + this.mult + ' 로 후퇴', color: '#ff8a70', t: 2.6 };
    this.audio.fail && this.audio.fail();
  }

  // ── 왼쪽 레인: 적 무리(한 방에 쓰러진다) ────────────────────────────────
  _enemies(dt) {
    const G = this.G;
    // 압박은 시간에 따라 서서히 (배수를 올렸다고 갑자기 어려워지지 않도록)
    const ramp = Math.min(1, this.time / 150);
    const rate = G.enemyRate[0] + (G.enemyRate[1] - G.enemyRate[0]) * ramp;
    this._spawnAcc += rate * Math.min(1, 0.35 + this.time / 16) * dt;
    while (this._spawnAcc >= 1) {
      this._spawnAcc -= 1;
      // 왼쪽 레인에만, 레인을 꽉 채우듯 촘촘하게 (광고처럼 붉은 무리가 밀려온다)
      const x = Math.min(ZOMBIE_MAX_X, LANE.left + (this.R() - 0.5) * G.laneWidth);
      const zb = this.zombies.spawn(x, SPAWN_Z - this.R() * 5,
        this.R() < 0.3 ? 'runner' : 'walker', 1, G.enemySpeed);   // 체력 1 — 스치면 쓰러진다
      if (zb) { zb.sway = 0.2 + this.R() * 0.5; zb.swayPh = this.R() * 6.28; zb.swaySp = 0.5 + this.R() * 0.8; }
    }
    for (const zb of this.zombies.list) {
      if (zb.state === 'dying') continue;
      if (zb.z < LINE_Z) {
        zb.state = 'walk'; zb.z += zb.speed * dt;
        if (zb.z > -18) {                       // 가까워지면 몰려든다 — 단, 장벽은 못 넘는다
          const goal = Math.min(this.x, ZOMBIE_MAX_X);
          const dx = goal - zb.x;
          zb.x += Math.sign(dx) * Math.min(Math.abs(dx), zb.speed * 0.85 * dt);
        } else zb.x += Math.sin(this.t * zb.swaySp + zb.swayPh) * zb.sway * dt;
        zb.x = Math.max(-ROAD_HALF + 0.6, Math.min(ZOMBIE_MAX_X, zb.x));
      } else {
        // 못 잡으면 그냥 지나쳐 간다 — 피해는 없고 점수만 놓친다
        zb.state = 'walk'; zb.z += zb.speed * 1.25 * dt;
        if (zb.z > SQ_Z + 16) { zb.state = 'dying'; zb.dieT = 0.45; this.escaped++; }
      }
    }
  }
  _kill(zb) {
    zb.state = 'dying'; zb.dieT = 0; this.kills++; this.coins += 1;
    this.fx.ichor(_a.set(zb.x, 0.5, zb.z), 5); this.fx.ash(_a.set(zb.x, 0.4, zb.z), 6);
    this._killAcc++; if (this._killAcc % 3 === 0) this.audio.zdie && this.audio.zdie();
  }

  // ── 왼쪽 레인: 황금 석상 ────────────────────────────────────────────────
  _statues(dt) {
    const G = this.G;
    this._statueT -= dt;
    if (this._statueT <= 0) {
      this._statueT = G.statueEvery[0] + (G.statueEvery[1] - G.statueEvery[0]) * this.prog;
      this._spawnStatue();
    }
    for (let i = this.statues.length - 1; i >= 0; i--) {
      const s = this.statues[i];
      s.z += G.statueSpeed * dt; s.mesh.position.z = s.z;
      s.mesh.rotation.y = Math.sin(this.t * 0.6 + i) * 0.12;
      setStatueHp(s.mesh, s.hp); spinStatue(s.mesh, this.t);
      if (s.z >= LINE_Z - 0.4) {                     // 못 부수고 닿았다 → 병력 70% 손실
        this.group.remove(s.mesh); this.statues.splice(i, 1);
        this.missed++;
        const lost = Math.round(this.troops * 0.70);
        if (this.shieldT <= 0) this.troops = Math.max(1, this.troops - lost);
        this.shake = 0.9; this.audio.hit && this.audio.hit();
        this.fx.spark(_a.set(s.x, 1.2, LINE_Z), 60, 0xffd23f);
        this.fx.ash(_a.set(s.x, 1.0, LINE_Z), 50);
        this.msg = { text: '석상에 깔렸다! 병력 −' + lost, color: '#ff6a50', t: 2.2 };
      }
    }
  }
  _spawnStatue() {
    const G = this.G, n = this.statueN++;
    // 두 종류가 번갈아 내려온다
    //   · 무기 석상(황금 총) — 부수면 무기가 한 단계 올라간다
    //   · 캐릭터 석상(황금 전사) — 부수면 병력을 크게 얻는다
    const isGun = n % 2 === 0;
    let inner, charKey = null;
    if (isGun) {
      const key = WEAPON_ORDER[Math.min(WEAPON_ORDER.length - 1, this.weaponIdx + 1)];
      const g0 = buildGun(key, 9.5);                 // 받침대 위에 올린 거대한 황금 총
      g0.rotation.set(-0.12, 0.55, 0.10); g0.position.y = 2.2;
      const holder = new THREE.Group(); holder.add(g0);
      holder.userData.height = 4.2; inner = holder;
    } else {
      // 다음에 얻을 캐릭터를 황금상으로 세운다 — 부수면 분대 전원이 이 캐릭터가 된다
      charKey = CHARACTER_ORDER[(this._charIdx + 1) % CHARACTER_ORDER.length];
      const h = buildHero(charKey); h.scale.setScalar(2.05); h.rotation.y = Math.PI + 0.3; h.position.y = 0.2;
      const holder = new THREE.Group(); holder.add(h); holder.userData.height = 3.6; inner = holder;
    }
    const mesh = buildStatue(inner, 1 + Math.min(0.5, n * 0.08));
    const x = LANE.left;
    mesh.position.set(x, 0, SPAWN_Z); this.group.add(mesh);
    // 병력 상한이 있으므로 석상 체력에도 상한을 둔다 — 언젠가 반드시 못 깨는 일이 없도록
    const hp = Math.round(Math.min(G.statueHpMax, G.statueHp * Math.pow(G.statueGrow, n)));
    this.statues.push({ mesh, x, z: SPAWN_Z, hp, maxHp: hp, gun: isGun, charKey });
    this.msg = { text: isGun ? '황금 무기 석상! 부수면 무기 강화'
      : ('황금 ' + CHARACTERS[charKey].name + ' 석상! 부수면 분대 전원 변신'), color: '#ffd23f', t: 1.8 };
    this.audio.roar && this.audio.roar();
  }
  _smashStatue(s, i) {
    this.group.remove(s.mesh); this.statues.splice(i, 1);
    this.smashed++; this.coins += 40; this.shake = 0.55;
    this.fx.spark(_a.set(s.x, 2.0, s.z), 70, 0xffd23f);
    this.fx.ash(_a.set(s.x, 1.6, s.z), 40);
    const wcap = this.stage.wpnMax != null ? this.stage.wpnMax : WEAPON_ORDER.length - 1;
    if (s.gun && this.weaponIdx < wcap) {
      this.weaponIdx++; this.msg = { text: '무기 석상 격파! ▲ ' + this.weapon.name, color: '#ffd23f', t: 2.2 };
    } else if (s.charKey) {
      this._launchHero(s, s.charKey);
    } else {
      const g = Math.max(12, Math.round(this.cap * 0.35));
      this.troops = Math.min(this.cap, this.troops + g);
      this.msg = { text: '석상 격파! 병력 +' + g, color: '#ffd23f', t: 2.0 };
    }
    this.audio.bossDie && this.audio.bossDie();
  }

  // 석상에서 튀어나온 새 캐릭터가 분대로 날아온다 → 착지하면 전원 변신
  _launchHero(s, key) {
    if (this.flyer) this.group.remove(this.flyer.mesh);
    const mesh = buildHero(key); mesh.scale.setScalar(1.9);
    mesh.position.set(s.x, 2.6, s.z); this.group.add(mesh);
    this.flyer = { mesh, key, sx: s.x, sy: 2.6, sz: s.z, t: 0, dur: 0.95 };
    this.msg = { text: CHARACTERS[key].name + ' 합류!', color: '#ffd23f', t: 1.6 };
  }
  _flyer(dt) {
    const F = this.flyer; if (!F) return;
    F.t += dt;
    const u = Math.min(1, F.t / F.dur);
    const tx = this.x, tz = SQ_Z - 0.6;
    const x = F.sx + (tx - F.sx) * u, z = F.sz + (tz - F.sz) * u;
    const y = F.sy + (0.0 - F.sy) * u + Math.sin(u * Math.PI) * 7.0;      // 크게 도약
    F.mesh.position.set(x, y, z);
    F.mesh.rotation.y = Math.PI + u * Math.PI * 3;                        // 공중제비
    F.mesh.scale.setScalar(1.9 - u * 0.75);
    if (Math.random() < 0.8) this.fx.spark(_a.set(x, y + 0.6, z), 3, 0xffd23f);
    if (u >= 1) {
      this.group.remove(F.mesh); this.flyer = null;
      this._charIdx = CHARACTER_ORDER.indexOf(F.key);
      this.squad.setCharacter(F.key);
      this.C = CHARACTERS[F.key];                                          // 보너스도 함께 바뀐다
      this.shake = 0.6;
      this.fx.spark(_a.set(this.x, 1.2, SQ_Z), 70, 0xffd23f);
      this.fx.ash(_a.set(this.x, 0.8, SQ_Z), 30);
      this.msg = { text: '분대 전원 ' + CHARACTERS[F.key].name + ' 으로 변신!', color: '#ffd23f', t: 2.4 };
      this.audio.bossDie && this.audio.bossDie();
    }
  }

  // ── 가운데 레인: 고정된 숫자 관문. 움직이지 않으니 계속 쏴서 깨야 한다 ──
  _numbers(dt) {
    const b = this.numberBlock;
    if (!b) { this._numberT -= dt; if (this._numberT <= 0) this._spawnNumber(); return; }
    b.mesh.rotation.y = Math.sin(this.t * 1.1) * 0.06;
    b.mesh.position.y = Math.sin(this.t * 1.6) * 0.10;
    const f = b.hp / b.maxHp;
    const bar = b.mesh.userData.bar;
    if (bar) { bar.scale.x = Math.max(0.001, f); bar.position.x = -(1 - Math.max(0, f)) * 2.5; }
  }
  _spawnNumber() {
    const G = this.G, next = tierValue(this.tier + 1);
    const mesh = buildNumberBlock(String(next));
    mesh.position.set(LANE.mid, 0, NUM_Z); this.group.add(mesh);
    const hp = Math.round(G.numberHp * Math.pow(G.numberGrow, this.numberN++));
    this.numberBlock = { mesh, x: LANE.mid, z: NUM_Z, hp, maxHp: hp, val: next };
  }
  _breakNumber() {
    const b = this.numberBlock;
    this.group.remove(b.mesh); this.numberBlock = null;
    this.tier++;
    this.coins += 25; this.shake = 0.45;
    this.fx.spark(_a.set(b.x, 2.9, b.z), 60, 0xc98aff);
    this.fx.ash(_a.set(b.x, 2.4, b.z), 26);
    this.msg = { text: '×' + this.mult + ' 보급 강화!', color: '#c9a8ff', t: 1.8 };
    this.audio.card && this.audio.card(false);
    this._numberT = this.G.numberDelay;
  }

  // ── 오른쪽 레인: +병력 게이트 ───────────────────────────────────────────
  _plusGates(dt) {
    const G = this.G;
    this._plusT -= dt;
    if (this._plusT <= 0) { this._plusT = G.plusEvery;
      const mesh = buildCard('plus', '+' + this.mult);
      const x = LANE.right + (this.R() - 0.5) * 2.0;
      mesh.position.set(x, 0, SPAWN_Z); this.group.add(mesh);
      this.plus.push({ mesh, x, z: SPAWN_Z, val: this.mult, taken: false, tt: 0 });
    }
    for (let i = this.plus.length - 1; i >= 0; i--) {
      const p = this.plus[i];
      p.z += G.plusSpeed * dt; p.mesh.position.z = p.z;
      if (p.taken) { p.tt += dt; p.mesh.position.y += dt * 6; p.mesh.scale.multiplyScalar(1 - dt * 3.0); }
      else if (!this.godz && p.z >= SQ_Z - 1.0 && Math.abs(this.x - p.x) < 2.6) {
        p.taken = true; p.tt = 0;
        this.troops = Math.min(this.cap, this.troops + p.val);
        this.peak = Math.max(this.peak, this.troops);
        this.fx.spark(_a.set(p.x, 1.6, p.z), 18, 0xffd23f);
        this.audio.card && this.audio.card(false);
      }
      if (p.z > SQ_Z + 9 || p.tt > 0.9) { this.group.remove(p.mesh); this.plus.splice(i, 1); }
    }
  }

  // ── 거인: 체력이 있는 건 이들뿐. 나올수록 강해진다 ──────────────────────
  _giant(dt) {
    const G = this.G;
    if (!this.giant) {
      this._giantT -= dt;
      if (this._giantT <= 0) {
        this._giantT = G.giantEvery[0] + (G.giantEvery[1] - G.giantEvery[0]) * this.prog;
        this._spawnGiant();
      }
      return;
    }
    const B = this.giant;
    if (B.dead) { B.deadT += dt; B.mesh.position.y = -B.deadT * 1.5; B.mesh.rotation.z += dt * 0.6;
      B.mesh.scale.multiplyScalar(Math.max(0.02, 1 - dt * 1.2));
      if (B.deadT > 1.4) { this.group.remove(B.mesh); this.giant = null; }
      return; }
    const dx = this.x - B.x, dz = SQ_Z - B.z, d = Math.hypot(dx, dz) || 1;
    B.stompCd -= dt;
    if (d > 3.4) { B.state = 'walk'; B.x += dx / d * B.speed * dt; B.z += dz / d * B.speed * dt; }
    else { B.state = 'slam';
      if (B.stompCd <= 0) { B.stompCd = 1.6;
        if (this.shieldT <= 0) { this.troops = Math.max(0, this.troops - B.stomp); this.audio.hit && this.audio.hit(); }
        this.shake = 0.5; this.fx.spark(_a.set(B.x, 0.4, B.z), 22, 0xff9a50); } }
    B.mesh.position.set(B.x, 0, B.z);
    B.mesh.rotation.y = Math.atan2(dx, dz);
    animateBoss(B.mesh, this.t, B.state);
  }
  _spawnGiant() {
    const G = this.G, n = this.giantN++;
    const kinds = ['brute', 'butcher', 'reaper', 'warlord'];
    const arms = ['maul', 'axe', 'twin', 'cleaver', 'cannon', 'minigun'];
    const scale = 1.15 + Math.min(1.35, n * 0.16);
    const def = { kind: kinds[n % kinds.length], weapon: arms[n % arms.length],
      scale, name: '거인 ' + (n + 1) };
    const mesh = buildBoss(def); this.group.add(mesh);
    const x = [LANE.left, LANE.mid, LANE.right][n % 3];
    mesh.position.set(x, 0, SPAWN_Z + 4);
    const hp = Math.round(G.giantHp * Math.pow(G.giantGrow, n) * (1 + this.troops / 90));
    this.giant = { def, mesh, x, z: SPAWN_Z + 4, hp, hpMax: hp, state: 'walk', dead: false, deadT: 0,
      speed: 3.0 + Math.min(2.4, n * 0.18), stomp: 6 + n * 2, stompCd: 1.6 };
    this.msg = { text: def.name + ' 등장!', color: '#ff8a70', t: 2.0 };
    this.audio.roar && this.audio.roar();
  }
  // ── 사격: 도로 모드와 같은 열 단위 직사. 표적 = 적 · 석상 · 숫자 · 거인 ──
  _fire(dt) {
    if (this.godz) return this._breath(dt);
    const W = this.weapon;
    if (!this.firing || this.troops <= 0) { this.fx.hideBeam(); return; }
    const cols = this.squad.cols, colX = this.squad.colX;
    const catchW = W.arc * (this.squad.form.roadFan || 1);
    const total = this.troops * W.dps * (this.C.bonus.dps || 1) * this.squad.form.dps * dt;
    // 3개 레인을 동시에 볼 수 없으니, 방어선에 붙은 적은 방향과 무관하게 처리한다
    this._pointBlank(total * 0.40);
    const budget = total * 0.60 / cols;
    const shots = [];
    for (let c = 0; c < cols; c++) {
      const mx = this.x + colX[c];
      let left = budget, guard = 0, hitZ = SQ_Z - RANGE;
      // 큰 구조물(석상 · 숫자 블록 · 거인)은 폭이 넓어 정면이면 맞는다
      const big = [];
      for (let i = 0; i < this.statues.length; i++) big.push({ o: this.statues[i], i, half: 2.4, kind: 's' });
      if (this.numberBlock) big.push({ o: this.numberBlock, i: -1, half: 2.7, kind: 'n' });
      if (this.giant && !this.giant.dead) big.push({ o: this.giant, i: -1, half: 1.9 * (this.giant.def.scale || 1), kind: 'g' });
      while (left > 0 && guard++ < 10) {
        let tgt = null, best = -1e9, hitBig = null;
        for (const B of big) {
          if (Math.abs(B.o.x - mx) > B.half + catchW) continue;
          if (B.o.z < SQ_Z - RANGE || B.o.z > SQ_Z + 2) continue;
          if (B.o.z > best) { best = B.o.z; hitBig = B; tgt = null; }
        }
        for (const zb of this.zombies.list) {
          if (zb.state === 'dying') continue;
          const near = 1 - Math.min(1, (SQ_Z - zb.z) / 14);
          if (Math.abs(zb.x - mx) > catchW + near * 2.8) continue;
          if (zb.z < SQ_Z - RANGE || zb.z > SQ_Z + 1.5) continue;
          if (zb.z > best) { best = zb.z; tgt = zb; hitBig = null; }
        }
        if (!hitBig && !tgt) break;
        hitZ = Math.max(hitZ, best);
        const fall = Math.max(FAR_MIN, Math.min(1, 1.15 - (SQ_Z - best) / FALL));
        const obj = hitBig ? hitBig.o : tgt;
        const dmg = Math.min(left * fall, obj.hp); obj.hp -= dmg; left -= dmg / Math.max(0.001, fall);
        if (obj.hp <= 0) {
          if (!hitBig) this._kill(tgt);
          else if (hitBig.kind === 's') { this._smashStatue(hitBig.o, hitBig.i); break; }
          else if (hitBig.kind === 'n') { this._breakNumber(); break; }
          else { const B = this.giant; B.dead = true; B.deadT = 0; this.coins += 60; this.shake = 0.8;
            this.fx.ichor(_a.set(B.x, 2.0, B.z), 50); this.fx.ash(_a.set(B.x, 1.6, B.z), 70);
            this.msg = { text: B.def.name + ' 격파!', color: '#ffd23f', t: 2.0 };
            this.audio.bossDie && this.audio.bossDie(); break; }
        } else break;
      }
      shots.push([mx, hitZ]);
    }
    this.fx.hideBeam();
    if (W.beam) {
      for (let i = 0; i < shots.length; i += 2) {
        const sh = shots[i];
        this.fx.tracer(_a.set(sh[0], 0.92, SQ_Z - 0.7), _b.set(sh[0], 0.92, sh[1]), W.tracer, W.w * 0.6);
        if (Math.random() < 0.3) this.fx.flash(_c.set(sh[0], 0.92, SQ_Z - 0.9), W.flash, W.tracer);
      }
      this._trAcc += W.rate * dt;
      while (this._trAcc >= 1) { this._trAcc -= 1; this.audio.shot && this.audio.shot(W.key); }
    } else {
      this._trAcc += W.rate * dt * Math.max(1, cols * 0.55);
      let fired = 0;
      while (this._trAcc >= 1 && fired < 36) {
        this._trAcc -= 1; fired++;
        const sh = shots[Math.floor(Math.random() * cols)];
        for (let p = 0; p < W.pellets; p++) {
          const jx = (Math.random() - 0.5) * catchW * 1.7;
          this.fx.bullet(_a.set(sh[0], 0.92, SQ_Z - 0.7), _b.set(sh[0] + jx, 0.92 + (Math.random() - 0.5) * 0.3, sh[1]), W.tracer, W.w * 0.68);
        }
        if (fired <= 12) this.fx.flash(_c.set(sh[0], 0.92, SQ_Z - 0.9), W.flash, 0xffd070);
        this.audio.shot && this.audio.shot(W.key);
      }
    }
  }
  // 고질라의 원자 브레스 — 넓은 부채꼴을 통째로 태운다
  _breath(dt) {
    if (!this.firing) { this.fx.hideBeam(); return; }
    const dmg = this.G.godzillaDps * dt;
    const HALF = 9.0, REACH = 52;
    // 부채꼴 안의 모든 것을 동시에 태운다
    for (const zb of this.zombies.list) {
      if (zb.state === 'dying') continue;
      if (Math.abs(zb.x - this.x) > HALF || zb.z < SQ_Z - REACH || zb.z > SQ_Z + 2) continue;
      zb.hp -= dmg; if (zb.hp <= 0) this._kill(zb);
    }
    for (let i = this.statues.length - 1; i >= 0; i--) { const s = this.statues[i];
      if (Math.abs(s.x - this.x) > HALF + 2.5 || s.z < SQ_Z - REACH) continue;
      s.hp -= dmg; if (s.hp <= 0) this._smashStatue(s, i);
    }
    const b = this.numberBlock;
    if (b && Math.abs(b.x - this.x) < HALF + 2.5) { b.hp -= dmg; if (b.hp <= 0) this._breakNumber(); }
    const G2 = this.giant;
    if (G2 && !G2.dead && Math.abs(G2.x - this.x) < HALF + 3) { G2.hp -= dmg;
      if (G2.hp <= 0) { G2.dead = true; G2.deadT = 0; this.coins += 60; this.shake = 0.8;
        this.fx.ichor(_a.set(G2.x, 2.0, G2.z), 50); this.fx.ash(_a.set(G2.x, 1.6, G2.z), 70);
        this.msg = { text: G2.def.name + ' 격파!', color: '#ffd23f', t: 2.0 };
        this.audio.bossDie && this.audio.bossDie(); } }
    // 이펙트: 굵은 청록 광선 다발
    this.fx.hideBeam();
    const src = _a.set(this.x, 4.6, SQ_Z - 1.6);
    for (let k = 0; k < 7; k++) {
      const off = (k / 6 - 0.5) * HALF * 1.7;
      this.fx.tracer(src, _b.set(this.x + off, 1.0, SQ_Z - REACH), 0x6affc0, 0.26);
    }
    if (Math.random() < 0.8) this.fx.flash(_c.set(this.x, 4.6, SQ_Z - 2.2), 3.2, 0x8affd0);
    if (Math.random() < 0.4) this.fx.spark(_b.set(this.x + (Math.random() - 0.5) * HALF * 2, 0.6, SQ_Z - 8 - Math.random() * 30), 5, 0x8affd0);
    this._trAcc += 20 * dt;
    while (this._trAcc >= 1) { this._trAcc -= 1; this.audio.shot && this.audio.shot('plasma'); }
  }

  // 근접(9.5m) 전방위 대응 — 3개 레인을 동시에 볼 수 없으므로 넉넉하게
  _pointBlank(budget) {
    let left = budget, guard = 0;
    while (left > 0 && guard++ < 30) {
      let tgt = null, bd = 1e9;
      for (const zb of this.zombies.list) {
        if (zb.state === 'dying') continue;
        const d = Math.hypot(zb.x - this.x, zb.z - SQ_Z);
        if (d > 9.5 || d >= bd) continue; bd = d; tgt = zb;
      }
      if (!tgt) break;
      const dmg = Math.min(left, tgt.hp); tgt.hp -= dmg; left -= dmg;
      if (tgt.hp <= 0) { this._kill(tgt); this.fx.spark(_a.set(tgt.x, 0.8, tgt.z), 3, 0xffd070); } else break;
    }
  }
  _camera(dt) {
    const c = this.camera, big = Math.min(1, this.squad.shown / 80);
    const tx = this.x * 0.55, ty = 10.5 + big * 3.0, tz = SQ_Z + 13.5 + big * 4.0;
    c.position.x += (tx - c.position.x) * Math.min(1, dt * 5);
    c.position.y += (ty - c.position.y) * Math.min(1, dt * 4);
    c.position.z += (tz - c.position.z) * Math.min(1, dt * 4);
    if (this.shake > 0) { this.shake -= dt; c.position.x += (Math.random() - 0.5) * this.shake * 0.7; c.position.y += (Math.random() - 0.5) * this.shake * 0.5; }
    c.lookAt(this.x * 0.34, 0.8, SQ_Z - 20);
  }
  status() {
    const B = this.giant && !this.giant.dead ? { name: this.giant.def.name, frac: this.giant.hp / this.giant.hpMax } : null;
    const s = this.statues[0];
    return { troops: this.godz ? 1 : this.troops, cap: this.godz ? 1 : this.cap,
      formation: this.godz ? 'GODZILLA' : this.squad.form.name, weapon: this.godz ? 'ATOMIC BREATH' : this.weapon.name,
      kills: this.kills, quota: 0, tier: this.mult, prog: this.prog, coins: this.coins, boss: B,
      msg: this.msg, shield: this.shieldT > 0, remain: this.zombies.alive, firing: this.firing,
      statue: s ? { hp: Math.ceil(s.hp), frac: s.hp / s.maxHp } : null, smashed: this.smashed, missed: this.missed,
      endless: true, survived: this.time, wipes: this.wipes, best: this.best, godzMode: !!this.godz,
      escaped: this.escaped, godz: this.godz ? (isFinite(this.godz.t) ? Math.ceil(this.godz.t) : -1) : 0 };
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); }
}
