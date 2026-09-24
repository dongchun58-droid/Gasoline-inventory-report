// admin.js — 관리자(치트) 콘솔
// 열기: 1 키(또는 F9 · ` ) · 키보드로 "admin" 입력 · 코인 표시를 5번 연속 탭(휴대폰)
// 콘솔에서는 window.admin 으로 전부 호출할 수 있다. admin.help() 로 목록 확인.
import * as THREE from 'three';
import { buildGodzilla, animateGodzilla } from './zombies.js';
import { WEAPONS, WEAPON_ORDER, TROOP_CAP, STAGES, CHARACTERS, CHARACTER_ORDER } from './stages.js';
import { save } from './save.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const FLY_H = 7.5;              // 비행 고도(m)
const BURN_R = 34;              // 고질라 브레스 반경(m)
const TRILLION = 1e12;          // 1조

export class Admin {
  constructor(ctx) {
    this.ctx = ctx;                   // { state, scene, camera, fx, audio, hud, input, launch }
    this.timeScale = 1;
    this.flying = false; this.godMode = false; this.godTroops = 0;
    this.meteorOn = false; this.lightningOn = false; this.freezeOn = false; this.paperOn = false;
    this.holeOn = false; this.magnetOn = false; this.scale = 1;
    this.meteors = []; this._metAcc = 0; this._ltAcc = 0;
    this.torOn = false; this.betrayOn = false; this.chainOn = false; this.rainbowOn = false;
    this.autoOn = false; this.slowOn = false; this.zoomStep = 0;
    this.nukes = []; this.tor = null; this.pets = [];
    this._btAcc = 0; this._dying = new WeakSet(); this._hue = 0; this._tracer0 = null;
    this.lavaOn = false; this.eyesOn = false; this.discoOn = false; this.fearOn = false;
    this.goldOn = false; this.reaperOn = false; this.flameOn = false; this.cloneOn = false;
    this.antiOn = false; this.zSize = 1;
    this.ufo = null; this.train = null; this._sky0 = null; this._lastKills = 0; this._cloneAcc = 0;
    this.blast = null;                // 💨 방귀 발사 연출
    this.godz = null;                 // 보너스 스테이지 밖에서 쓰는 관리자 전용 고질라
    this.open = false;
    this._seq = '';
    for (const k of Object.keys(CHAOS)) this[k] = () => this._preset(k);   // admin.hell() 처럼 이름으로 부른다
    this._build(); this._hotkeys();
  }
  get run() { return this.ctx.state.run; }
  _toast(text, color = '#7dffb0') {
    const r = this.run; if (r) r.msg = { text, color, t: 1.8 };
    this._flash(text);
  }

  // ────────────────────────────────── 치트 명령
  /** 화면 위의 좀비·보스·거인을 전부 즉사시킨다. */
  killAll() {
    const r = this.run; if (!r) return 0;
    let n = 0;
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      r.fx.ichor(_a.set(zb.x, 0.6, zb.z), 4); r._kill(zb); n++;
    }
    if (r.boss && !r.boss.dead && r._bossDie) { r._bossDie(); n++; }
    const G = r.giant;
    if (G && !G.dead) { G.dead = true; G.deadT = 0; r.coins += 60;
      r.fx.ichor(_a.set(G.x, 2.0, G.z), 50); r.fx.ash(_a.set(G.x, 1.6, G.z), 70); n++; }
    r.shake = Math.max(r.shake, 0.9);
    r.fx.spark(_a.set(r.x, 2.0, (r.z || 0) - 14), 120, 0xff5a3c);
    this._toast(`몰살 — ${n}기 제거`, '#ff9a70');
    return n;
  }
  /** killAll 의 별칭. */
  nuke() { return this.killAll(); }

  /** 고질라로 영구 변신(다시 부르면 해제). */
  godzilla() {
    const r = this.run; if (!r) return;
    if (r.godz || this.godz) return this.human();
    if (r._transform) { r._transform(); return; }          // 보너스 스테이지는 내장 변신을 그대로 쓴다
    const mesh = buildGodzilla(1.0); mesh.rotation.y = Math.PI; r.group.add(mesh);
    this.godz = { mesh, run: r, roar: 1.2 };
    r.squad.group.visible = false;
    r.shake = 1.0; r.fx.spark(_a.set(r.x, 3.0, r.z || 0), 90, 0x8affd0);
    this.ctx.audio.roar && this.ctx.audio.roar();
    this._toast('GODZILLA 변신 — 영원히', '#8affd0');
  }
  /** 고질라 해제. */
  human() {
    const r = this.run;
    if (r && r.godz) { r.group.remove(r.godz.mesh); r.godz = null; r.squad.group.visible = true; r.troops = Math.max(1, r.troops); }
    if (this.godz) { this.godz.run.group.remove(this.godz.mesh); this.godz.run.squad.group.visible = true; this.godz = null; }
    this._toast('인간으로 복귀', '#8fd6ff');
  }

  /** 공중 부양 + 무적(다시 부르면 착지). */
  fly(on) {
    const r = this.run; if (!r) return;
    this.flying = on === undefined ? !this.flying : !!on;
    this._body(r);
    if (!this.flying && !this.godMode) r.shieldT = 0;
    this._toast(this.flying ? '비행 ON — 좀비가 닿지 않는다' : '비행 OFF', '#9fd0ff');
  }
  /** 무적(병력이 절대 줄지 않는다). */
  god(on) {
    const r = this.run;
    this.godMode = on === undefined ? !this.godMode : !!on;
    if (r) { this.godTroops = r.troops; if (!this.godMode && !this.flying) r.shieldT = 0; }
    this._toast(this.godMode ? '무적 ON' : '무적 OFF', '#ffd23f');
  }

  /** 병력을 최대치(또는 n명)로. */
  army(n) {
    const r = this.run; if (!r) return;
    const cap = r.cap || TROOP_CAP;
    r.troops = Math.max(1, Math.min(cap, Math.round(n || cap)));
    r.peak = Math.max(r.peak || 0, r.troops); this.godTroops = r.troops;
    this._toast(`병력 ${r.troops}`, '#8fd6ff');
  }
  /** 무기를 최고 티어(또는 n번 티어)로. */
  gun(n) {
    const r = this.run; if (!r) return;
    const max = (r.stage.wpnMax != null ? r.stage.wpnMax : WEAPON_ORDER.length - 1);
    r.weaponIdx = Math.max(0, Math.min(WEAPON_ORDER.length - 1, n == null ? Math.max(max, WEAPON_ORDER.length - 1) : n));
    this._toast(`무기 ${r.weapon.name}`, '#ffe9a0');
  }
  /** 처치 수를 1조(또는 n)로 만든다 — 표시 전용이라 스테이지가 끝나지 않는다. */
  kills(n) {
    const r = this.run; if (!r) return;
    const target = n == null ? TRILLION : n;
    r.bonusKills = Math.max(0, target - r.kills);
    this._toast(`처치 ${fmt(target)}`, '#ff9a70');
  }
  /** 1조 킬. */
  trillion() { this.kills(TRILLION); }
  /** 코인 지급. */
  coins(n = 9999) { const r = this.run; if (r) { r.coins += n; this._toast(`코인 +${n}`, '#ffd23f'); } }
  /** 보너스 스테이지 배수를 n단계 올린다. */
  tier(n = 3) {
    const r = this.run; if (!r || r.tier == null || !r._breakNumber) return this._toast('보너스 스테이지 전용', '#ff8a70');
    for (let i = 0; i < n; i++) {
      if (!r.numberBlock) r._spawnNumber();     // 재생성 대기 중이면 먼저 세운다
      r._breakNumber();
    }
  }
  /** 보너스 스테이지: 내려오는 황금 석상을 전부 격파해 보상을 받는다. */
  smashStatues() {
    const r = this.run; if (!r || !r._smashStatue) return this._toast('보너스 스테이지 전용', '#ff8a70');
    let n = 0;
    for (let i = r.statues.length - 1; i >= 0; i--) { r._smashStatue(r.statues[i], i); n++; }
    if (!n) this._toast('부술 석상이 없다', '#9fb8cf');
    return n;
  }
  /** 게임 속도(0.25 ~ 4). */
  speed(x) {
    this.timeScale = x == null ? (this.timeScale >= 4 ? 0.5 : this.timeScale * 2) : Math.max(0.25, Math.min(4, x));
    this._toast(`속도 ×${this.timeScale}`, '#c9a8ff');
  }
  /** 잠금 무시하고 아무 스테이지나 시작. */
  stage(n) { if (STAGES.some((s) => s.n === n && s.playable)) this.ctx.launch(n, this.ctx.state.character); }
  /** 모든 스테이지 해금 + 코인 지급(저장됨). */
  unlockAll() {
    const d = this.ctx.state.data;
    d.unlocked = Math.max(d.unlocked, STAGES.filter((s) => s.playable).length + 1);
    d.coins += 99999; save(d);
    this._toast('전 스테이지 해금', '#7dffb0');
  }
  /** 현재 스테이지 즉시 클리어. */
  win() { const r = this.run; if (r) r.done = 'clear'; }
  /** 모든 치트 해제. */
  reset() {
    const r = this.run;
    this.timeScale = 1; this.godMode = false;
    this.meteorOn = this.lightningOn = this.paperOn = this.holeOn = this.magnetOn = false;
    this.betrayOn = this.chainOn = this.torOn = false;
    this.eyesOn = this.goldOn = this.reaperOn = this.flameOn = this.cloneOn = false;
    if (this.lavaOn || this.discoOn) { this.lavaOn = this.discoOn = false; this._sky(null); }
    if (this.antiOn) this.antigravity(false);
    if (this.fearOn) this.fear(false);
    if (this.zSize !== 1) this.zombieSize(1);
    if (this.ufo) this.ufoBeam(false);
    if (this.train) this.trainRun(false);
    this._wantUfo = this._wantTrain = this._wantPets = false;
    this.meteors.length = 0; this.nukes.length = 0; this.tor = null; this.scale = 1; this.zoomStep = 0;
    if (this.pets.length) this.godzillaArmy(false);
    if (this.rainbowOn) this.rainbow(false);
    if (this.autoOn) this.auto(false);
    if (this.slowOn) this.slowmo(false);
    if (this.freezeOn) this.freeze(false);
    if (this.flying) this.fly(false);
    if (r && (r.godz || this.godz)) this.human();
    if (this.blast) { this.blast = null; if (r) { r.squad.group.scale.setScalar(1); r.squad.group.position.set(0, 0, 0); r.camLookY = 0; } }
    if (r) { r.bonusKills = 0; r.shieldT = 0; this._body(r); }
    this._toast('치트 해제', '#9fb8cf');
  }
  help() {
    const rows = [
      ['admin.fart()', '방귀로 날아올라 우주 정거장으로'],
      ['admin.killAll()', '화면의 좀비·보스·거인 몰살'],
      ['admin.godzilla()', '영구 고질라 변신 / 해제'],
      ['admin.fly()', '공중 부양 + 무적 토글'],
      ['admin.god()', '무적(병력 감소 없음) 토글'],
      ['admin.army(n)', '병력 = n (기본: 최대)'],
      ['admin.gun(n)', '무기 티어 = n (기본: 최강)'],
      ['admin.kills(n)', '처치 수 표시 = n (기본: 1조)'],
      ['admin.trillion()', '1조 킬'],
      ['admin.coins(n)', '코인 지급'],
      ['admin.tier(n)', '보너스 배수 n단계 상승'],
      ['admin.smashStatues()', '보너스 황금 석상 전부 격파'],
      ['admin.meteor()', '메테오 폭격'],
      ['admin.lightning()', '연쇄 번개'],
      ['admin.freeze()', '좌비 시간 정지'],
      ['admin.paper()', '종이 좌비(한 방에 사망)'],
      ['admin.blackhole()', '블랙홈로 빨아들이기'],
      ['admin.magnet()', '카드 자동 획득'],
      ['admin.horde(n)', '상한 무시 병력(기본 999)'],
      ['admin.giant(x)', '병사 거대화(기본 3배)'],
      ['admin.cards(n)', '카드 n장 즐생성'],
      ['admin.boss()', '보스/거인 소환'],
      ['admin.hero(key)', '대장 교체(부대 전체)'],
      ['admin.nuke()', '핵폭탄 충격파'],
      ['admin.tornado()', '도로를 거슬러 올라가는 토네이도'],
      ['admin.betray()', '좌비끼리 서로 잡아먹기'],
      ['admin.chain()', '자폭 좌비(연쇄 폭발)'],
      ['admin.rainbow()', '무지개 총알'],
      ['admin.godzillaArmy()', '작은 고질라 4마리 소환'],
      ['admin.auto()', '오토 플레이(알아서 싸운다)'],
      ['admin.slowmo()', '좌비만 ¼ 속도'],
      ['admin.zoom(n)', '카메라 줄어보기 3단계'],
      ['admin.lava()', '바닥이 용암가 된다'],
      ['admin.push()', '좌비를 저미리로 날려버리기'],
      ['admin.laserEyes()', '레이저 눈으로 즐살'],
      ['admin.disco()', '디스코 — 하늘이 번쩌이고 좌비가 돌아간다'],
      ['admin.ufoBeam()', 'UFO 소환'],
      ['admin.trainRun()', '폭주 기차'],
      ['admin.antigravity()', '좌비가 떠올라 터진다'],
      ['admin.zombieSize()', '좌비 크기 — 개미/거대'],
      ['admin.fear()', '좌비가 도망간다'],
      ['admin.gold()', '처치당 코인 100'],
      ['admin.reaper()', '나타나면 족족 사망'],
      ['admin.flame()', '화염방사기'],
      ['admin.clone()', '1초마다 병력 2배'],
      ['admin.roulette()', '무작위 치트 하나'],
      ['admin.flood(n)', '좀비 n마리 즉시 투입'],
      ['admin.chaos()', '전부 켜기'],
      ['admin.hell()', '카오스 · 지옥(용암/화염/메테오)'],
      ['admin.space()', '카오스 · 우주(UFO/반중력/비행)'],
      ['admin.kaiju()', '카오스 · 괴수 대전(고질라 군단/기차)'],
      ['admin.party()', '카오스 · 파티(디스코/무지개/골드)'],
      ['admin.doom()', '카오스 · 종말(메테오/번개/토네이도/핵)'],
      ['admin.afk()', '카오스 · 놀면서 이기기(오토+사신)'],
      ['admin.swarm()', '카오스 · 좀비 600마리'],
      ['admin.mayhem()', '카오스 · 무작위 6개'],
      ['admin.ultra()', '카오스 · 전부 + 대홍수'],
      ['admin.speed(x)', '게임 속도 (기본: 2배씩 순환)'],
      ['admin.stage(n)', '잠금 무시하고 n스테이지 시작'],
      ['admin.unlockAll()', '전 스테이지 해금(저장)'],
      ['admin.win()', '즉시 클리어'],
      ['admin.reset()', '모든 치트 해제'],
      ['admin.panel()', '화면 패널 열기/닫기'],
    ];
    console.log('%cZOMBIE SURGE · ADMIN', 'font:700 16px sans-serif;color:#ffd23f');
    rows.forEach(([a, b]) => console.log('%c' + a.padEnd(20) + '%c' + b, 'color:#8affd0', 'color:#cfe8ff'));
    return rows.length + ' commands';
  }


  // ────────────────────────────────── 미친 기술들
  /** ☄️ 메테오 폭격 — 하늘에서 불덩어리가 쌓이고 반경 8m 가 날아간다. */
  meteor(on) { this.meteorOn = on === undefined ? !this.meteorOn : !!on;
    if (!this.meteorOn) this.meteors.length = 0;
    this._toast(this.meteorOn ? '메테오 폭격 ON' : '메테오 OFF', '#ff8a3c'); }
  /** ⚡ 연쇄 번개 — 좌비가 차례로 번개에 맞고 주변까지 같이 터진다. */
  lightning(on) { this.lightningOn = on === undefined ? !this.lightningOn : !!on;
    this._toast(this.lightningOn ? '연쇄 번개 ON' : '번개 OFF', '#9fe8ff'); }
  /** 🧊 시간 정지 — 모든 좌비가 그 자리에 얼어붙는다. */
  freeze(on) {
    const was = this.freezeOn;
    this.freezeOn = on === undefined ? !this.freezeOn : !!on;
    const r = this.run;
    if (was && !this.freezeOn && r) for (const z of r.zombies.list) if (z._spd !== undefined) { z.speed = z._spd; delete z._spd; }
    this._toast(this.freezeOn ? '시간 정지 ON' : '시간 정지 OFF', '#a8e6ff');
  }
  /** 📄 종이 좌비 — 체력이 1이 돼서 스치면 바로 죽는다. */
  paper(on) { this.paperOn = on === undefined ? !this.paperOn : !!on;
    this._toast(this.paperOn ? '종이 좌비 ON — 한 발이면 끝' : '종이 좌비 OFF', '#ffe9a0'); }
  /** 🕳 블랙홈 — 좌비를 빨아들여 갈아버린다. */
  blackhole(on) { this.holeOn = on === undefined ? !this.holeOn : !!on;
    this._toast(this.holeOn ? '블랙홈 ON' : '블랙홈 OFF', '#c9a8ff'); }
  /** 🧲 자석 — 카드가 전부 내 쪽으로 끌려온다. */
  magnet(on) { this.magnetOn = on === undefined ? !this.magnetOn : !!on;
    this._toast(this.magnetOn ? '카드 자석 ON' : '자석 OFF', '#8fd6ff'); }
  /** 👑 무한 병력 — 상한을 무시하고 n명(기본 999). */
  horde(n = 999) {
    const r = this.run; if (!r) return;
    r.troops = Math.round(n); r.peak = Math.max(r.peak || 0, r.troops); this.godTroops = r.troops;
    this._toast(`병력 ${r.troops}명`, '#ffd23f');
  }
  /** 🐘 거대화 — 병사가 x배로 커진다(기본 3배, 다시 부르면 원래대로). */
  giant(x) {
    this.scale = x == null ? (this.scale > 1 ? 1 : 3) : Math.max(0.4, Math.min(6, x));
    this._toast(this.scale > 1 ? `거대화 ×${this.scale}` : '크기 원래대로', '#9fffd0');
  }
  /** 🎁 카드 비 — 보급 카드를 n장 한꺼번에 떨구어 둔다. */
  cards(n = 8) {
    const r = this.run; if (!r || !r._spawnCard || !r.gates) return this._toast('이 스테이지엔 카드가 없다', '#ff8a70');
    for (let i = 0; i < n; i++) {
      const g = r.gates[i % r.gates.length];
      if (g) { g.open = true; g.hp = 0; }
      r._spawnCard(g && g.z !== undefined ? g : (g ? g.x : 0));   // 필드는 관문 객체, 도로는 x 좌표
    }
    this._toast(`카드 ${n}장`, '#c9a8ff');
  }
  /** 👹 보스 소환 — 이 스테이지의 가장 강한 놀이를 지금 불러낸다. */
  boss() {
    const r = this.run; if (!r) return;
    if (r._spawnGiant) { r._spawnGiant(); return this._toast('거인 소환', '#ff8a70'); }
    if (!r._spawnBoss || !r.F || !r.F.bosses) return this._toast('보스가 없는 스테이지', '#ff8a70');
    if (r.boss && !r.boss.dead) return this._toast('이미 보스가 나와 있다', '#ff8a70');
    r._spawnBoss(r.F.bosses[r.F.bosses.length - 1]);
  }
  /** 🥷 대장 교체 — 부대 전체가 그 캐릭터로 바뀜다. */
  hero(key) {
    const r = this.run; if (!r) return;
    const i = CHARACTER_ORDER.indexOf(key);
    const next = i >= 0 ? key : CHARACTER_ORDER[(CHARACTER_ORDER.indexOf(r.squad.charKey) + 1) % CHARACTER_ORDER.length];
    r.squad.setCharacter(next); r.C = CHARACTERS[next];
    this._toast(CHARACTERS[next].name, '#ffd23f');
  }
  /** 🎪 카오스 — 있는 건 전부 켜버린다. */
  chaos() {
    this.horde(); this.gun(); this.god(true); this.fly(true);
    this.meteor(true); this.lightning(true); this.paper(true); this.magnet(true); this.giant(3);
    this.tornado(true); this.chain(true); this.rainbow(true); this.godzillaArmy(true); this.zoom(1);
    this.lava(true); this.laserEyes(true); this.flame(true); this.gold(true);
    this.ufoBeam(true); this.trainRun(true); this.nuke();
    this._toast('카오스!!!', '#ff5a9a');
  }


  // ────────────────────────────────── 더 미친 것들
  /** ☢️ 핵폭탄 — 하얀 섬광과 함께 충격파 고리가 퍼져나간다. */
  nuke() {
    const r = this.run; if (!r) return;
    this.nukes.push({ x: r.x, z: (r.z || 0) - 26, rad: 1 });
    r.shake = Math.max(r.shake, 1.6);
    r.fx.flash(_c.set(r.x, 6, (r.z || 0) - 26), 26, 0xffffff);
    this.ctx.audio.roar && this.ctx.audio.roar();
    this._toast('핵폭탄!!!', '#ffd23f');
  }
  /** 🌪 토네이도 — 회오리가 도로를 거슬러 올라가며 좌비를 젯이둔다. */
  tornado(on) {
    this.torOn = on === undefined ? !this.torOn : !!on;
    const r = this.run;
    this.tor = this.torOn && r ? { x: r.x, z: (r.z || 0) - 10 } : null;
    this._toast(this.torOn ? '토네이도 ON' : '토네이도 OFF', '#a8d8ff');
  }
  /** 🧟 좌비 배신 — 좌비끼리 서로 잡아먹는다. */
  betray(on) { this.betrayOn = on === undefined ? !this.betrayOn : !!on;
    this._toast(this.betrayOn ? '좌비 배신 ON — 서로 싸운다' : '배신 OFF', '#ff7ab0'); }
  /** 🧨 자폭 좌비 — 죽을 때마다 터져서 옆에 있는 놀이까지 연쇄로 터진다. */
  chain(on) { this.chainOn = on === undefined ? !this.chainOn : !!on;
    this._toast(this.chainOn ? '자폭 좌비 ON' : '자폭 OFF', '#ff9a50'); }
  /** 🌈 무지개 총알 — 총알 색이 계속 변한다. */
  rainbow(on) {
    const was = this.rainbowOn;
    this.rainbowOn = on === undefined ? !this.rainbowOn : !!on;
    if (this.rainbowOn && !this._tracer0) {
      this._tracer0 = {}; for (const k of WEAPON_ORDER) this._tracer0[k] = WEAPONS[k].tracer;
    }
    if (was && !this.rainbowOn && this._tracer0) {
      for (const k of WEAPON_ORDER) WEAPONS[k].tracer = this._tracer0[k];
    }
    this._toast(this.rainbowOn ? '무지개 ON' : '무지개 OFF', '#ff7ab0');
  }
  /** 🐉 고질라 군단 — 작은 고질라 4마리가 양옆에서 같이 태운다. */
  godzillaArmy(on) {
    const r = this.run; if (!r) return;
    const want = on === undefined ? !this.pets.length : !!on;
    for (const q of this.pets) r.group.remove(q.mesh);
    this.pets.length = 0;
    if (want) {
      for (const off of [-13, -6.5, 6.5, 13]) {
        const mesh = buildGodzilla(0.62); mesh.rotation.y = Math.PI; r.group.add(mesh);
        this.pets.push({ mesh, off, run: r });
      }
      this.ctx.audio.roar && this.ctx.audio.roar();
    }
    this._wantPets = want;
    this._toast(want ? '고질라 군단 소집!' : '고질라 군단 해산', '#8affd0');
  }
  /** 🤖 오토 플레이 — 좌비가 제일 많은 곳으로 알아서 움직이며 쓴다. */
  auto(on) {
    if (!this.ctx.input) return this._toast('오토 플레이를 쓸 수 없다', '#ff8a70');
    this.autoOn = on === undefined ? !this.autoOn : !!on;
    if (!this.autoOn) { const I = this.ctx.input; I.steer = null; I.fire = false; }
    this._toast(this.autoOn ? '오토 플레이 ON' : '오토 플레이 OFF', '#9fffd0');
  }
  /** 🐢 슈퍼 슬로우 — 좌비만 ¼ 속도로 기어간다. */
  slowmo(on) {
    const was = this.slowOn;
    this.slowOn = on === undefined ? !this.slowOn : !!on;
    if (this.slowOn && this.freezeOn) this.freeze(false);
    const r = this.run;
    if (was && !this.slowOn && r) for (const z of r.zombies.list) if (z._spd !== undefined) { z.speed = z._spd; delete z._spd; }
    this._toast(this.slowOn ? '슈퍼 슬로우 ON' : '슬로우 OFF', '#a8e6ff');
  }
  /** 🔭 줄어보기 — 카메라가 훌씩 물러난다(누를 때마다 단계). */
  zoom(step) {
    this.zoomStep = step == null ? (this.zoomStep + 1) % 3 : Math.max(0, Math.min(2, step));
    this._toast(['카메라 기본', '카메라 멀리', '카메라 아주 멀리'][this.zoomStep], '#9fd0ff');
  }


  // ────────────────────────────────── 진짜 미친 것들
  /** 🌋 용암 바닥 — 바닥이 끈어오르고 서 있는 것은 다 타 죽는다. */
  lava(on) {
    this.lavaOn = on === undefined ? !this.lavaOn : !!on;
    this._sky(this.lavaOn ? 0x481008 : null);
    this._toast(this.lavaOn ? '용암 바닥 ON' : '용암 OFF', '#ff6a2a');
  }
  /** 💨 충격파 — 모든 좌비를 한꺼번에 저미리로 날려버린다. */
  push() {
    const r = this.run; if (!r) return;
    const z0 = r.z || 0;
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      const dx = zb.x - r.x, dz = zb.z - z0, d = Math.hypot(dx, dz) || 1;
      zb.x += (dx / d) * 30; zb.z += (dz / d) * 45;
      zb.state = 'walk';
    }
    r.shake = Math.max(r.shake, 1.1);
    for (let k = 0; k < 24; k++) {
      const a1 = (k / 24) * Math.PI * 2, a2 = ((k + 1) / 24) * Math.PI * 2;
      r.fx.tracer(_a.set(r.x + Math.cos(a1) * 12, 0.7, z0 + Math.sin(a1) * 12),
        _b.set(r.x + Math.cos(a2) * 12, 0.7, z0 + Math.sin(a2) * 12), 0x9fe8ff, 0.8);
    }
    this._toast('충격파!', '#9fe8ff');
  }
  /** 🔴 레이저 눈 — 가까운 놀이를 차례로 녹여버린다. */
  laserEyes(on) { this.eyesOn = on === undefined ? !this.eyesOn : !!on;
    this._toast(this.eyesOn ? '레이저 눈 ON' : '레이저 눈 OFF', '#ff4a4a'); }
  /** 🕺 디스코 — 하늘이 번쩌이고 좌비가 빙빙 돌며 춤춘다. */
  disco(on) {
    this.discoOn = on === undefined ? !this.discoOn : !!on;
    if (this.discoOn) this._skyCapture();            // 직접 색을 돌리기 전에 원래 하늘을 보관
    else this._sky(this.lavaOn ? 0x481008 : null);
    this._toast(this.discoOn ? '디스코 타임!' : '디스코 OFF', '#ff7ab0');
  }
  /** 🛸 UFO — 접시 드롬이 따라다니며 광선을 쪽 쓴다. */
  ufoBeam(on) {
    const r = this.run; if (!r) return;
    const want = on === undefined ? !this.ufo : !!on;
    if (this.ufo) { r.group.remove(this.ufo.mesh); this.ufo = null; }
    if (want) { const mesh = buildSaucer(); r.group.add(mesh); this.ufo = { mesh, run: r, a: 0 }; }
    this._wantUfo = want;
    this._toast(want ? 'UFO 등장' : 'UFO 아녕', '#a8ffe0');
  }
  /** 🚂 폭주 기차 — 도로를 쉬지 않고 내달리며 깔아버린다. */
  trainRun(on) {
    const r = this.run; if (!r) return;
    const want = on === undefined ? !this.train : !!on;
    if (this.train) { r.group.remove(this.train.mesh); this.train = null; }
    if (want) { const mesh = buildTrain(); r.group.add(mesh); this.train = { mesh, run: r, x: r.x, z: (r.z || 0) - 90 }; }
    this._wantTrain = want;
    this._toast(want ? '기차 출발!' : '기차 정차', '#ffd23f');
  }
  /** 🎈 반중력 — 좌비가 둥둥 떠올라 터진다. */
  antigravity(on) {
    const was = this.antiOn;
    this.antiOn = on === undefined ? !this.antiOn : !!on;
    const r = this.run;
    if (was && !this.antiOn && r) for (const z of r.zombies.list) z.yOff = 0;
    this._toast(this.antiOn ? '반중력 ON' : '반중력 OFF', '#c9a8ff');
  }
  /** 🐜 좌비 크기 — 보통 → 개미 → 거대 순서로 바뀜다. */
  zombieSize(x) {
    this.zSize = x == null ? (this.zSize === 1 ? 0.3 : this.zSize === 0.3 ? 3 : 1) : Math.max(0.15, Math.min(6, x));
    const r = this.run;
    if (r && this.zSize === 1) for (const z of r.zombies.list) if (z._sc0 !== undefined) { z.scale = z._sc0; delete z._sc0; }
    this._toast(this.zSize === 1 ? '좌비 크기 원래대로' : this.zSize < 1 ? '개미 좌비' : '거대 좌비', '#ffe9a0');
  }
  /** 😱 공포 — 좌비가 뒤돌아 도망간다. */
  fear(on) {
    const was = this.fearOn;
    this.fearOn = on === undefined ? !this.fearOn : !!on;
    if (this.fearOn) { if (this.freezeOn) this.freeze(false); if (this.slowOn) this.slowmo(false); }
    const r = this.run;
    if (was && !this.fearOn && r) for (const z of r.zombies.list) {
      if (z._spd !== undefined) { z.speed = z._spd; delete z._spd; } z.ang = 0;
    }
    this._toast(this.fearOn ? '공포 ON — 좌비가 도망간다' : '공포 OFF', '#a8ffb0');
  }
  /** 💰 골드 러시 — 한 마리 잡을 때마다 코인 100개. */
  gold(on) { this.goldOn = on === undefined ? !this.goldOn : !!on;
    if (this.run) this._lastKills = this.run.kills;
    this._toast(this.goldOn ? '골드 러시 ON' : '골드 러시 OFF', '#ffd23f'); }
  /** ☠️ 사신 — 화면에 나타나는 족족 죽는다. */
  reaper(on) { this.reaperOn = on === undefined ? !this.reaperOn : !!on;
    this._toast(this.reaperOn ? '사신 ON — 나오면 죽는다' : '사신 OFF', '#ff5a7a'); }
  /** 🔥 화염방사기 — 앞으로 부채꼴 불길을 내뿜둔다. */
  flame(on) { this.flameOn = on === undefined ? !this.flameOn : !!on;
    this._toast(this.flameOn ? '화염방사기 ON' : '화염방사기 OFF', '#ff8a3c'); }
  /** 🧬 복제 — 1초마다 병력이 두 배가 된다. */
  clone(on) { this.cloneOn = on === undefined ? !this.cloneOn : !!on; this._cloneAcc = 0;
    this._toast(this.cloneOn ? '복제 ON — 1초마다 2배' : '복제 OFF', '#8fd6ff'); }
  /** 🎰 룰렛 — 무작위 치트 하나를 마음대로 켜버린다. */
  roulette() {
    const pool = ['meteor', 'lightning', 'blackhole', 'tornado', 'betray', 'chain', 'lava', 'disco',
      'laserEyes', 'antigravity', 'fear', 'flame', 'ufoBeam', 'trainRun', 'godzillaArmy', 'rainbow'];
    const k = pool[Math.floor(Math.random() * pool.length)];
    this[k](true);
    this._toast('룰렛 → ' + k, '#ff7ab0');
    return k;
  }


  /** 🌊 좀비 대홍수 — n마리를 단번에 쏟아부어 화면을 꽉 채운다. */
  flood(n = 400) {
    const r = this.run; if (!r) return 0;
    const z0 = r.z || 0, field = !!r.stage.field;
    const hp = r.stage.bonus ? 1 : r.stage.zombie.hp * (1 + r.troops / 90);
    let made = 0;
    for (let i = 0; i < n; i++) {
      let x, z;
      if (field) { const a = Math.random() * Math.PI * 2, rr = 26 + Math.random() * 20;
        x = r.x + Math.cos(a) * rr; z = z0 + Math.sin(a) * rr; }
      else if (r.stage.bonus) { x = -7.2 + (Math.random() - 0.5) * 6.9; z = z0 - 8 - Math.random() * 64; }
      else { x = (Math.random() * 2 - 1) * 5.0; z = z0 - 8 - Math.random() * 64; }
      const type = Math.random() < 0.25 ? 'runner' : 'walker';
      if (this._spawnOne(r, x, z, type, hp)) made++;
    }
    this._toast(`좀비 ${made}마리 투입!`, '#ff8a70');
    return made;
  }
  _spawnOne(r, x, z, type, hp) {
    const zb = r._newZombie ? r._newZombie(x, z, type, hp)
      : r.zombies.spawn(x, z, type, hp, (r.stage.zombie && r.stage.zombie.speed) || 4);
    if (zb && zb.sway === undefined) {
      zb.sway = 0.3 + Math.random() * 1.2; zb.swayPh = Math.random() * 6.28; zb.swaySp = 0.5 + Math.random() * 0.8;
    }
    return zb;
  }
  // 카오스 모음: 각각 성격이 다른 한 판. 설정이 섞이지 않게 먼저 전부 끄고 시작한다.
  _preset(key) {
    const P = CHAOS[key]; if (!P) return;
    this.reset();
    P.run(this);
    this._toast(P.name, P.color || '#ff5a9a');
    return key;
  }
  /** 🎲 난장판 — 치트 6개를 무작위로 골라 한꺼번에 켠다. */
  mayhem() {
    this.reset();
    const pool = ['meteor', 'lightning', 'blackhole', 'tornado', 'betray', 'chain', 'lava', 'disco', 'laserEyes',
      'antigravity', 'fear', 'flame', 'ufoBeam', 'trainRun', 'godzillaArmy', 'rainbow', 'reaper', 'gold', 'magnet', 'clone'];
    const picked = [];
    while (picked.length < 6) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      if (!picked.includes(k)) { picked.push(k); this[k](true); }
    }
    this.god(true); this.army(); this.gun();
    this._toast('난장판! ' + picked.length + '개 동시', '#ff7ab0');
    return picked;
  }

  // 스테이지가 바뀌면 이전 판에 붙어 있던 것들을 정리하고, 켜둔 치트를 새 판에 다시 건다.
  // (특히 하늘색은 새 스테이지 테마를 기준으로 다시 저장해야 원래대로 되돌릴 수 있다)
  onStage() {
    this._sky0 = null;
    this.ufo = null; this.train = null; this.pets.length = 0; this.godz = null;
    this.meteors.length = 0; this.nukes.length = 0; this.tor = null;
    this._lastKills = 0; this._dying = new WeakSet();
    if (this.lavaOn) { this.lavaOn = false; this.lava(true); }
    if (this.discoOn) this._skyCapture();
    if (this.flying) this.fly(true);
    if (this.godMode) this.god(true);
    if (this.torOn) { this.torOn = false; this.tornado(true); }
    if (this._wantPets) this.godzillaArmy(true);
    if (this._wantUfo) this.ufoBeam(true);
    if (this._wantTrain) this.trainRun(true);
  }


  /** 💨 초강력 방귀 — 방귀를 뀌고 그 힘으로 우주까지 날아가 우주 정거장에 내린다. */
  fart() {
    const r = this.run;
    if (!r) return this._toast('전투 중에만 뀔 수 있다', '#ff8a70');
    if (this.blast) return;
    this.blast = { t: 0, phase: 'charge', y: 0, v: 0 };
    r.msg = { text: '뿌우우웅—!!!', color: '#c8e06a', t: 2.0 };
    r.shake = Math.max(r.shake, 0.8);
    this.ctx.audio.fart && this.ctx.audio.fart(1);
    this._toast('뿌우우웅—!!!', '#c8e06a');
  }
  // 방귀 → 도약 → 우주. 1단계 부풀기(0.9초) · 2단계 발사(2.2초) · 도착
  _blast(dt, r) {
    const B = this.blast; B.t += dt;
    const g = r.squad.group, z0 = r.z || 0;
    const gas = (n, y, spread, up) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * spread;
        this.ctx.fx.spark(_a.set(r.x + Math.cos(a) * d, y + Math.random() * up, z0 + Math.sin(a) * d),
          2, Math.random() < 0.5 ? 0xb6d84a : 0x7a8f3a);
      }
    };
    if (B.phase === 'charge') {                       // 부풀어 오른다
      const u = Math.min(1, B.t / 0.9);
      g.scale.set(1 + u * 0.5, 1 - u * 0.25, 1 + u * 0.5);
      g.position.set(r.x * (1 - (1 + u * 0.5)) * 0, 0, 0);
      gas(3, 0.3, 2.2 + u * 3, 1.2);
      r.shake = Math.max(r.shake, 0.2 + u * 0.5);
      const cam0 = this.ctx.camera;                     // 부풀 때는 가까이 당겨 본다
      cam0.position.set(r.x - 5 - u * 2, 4.5, z0 + 12);
      cam0.lookAt(r.x, 1.2, z0);
      if (B.t >= 0.9) {
        B.phase = 'up'; B.t = 0; B.v = 9;
        r.msg = { text: '🚀 우주로 발사!', color: '#8fd6ff', t: 2.2 };
        this.ctx.audio.blastoff && this.ctx.audio.blastoff();
        this.ctx.audio.fart && this.ctx.audio.fart(0.7);
      }
      return;
    }
    B.v += 34 * dt; B.y += B.v * dt;                  // 점점 빨리 솟아오른다
    g.scale.set(1, 1.25, 1);
    g.position.set(0, B.y, 0);
    r.flyY = B.y;
    // 발사 중엔 카메라를 직접 잡는다 — 분대를 화면 가운데 두고 땅이 멀어지게
    const cam = this.ctx.camera;
    cam.position.set(r.x - 7, 5 + B.y * 0.78, z0 + 15 + B.y * 0.10);
    cam.lookAt(r.x, B.y + 1.6, z0);
    gas(7, Math.max(0, B.y - 3), 2.6, 2.4);
    this.ctx.fx.flash(_c.set(r.x, Math.max(0.6, B.y - 1.6), z0), 5.5, 0xc8e06a);
    r.shake = Math.max(r.shake, 0.5);
    if (B.t >= 2.2) this._toSpace();
  }
  _toSpace() {
    const r = this.run;
    if (r) { r.squad.group.scale.setScalar(1); r.squad.group.position.set(0, 0, 0); r.flyY = 0; r.camY = 0; r.camLookY = 0; }
    this.blast = null;
    const d = this.ctx.state.data;                    // 우주 정거장을 영구 해금
    d.unlocked = Math.max(d.unlocked, 12); save(d);
    this.ctx.launch(12, this.ctx.state.character);
    const nr = this.run;
    if (nr) nr.msg = { text: '🌌 우주 정거장 도착! 무중력 좀비를 막아라', color: '#6affe0', t: 4.0 };
    this._toast('🌌 우주 도착!', '#6affe0');
  }

  // ────────────────────────────────── 매 프레임 유지
  update(dt) {
    const r = this.run; if (!r) return;
    if (this.blast) { this._blast(dt, r); this._syncPanel(); return; }   // 발사 중엔 이것만
    if (this.godMode) { r.shieldT = Infinity; r.troops = Math.max(r.troops, this.godTroops || 1); }
    if (this.flying) {
      r.shieldT = Infinity;
      if (this.ctx.fx && Math.random() < 0.6)                      // 발밑 제트 분사
        this.ctx.fx.spark(_a.set(r.x + (Math.random() - 0.5) * 1.6, FLY_H - 0.4, (r.z || 0) + (Math.random() - 0.5) * 1.6), 1, 0x8fd6ff);
    }
    this._body(r);
    if (this.meteorOn) this._meteors(dt, r);
    if (this.lightningOn) this._lightning(dt, r);
    if (this.freezeOn) this._freeze(r);
    if (this.paperOn) for (const z of r.zombies.list) { if (z.hp > 1) z.hp = 1; }
    if (this.holeOn) this._blackhole(dt, r);
    if (this.magnetOn) this._magnet(dt, r);
    if (this.slowOn) this._slow(r);
    if (this.betrayOn) this._betray(dt, r);
    if (this.chainOn) this._chain(r);
    if (this.rainbowOn) this._rainbow(dt);
    if (this.autoOn) this._auto(r);
    if (this.nukes.length) this._nukes(dt, r);
    if (this.torOn) this._tornado(dt, r);
    if (this.pets.length) this._pets(dt, r);
    if (this.lavaOn) this._lava(dt, r);
    if (this.eyesOn) this._eyes(dt, r);
    if (this.discoOn) this._disco(dt, r);
    if (this.fearOn) this._fear(r);
    if (this.antiOn) this._anti(dt, r);
    if (this.zSize !== 1) this._zsize(r);
    if (this.flameOn) this._flame(dt, r);
    if (this.reaperOn) this._reaper(r);
    if (this.goldOn) this._gold(r);
    if (this.cloneOn) this._clone(dt, r);
    if (this.ufo) this._ufo(dt, r);
    if (this.train) this._train(dt, r);
    if (this.godz) this._burn(dt);
    this._syncPanel();
  }
  // 분대 몸체: 비행 높이와 거대화 배율을 한 곳에서 맞춘다.
  // 병사 위치는 그룹 안에 월드 좌표로 들어 있어서, 크기를 키우면
  // 위치까지 같이 늘어난다 — 그만큼 그룹을 되돌려 제자리에 세운다.
  _body(r) {
    const s = this.scale, g = r.squad.group, y = this.flying ? FLY_H : 0;
    r.flyY = y;
    // 내가 커지면 카메라도 같이 물러난다 — 안 그러면 병사가 화면을 다 가린다
    r.camY = (this.flying ? FLY_H * 0.75 : 0) + (s - 1) * 7.5 + this.zoomStep * 17;
    if (s === 1) { g.scale.setScalar(1); g.position.set(0, y, 0); return; }
    g.scale.setScalar(s);
    g.position.set(r.x * (1 - s), y, (r.z || 0) * (1 - s));
  }
  // ☄️ 메테오: 하늘에서 떨어져 반경 8m 를 쓸어버린다
  _meteors(dt, r) {
    const z0 = r.z || 0;
    this._metAcc += dt * 6;
    while (this._metAcc >= 1) {
      this._metAcc -= 1;
      this.meteors.push({ x: r.x + (Math.random() - 0.5) * 30, z: z0 - 4 - Math.random() * 44, y: 52 });
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      const ny = m.y - 62 * dt;
      r.fx.tracer(_a.set(m.x, m.y, m.z), _b.set(m.x, Math.max(0, ny), m.z), 0xff8a3c, 0.55);
      m.y = ny;
      if (m.y > 0) continue;
      this.meteors.splice(i, 1);
      for (const zb of r.zombies.list) {
        if (zb.state === 'dying') continue;
        if (Math.hypot(zb.x - m.x, zb.z - m.z) < 8) r._kill(zb);
      }
      if (r.boss && !r.boss.dead && Math.hypot(r.boss.x - m.x, r.boss.z - m.z) < 10) {
        r.boss.hp -= 900; if (r.boss.hp <= 0 && r._bossDie) r._bossDie();
      }
      r.fx.spark(_a.set(m.x, 0.8, m.z), 46, 0xff8a3c); r.fx.ash(_a.set(m.x, 0.6, m.z), 30);
      r.fx.flash(_c.set(m.x, 1.2, m.z), 5.0, 0xffb060);
      r.shake = Math.max(r.shake, 0.55);
    }
  }
  // ⚡ 연쇄 번개: 한 마리를 때리면 주변 5m 가 같이 터진다
  _lightning(dt, r) {
    this._ltAcc += dt;
    while (this._ltAcc >= 0.09) {
      this._ltAcc -= 0.09;
      const live = r.zombies.list.filter((z) => z.state !== 'dying');
      if (!live.length) break;
      const t = live[Math.floor(Math.random() * live.length)];
      r.fx.tracer(_a.set(t.x + (Math.random() - 0.5) * 3, 36, t.z), _b.set(t.x, 0.8, t.z), 0x9fe8ff, 0.5);
      r.fx.flash(_c.set(t.x, 1.0, t.z), 2.4, 0xdffaff);
      let chain = 0;
      for (const zb of live) {
        if (chain > 6) break;
        if (Math.hypot(zb.x - t.x, zb.z - t.z) < 5) { r._kill(zb); chain++; }
      }
      r.fx.spark(_a.set(t.x, 0.8, t.z), 12, 0xbff0ff);
    }
  }
  // 🧊 시간 정지: 새로 나오는 좌비도 매 프레임 잡아둔다
  _freeze(r) {
    for (const z of r.zombies.list) {
      if (z._spd === undefined) z._spd = z.speed;
      z.speed = 0;
    }
    if (Math.random() < 0.25 && r.zombies.list.length) {
      const z = r.zombies.list[Math.floor(Math.random() * r.zombies.list.length)];
      r.fx.spark(_a.set(z.x, 1.0, z.z), 2, 0xa8e6ff);
    }
  }
  // 🕳 블랙홈: 전부 끌어당겨 사라진다
  _blackhole(dt, r) {
    const z0 = r.z || 0;
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      const dx = r.x - zb.x, dz = z0 - zb.z, d = Math.hypot(dx, dz) || 1;
      if (d < 3.6) { r._kill(zb); continue; }
      const k = Math.min(d, 34 * dt) / d;
      zb.x += dx * k; zb.z += dz * k;
    }
    const a = performance.now() * 0.006;
    for (let i = 0; i < 3; i++) {
      const ang = a + i * 2.09, rad = 5.5;
      r.fx.tracer(_a.set(r.x + Math.cos(ang) * rad, 0.6, z0 + Math.sin(ang) * rad),
        _b.set(r.x, 1.4, z0), 0xc9a8ff, 0.22);
    }
  }
  // 🧲 카드 자석
  _magnet(dt, r) {
    if (!r.cards) return;
    const z0 = r.z || 0;
    for (const c of r.cards) {
      if (c.taken) continue;
      const k = Math.min(1, dt * 3.4);
      c.x += (r.x - c.x) * k;
      c.z += ((z0 - 1.2) - c.z) * k;
      if (c.mesh) c.mesh.position.set(c.x, c.mesh.position.y, c.z);
    }
  }
  // 관리자 고질라: 분대를 따라다니며 주변을 통째로 태운다
  _burn(dt) {
    const G = this.godz, r = G.run; if (r !== this.run) { this.godz = null; return; }
    const z0 = r.z || 0;
    G.mesh.position.set(r.x, r.flyY || 0, z0 - 1.0); G.mesh.rotation.y = Math.PI;
    animateGodzilla(G.mesh, r.t, G.roar > 0); G.roar -= dt;
    if (!r.firing) return;
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      if (Math.hypot(zb.x - r.x, zb.z - z0) > BURN_R) continue;
      r._kill(zb);
    }
    if (r.boss && !r.boss.dead) { r.boss.hp -= 4000 * dt; if (r.boss.hp <= 0 && r._bossDie) r._bossDie(); }
    const src = _a.set(r.x, 4.6 + (r.flyY || 0), z0 - 1.6);
    for (let k = 0; k < 7; k++) {
      const ang = -Math.PI / 2 + (k / 6 - 0.5) * 1.1;
      r.fx.tracer(src, _b.set(r.x + Math.cos(ang) * BURN_R, 1.0, z0 + Math.sin(ang) * BURN_R), 0x6affc0, 0.26);
    }
    r.fx.flash(src, 3.0, 0x9fffd8);
  }


  // ☢️ 핵폭탄: 충격파 고리가 지나가면서 쓸어버린다
  _nukes(dt, r) {
    for (let i = this.nukes.length - 1; i >= 0; i--) {
      const n = this.nukes[i], prev = n.rad;
      n.rad += 62 * dt;
      for (const zb of r.zombies.list) {
        if (zb.state === 'dying') continue;
        const d = Math.hypot(zb.x - n.x, zb.z - n.z);
        if (d >= prev && d < n.rad) r._kill(zb);
      }
      if (r.boss && !r.boss.dead) {
        const d = Math.hypot(r.boss.x - n.x, r.boss.z - n.z);
        if (d >= prev && d < n.rad) { r.boss.hp -= 6000; if (r.boss.hp <= 0 && r._bossDie) r._bossDie(); }
      }
      for (let k = 0; k < 18; k++) {                       // 퍼지는 고리
        const a1 = (k / 18) * Math.PI * 2, a2 = ((k + 1) / 18) * Math.PI * 2;
        r.fx.tracer(_a.set(n.x + Math.cos(a1) * n.rad, 0.7, n.z + Math.sin(a1) * n.rad),
          _b.set(n.x + Math.cos(a2) * n.rad, 0.7, n.z + Math.sin(a2) * n.rad), 0xffd23f, 0.7);
      }
      if (n.rad > 95) this.nukes.splice(i, 1);
    }
  }
  // 🌪 토네이도: 도로를 거슬러 올라가며 빨아들인다
  _tornado(dt, r) {
    const z0 = r.z || 0, T = this.tor; if (!T) return;
    T.z -= 13 * dt; T.x += Math.sin(performance.now() * 0.001) * 9 * dt;
    if (T.z < z0 - 70) { T.z = z0 - 6; T.x = r.x; }
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      const dx = T.x - zb.x, dz = T.z - zb.z, d = Math.hypot(dx, dz) || 1;
      if (d > 16) continue;
      if (d < 4) { r._kill(zb); continue; }
      const k = Math.min(d, 26 * dt) / d;
      zb.x += dx * k; zb.z += dz * k;
    }
    const t = performance.now() * 0.004;
    for (let k = 0; k < 9; k++) {                          // 소용돌이 기둥
      const a = t + k * 0.7, y0 = k * 1.5, rad = 1.6 + k * 0.7;
      r.fx.tracer(_a.set(T.x + Math.cos(a) * rad, y0, T.z + Math.sin(a) * rad),
        _b.set(T.x + Math.cos(a + 0.9) * (rad + 0.7), y0 + 1.5, T.z + Math.sin(a + 0.9) * (rad + 0.7)), 0xbfe0ff, 0.34);
    }
  }
  // 🧟 배신: 가까운 둘이 서로 잡아먹는다
  _betray(dt, r) {
    this._btAcc += dt;
    while (this._btAcc >= 0.08) {
      this._btAcc -= 0.08;
      const live = r.zombies.list.filter((z) => z.state !== 'dying');
      if (live.length < 2) break;
      const a = live[Math.floor(Math.random() * live.length)];
      let victim = null, bd = 6;
      for (const z of live) { if (z === a) continue;
        const d = Math.hypot(z.x - a.x, z.z - a.z); if (d < bd) { bd = d; victim = z; } }
      if (!victim) continue;
      r._kill(victim);
      r.fx.ichor(_a.set(victim.x, 0.9, victim.z), 8);
      r.fx.tracer(_a.set(a.x, 0.9, a.z), _b.set(victim.x, 0.9, victim.z), 0xff5a7a, 0.24);
    }
  }
  // 🧨 자폭: 이번 프레임에 새로 죽은 놀이 주변을 날린다(연쇄)
  _chain(r) {
    const fresh = [];
    for (const z of r.zombies.list) {
      if (z.state !== 'dying') { if (this._dying.has(z)) this._dying.delete(z); continue; }
      if (this._dying.has(z)) continue;
      this._dying.add(z); fresh.push(z);
    }
    for (const z of fresh) {
      r.fx.spark(_a.set(z.x, 0.9, z.z), 18, 0xff9a50);
      r.fx.flash(_c.set(z.x, 1.0, z.z), 1.8, 0xffc070);
      for (const o of r.zombies.list) {
        if (o.state === 'dying') continue;
        if (Math.hypot(o.x - z.x, o.z - z.z) < 5.5) r._kill(o);
      }
    }
  }
  // 🌈 무지개: 모든 무기의 예광탄 색을 계속 돌린다
  _rainbow(dt) {
    this._hue = (this._hue + dt * 0.55) % 1;
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const c = new THREE.Color().setHSL((this._hue + i * 0.08) % 1, 1, 0.6);
      WEAPONS[WEAPON_ORDER[i]].tracer = c.getHex();
    }
  }
  // 🤖 오토 플레이: 좌비가 가장 진한 가로 위치로 붙고 계속 쓴다
  _auto(r) {
    const I = this.ctx.input; if (!I) return;
    const z0 = r.z || 0;
    let sum = 0, w = 0, near = 1e9, nx = r.x;
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      const dz = z0 - zb.z; if (dz < -6 || dz > 60) continue;
      const k = 1 / (1 + dz * 0.12);                        // 가까운 줄이 더 급하다
      sum += zb.x * k; w += k;
      if (dz < near) { near = dz; nx = zb.x; }
    }
    const tx = w > 0 ? (sum / w) * 0.45 + nx * 0.55 : r.x;
    I.steer = Math.max(-1, Math.min(1, (tx - r.x) * 0.55));
    I.fire = true;
  }
  // 🐢 슈퍼 슬로우
  _slow(r) {
    for (const z of r.zombies.list) {
      if (z._spd === undefined) z._spd = z.speed;
      z.speed = z._spd * 0.25;
    }
  }
  // 🐉 고질라 군단: 각자 자기 옆을 태운다
  _pets(dt, r) {
    const z0 = r.z || 0;
    for (const q of this.pets) {
      if (q.run !== r) { this.pets.length = 0; return; }
      const px = Math.max(-r.limit - 6, Math.min(r.limit + 6, r.x + q.off));
      q.mesh.position.set(px, r.flyY || 0, z0 - 1.0);
      animateGodzilla(q.mesh, r.t + q.off, false);
      if (!r.firing) continue;
      for (const zb of r.zombies.list) {
        if (zb.state === 'dying') continue;
        if (Math.abs(zb.x - px) > 7 || zb.z < z0 - 46 || zb.z > z0 + 2) continue;
        r._kill(zb);
      }
      if (Math.random() < 0.55)
        r.fx.tracer(_a.set(px, 3.0 + (r.flyY || 0), z0 - 1.4), _b.set(px, 1.0, z0 - 44), 0x6affc0, 0.2);
    }
  }


  // 🌋 용암 바닥
  _lava(dt, r) {
    const dmg = 120 * dt;
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      zb.hp -= dmg; if (zb.hp <= 0) r._kill(zb);
    }
    if (Math.random() < 0.5) {
      const z0 = r.z || 0;
      r.fx.spark(_a.set(r.x + (Math.random() - 0.5) * 60, 0.3, z0 - Math.random() * 60), 3, 0xff6a2a);
    }
  }
  // 🔴 레이저 눈: 가까운 순서로 한 프레임에 몇 마리씩
  _eyes(dt, r) {
    const z0 = r.z || 0, src = _a.set(r.x, 1.6 + (r.flyY || 0), z0 - 0.8);
    const live = r.zombies.list.filter((z) => z.state !== 'dying');
    live.sort((p, q) => Math.hypot(p.x - r.x, p.z - z0) - Math.hypot(q.x - r.x, q.z - z0));
    for (let i = 0; i < Math.min(3, live.length); i++) {
      const t = live[i];
      r.fx.tracer(src, _b.set(t.x, 1.0, t.z), 0xff3a3a, 0.5);
      r.fx.flash(_c.set(t.x, 1.0, t.z), 1.6, 0xff8a70);
      r._kill(t);
    }
  }
  // 🕺 디스코: 하늘이 바뀌고 좌비가 돌아간다
  _disco(dt, r) {
    this._hue = (this._hue + dt * 1.6) % 1;
    const sc = this.ctx.scene;
    if (sc && sc.background) sc.background.setHSL(this._hue, 0.85, 0.45);
    for (const z of r.zombies.list) z.ang = (z.ang || 0) + dt * 7;
    if (Math.random() < 0.7 && r.zombies.list.length) {
      const z = r.zombies.list[Math.floor(Math.random() * r.zombies.list.length)];
      r.fx.spark(_a.set(z.x, 1.4, z.z), 2, new THREE.Color().setHSL(Math.random(), 1, 0.6).getHex());
    }
  }
  // 😱 공포: 뒤돌아서 도망간다
  _fear(r) {
    for (const z of r.zombies.list) {
      if (z._spd === undefined) z._spd = z.speed;
      z.speed = -Math.abs(z._spd) * 1.4;
      z.ang = Math.PI;
    }
  }
  // 🎈 반중력: 떠오르다가 터진다
  _anti(dt, r) {
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      zb.yOff = (zb.yOff || 0) + 9 * dt;
      if (zb.yOff > 13) { r.fx.spark(_a.set(zb.x, zb.yOff, zb.z), 14, 0xc9a8ff); r._kill(zb); }
    }
  }
  // 🐜 좌비 크기
  _zsize(r) {
    for (const z of r.zombies.list) {
      if (z._sc0 === undefined) z._sc0 = z.scale;
      z.scale = z._sc0 * this.zSize;
    }
  }
  // 🔥 화염방사기: 앞쪽 부채꼴
  _flame(dt, r) {
    const z0 = r.z || 0, REACH = 44, HALF = 0.85;
    const src = _a.set(r.x, 1.2 + (r.flyY || 0), z0 - 1.0);
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      const dz = z0 - zb.z, dx = zb.x - r.x;
      if (dz < 0 || dz > REACH) continue;
      if (Math.abs(Math.atan2(dx, dz)) > HALF) continue;
      zb.hp -= 900 * dt; if (zb.hp <= 0) r._kill(zb);
    }
    for (let k = 0; k < 5; k++) {
      const a = (Math.random() - 0.5) * HALF * 2, d = 6 + Math.random() * (REACH - 6);
      r.fx.tracer(src, _b.set(r.x + Math.sin(a) * d, 0.7 + Math.random() * 1.6, z0 - Math.cos(a) * d),
        Math.random() < 0.5 ? 0xff7a2a : 0xffd23f, 0.5);
    }
    if (Math.random() < 0.6) r.fx.flash(_c.set(r.x, 1.3 + (r.flyY || 0), z0 - 1.6), 3.0, 0xff9a40);
  }
  // ☠️ 사신: 나오는 족족
  _reaper(r) {
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      r.fx.ash(_a.set(zb.x, 0.8, zb.z), 4); r._kill(zb);
    }
    if (r.boss && !r.boss.dead && r._bossDie) { r.boss.hp -= 4000; if (r.boss.hp <= 0) r._bossDie(); }
  }
  // 💰 골드 러시
  _gold(r) {
    const d = r.kills - this._lastKills;
    this._lastKills = r.kills;
    if (d > 0) {
      r.coins += d * 100;
      const z0 = r.z || 0;
      for (let i = 0; i < Math.min(d, 6); i++)
        r.fx.spark(_a.set(r.x + (Math.random() - 0.5) * 6, 1.6, z0 - 2 - Math.random() * 4), 4, 0xffd23f);
    }
  }
  // 🧬 복제
  _clone(dt, r) {
    this._cloneAcc += dt;
    while (this._cloneAcc >= 1) {
      this._cloneAcc -= 1;
      r.troops = Math.min(9999, Math.max(2, r.troops * 2));
      r.peak = Math.max(r.peak || 0, r.troops); this.godTroops = r.troops;
    }
  }
  // 🛸 UFO: 맴도는 광선으로 쓸어낸다
  _ufo(dt, r) {
    const U = this.ufo; if (U.run !== r) { this.ufo = null; return; }
    U.a += dt * 1.1;
    const z0 = r.z || 0, ux = r.x + Math.sin(U.a) * 8, uz = z0 - 15 + Math.cos(U.a * 0.7) * 6;
    U.mesh.position.set(ux, 15, uz); U.mesh.rotation.y += dt * 2.2;
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      if (Math.hypot(zb.x - ux, zb.z - uz) > 9.5) continue;
      r._kill(zb);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      r.fx.tracer(_a.set(ux, 13.6, uz), _b.set(ux + Math.cos(a) * 9.5, 0.4, uz + Math.sin(a) * 9.5), 0x7affe0, 0.5);
    }
  }
  // 🚂 폭주 기차: 지나간 자리가 평평해진다
  _train(dt, r) {
    const T = this.train; if (T.run !== r) { this.train = null; return; }
    T.z += 58 * dt;
    const z0 = r.z || 0;
    if (T.z > z0 + 26) { T.z = z0 - 96; T.x = r.x + (Math.random() - 0.5) * 10; }
    T.mesh.position.set(T.x, 0, T.z);
    for (const zb of r.zombies.list) {
      if (zb.state === 'dying') continue;
      if (Math.abs(zb.x - T.x) < 4.2 && Math.abs(zb.z - T.z) < 9) {
        r.fx.ichor(_a.set(zb.x, 1.0, zb.z), 8); r._kill(zb);
      }
    }
    if (Math.random() < 0.4) r.fx.spark(_a.set(T.x, 4.6, T.z - 6), 4, 0xdddddd);
  }
  // 하늘색 바꾸기(용암·디스코) — null 이면 원래대로
  _skyCapture() {
    const sc = this.ctx.scene;
    if (sc && sc.background && !this._sky0)
      this._sky0 = { bg: sc.background.getHex(), fog: sc.fog ? sc.fog.color.getHex() : null };
  }
  _sky(hex) {
    const sc = this.ctx.scene; if (!sc || !sc.background) return;
    this._skyCapture();
    if (hex == null) {
      sc.background.setHex(this._sky0.bg);
      if (sc.fog && this._sky0.fog != null) sc.fog.color.setHex(this._sky0.fog);
      this._sky0 = null;
    } else {
      sc.background.setHex(hex);
      if (sc.fog) sc.fog.color.setHex(hex);
    }
  }

  // ────────────────────────────────── 패널 UI
  panel(on) { this.open = on === undefined ? !this.open : !!on; this.el.style.display = this.open ? 'grid' : 'none';
    if (this.open) this._syncPanel(); }
  _build() {
    const css = document.createElement('style');
    css.textContent = `
      #adminPanel{position:fixed;left:10px;bottom:10px;z-index:70;display:none;grid-template-columns:repeat(2,minmax(0,1fr));
        gap:6px;padding:10px;width:min(300px,calc(100vw - 24px));max-height:min(64vh,440px);overflow-y:auto;
        background:#080d13ee;border:1px solid #ffd23f66;border-radius:14px;box-shadow:0 14px 40px #000b;pointer-events:auto;
        -webkit-overflow-scrolling:touch;overscroll-behavior:contain}
      #adminPanel h4{grid-column:1/-1;margin:0 0 2px;font:800 13px "Barlow Condensed",sans-serif;letter-spacing:.14em;color:#ffd23f;text-transform:uppercase}
      #adminPanel h4.sub{margin:8px 0 0;color:#7f9bb5;font-size:11.5px;border-top:1px solid #24303e;padding-top:7px}
      #adminPanel button{appearance:none;border:1px solid #2f4256;background:#16202c;color:#dbe9f5;border-radius:9px;padding:9px 6px;
        font:700 12.5px system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;line-height:1.25}
      #adminPanel button:active{filter:brightness(1.35)}
      #adminPanel button.on{background:#1d3a2c;border-color:#7dffb0;color:#9fffd0}
      #adminPanel button.wide{grid-column:1/-1}
      #adminPanel button.close{background:#2a1620;border-color:#ff8a70;color:#ffb9a8}
      #adminToast{position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:71;pointer-events:none;opacity:0;
        font:800 22px "Barlow Condensed",sans-serif;letter-spacing:.06em;color:#ffd23f;text-shadow:0 2px 14px #000;transition:opacity .25s}
    `;
    document.head.appendChild(css);
    this.el = document.createElement('div'); this.el.id = 'adminPanel';
    this.toastEl = document.createElement('div'); this.toastEl.id = 'adminToast';
    document.body.appendChild(this.el); document.body.appendChild(this.toastEl);
    this.btns = [
      { sep: '기본' },
      { label: '💀 몰살', fn: () => this.killAll() },
      { label: '🦖 고질라', fn: () => this.godzilla(), on: () => !!(this.run && this.run.godz) || !!this.godz },
      { label: '🕊 비행', fn: () => this.fly(), on: () => this.flying },
      { label: '🛡 무적', fn: () => this.god(), on: () => this.godMode },
      { label: '👥 병력 MAX', fn: () => this.army() },
      { label: '🔫 최강 무기', fn: () => this.gun() },
      { label: '💥 1조 킬', fn: () => this.trillion() },
      { label: '🪙 코인 +9999', fn: () => this.coins() },
      { label: '🔢 배수 +3', fn: () => this.tier(3) },
      { label: '🗿 석상 격파', fn: () => this.smashStatues() },
      { label: '💨 초강력 방귀 → 우주로', fn: () => this.fart(), wide: true },
      { sep: '미친 기술' },
      { label: '☄️ 메테오', fn: () => this.meteor(), on: () => this.meteorOn },
      { label: '⚡ 연쇄 번개', fn: () => this.lightning(), on: () => this.lightningOn },
      { label: '🧊 시간 정지', fn: () => this.freeze(), on: () => this.freezeOn },
      { label: '📄 종이 좌비', fn: () => this.paper(), on: () => this.paperOn },
      { label: '🕳 블랙홈', fn: () => this.blackhole(), on: () => this.holeOn },
      { label: '🧲 카드 자석', fn: () => this.magnet(), on: () => this.magnetOn },
      { label: '👑 병력 999', fn: () => this.horde() },
      { label: '🐘 거대화', fn: () => this.giant(), on: () => this.scale > 1 },
      { label: '🎁 카드 비', fn: () => this.cards(8) },
      { label: '👹 보스 소환', fn: () => this.boss() },
      { label: '🥷 대장 교체', fn: () => this.hero() },
      { label: '⏩ 속도', fn: () => this.speed(), tag: () => '×' + this.timeScale },
      { sep: '더 미친 것들' },
      { label: '☢️ 핵폭탄', fn: () => this.nuke() },
      { label: '🌪 토네이도', fn: () => this.tornado(), on: () => this.torOn },
      { label: '🧟 좌비 배신', fn: () => this.betray(), on: () => this.betrayOn },
      { label: '🧨 자폭 좌비', fn: () => this.chain(), on: () => this.chainOn },
      { label: '🌈 무지개', fn: () => this.rainbow(), on: () => this.rainbowOn },
      { label: '🐉 고질라 군단', fn: () => this.godzillaArmy(), on: () => !!this.pets.length },
      { label: '🤖 오토 플레이', fn: () => this.auto(), on: () => this.autoOn },
      { label: '🐢 슈퍼 슬로우', fn: () => this.slowmo(), on: () => this.slowOn },
      { label: '🔭 줄어보기', fn: () => this.zoom(), tag: () => ['', '·멀리', '·아주 멀리'][this.zoomStep] },
      { sep: '진짜 미친 것들' },
      { label: '🌋 용암 바닥', fn: () => this.lava(), on: () => this.lavaOn },
      { label: '💨 충격파', fn: () => this.push() },
      { label: '🔴 레이저 눈', fn: () => this.laserEyes(), on: () => this.eyesOn },
      { label: '🕺 디스코', fn: () => this.disco(), on: () => this.discoOn },
      { label: '🛸 UFO', fn: () => this.ufoBeam(), on: () => !!this.ufo },
      { label: '🚂 폭주 기차', fn: () => this.trainRun(), on: () => !!this.train },
      { label: '🎈 반중력', fn: () => this.antigravity(), on: () => this.antiOn },
      { label: '🐜 좌비 크기', fn: () => this.zombieSize(), on: () => this.zSize !== 1 },
      { label: '😱 공포', fn: () => this.fear(), on: () => this.fearOn },
      { label: '💰 골드 러시', fn: () => this.gold(), on: () => this.goldOn },
      { label: '☠️ 사신', fn: () => this.reaper(), on: () => this.reaperOn },
      { label: '🔥 화염방사기', fn: () => this.flame(), on: () => this.flameOn },
      { label: '🧬 복제', fn: () => this.clone(), on: () => this.cloneOn },
      { label: '🎰 룰렛', fn: () => this.roulette() },
      { label: '🌊 좀비 대홍수', fn: () => this.flood(400) },
      { sep: '카오스 모음' },
      { label: '🎪 카오스', fn: () => this.chaos(), wide: true },
      { label: '🌋 지옥', fn: () => this.hell() },
      { label: '🌌 우주', fn: () => this.space() },
      { label: '🦖 괴수 대전', fn: () => this.kaiju() },
      { label: '🎉 파티', fn: () => this.party() },
      { label: '☄️ 종말', fn: () => this.doom() },
      { label: '😴 놀면서 이기기', fn: () => this.afk() },
      { label: '🌊 대홍수 한 판', fn: () => this.swarm() },
      { label: '🎲 난장판', fn: () => this.mayhem() },
      { label: '💥 울트라 카오스', fn: () => this.ultra(), wide: true },
      { sep: '마무리' },
      { label: '🔓 전스테이지 해금', fn: () => this.unlockAll(), wide: true },
      { label: '🏁 즉시 클리어', fn: () => this.win() },
      { label: '♻️ 치트 해제', fn: () => this.reset() },
      { label: '✖ 닫기', fn: () => this.panel(false), wide: true, cls: 'close' },
    ];
    const h = document.createElement('h4'); h.textContent = 'Admin · 치트'; this.el.appendChild(h);
    for (const b of this.btns) {
      if (b.sep) {                                   // 구역 머리말
        const h2 = document.createElement('h4'); h2.className = 'sub'; h2.textContent = b.sep;
        this.el.appendChild(h2); continue;
      }
      const el = document.createElement('button');
      el.className = (b.wide ? 'wide ' : '') + (b.cls || '');
      el.onclick = (e) => { e.stopPropagation(); b.fn(); this._syncPanel(); };
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.el = el; this.el.appendChild(el);
    }
    this._syncPanel();
  }
  _syncPanel() {
    if (!this.el) return;
    for (const b of this.btns) {
      if (b.sep) continue;
      const txt = b.label + (b.tag ? '  ' + b.tag() : '');
      if (b.el.textContent !== txt) b.el.textContent = txt;
      if (b.on) b.el.classList.toggle('on', !!b.on());
    }
  }
  _flash(text) {
    if (!this.toastEl) return;
    this.toastEl.textContent = text; this.toastEl.style.opacity = 1;
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { this.toastEl.style.opacity = 0; }, 1100);
  }
  _hotkeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'F9' || e.code === 'Backquote') {
        e.preventDefault(); this.panel(); return;      // 1 키로 바로 열고 닫는다
      }
      if (e.key && e.key.length === 1) {                 // "admin" 을 타이핑하면 열린다
        this._seq = (this._seq + e.key.toLowerCase()).slice(-5);
        if (this._seq === 'admin') { this._seq = ''; this.panel(true); }
      }
    });
    const coin = document.getElementById('coins');       // 휴대폰: 코인 표시 5연속 탭
    if (coin) {
      coin.style.pointerEvents = 'auto';
      coin.style.touchAction = 'manipulation';
      let n = 0, t0 = 0, sawPointer = false;
      const bump = () => {
        const now = performance.now();
        n = now - t0 > 2000 ? 1 : n + 1; t0 = now;
        if (n >= 5) { n = 0; this.panel(true); }
      };
      // 기기마다 달라서 세 종류를 다 듣되, 동작하는 한 가지만 센다
      coin.addEventListener('pointerdown', (e) => { e.stopPropagation(); sawPointer = true; bump(); });
      coin.addEventListener('touchstart', () => { if (!sawPointer) bump(); }, { passive: true });
      coin.addEventListener('click', (e) => { e.stopPropagation(); if (!sawPointer) bump(); });
    }
  }
}
function fmt(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(n >= 1e13 ? 0 : 1) + '조';
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '만';
  return String(Math.round(n));
}

// ── 카오스 모음 ────────────────────────────────────────────────────────
// 하나하나가 성격이 다른 한 판. admin.hell() 처럼 이름으로도 부를 수 있다.
const CHAOS = {
  hell: { name: '🌋 지옥', color: '#ff6a2a', run: (a) => {
    a.god(true); a.army(); a.gun(); a.lava(true); a.flame(true); a.meteor(true); a.chain(true); a.zombieSize(3); a.flood(250); } },
  space: { name: '🌌 우주', color: '#a8ffe0', run: (a) => {
    a.god(true); a.army(); a.gun(); a.fly(true); a.zoom(2); a.ufoBeam(true); a.antigravity(true); a.laserEyes(true); a.disco(true); } },
  kaiju: { name: '🦖 괴수 대전', color: '#8affd0', run: (a) => {
    a.god(true); a.godzilla(); a.godzillaArmy(true); a.zombieSize(3); a.trainRun(true); a.zoom(1); a.flood(250); } },
  party: { name: '🎉 파티', color: '#ff7ab0', run: (a) => {
    a.god(true); a.horde(); a.gun(); a.disco(true); a.rainbow(true); a.gold(true); a.magnet(true); a.zombieSize(0.3); a.fear(true); } },
  doom: { name: '☄️ 종말', color: '#ffd23f', run: (a) => {
    a.god(true); a.army(); a.gun(); a.meteor(true); a.lightning(true); a.tornado(true); a.blackhole(true); a.flood(350); a.nuke(); } },
  afk: { name: '😴 놀면서 이기기', color: '#9fffd0', run: (a) => {
    a.god(true); a.auto(true); a.reaper(true); a.gold(true); a.magnet(true); a.clone(true); } },
  swarm: { name: '🌊 좀비 대홍수', color: '#ff8a70', run: (a) => {
    a.god(true); a.army(); a.gun(); a.zoom(1); a.flood(600); } },
  ultra: { name: '💥 울트라 카오스', color: '#ff5a9a', run: (a) => {
    a.chaos(); a.reaper(true); a.clone(true); a.auto(true); a.zombieSize(3); a.flood(400); } },
};

// 관리자 전용 소품 — UFO 접시와 폭주 기차
function buildSaucer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 1.6, 1.1, 18),
    new THREE.MeshStandardMaterial({ color: 0xb8c6d2, roughness: 0.3, metalness: 0.85 }));
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7affe0, emissive: 0x2a9a7a, roughness: 0.15, transparent: true, opacity: 0.8 }));
  dome.position.y = 0.5; g.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.22, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x7affe0, emissive: 0x38ffc0, roughness: 0.2 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.2; g.add(ring);
  return g;
}
function buildTrain() {
  const g = new THREE.Group();
  const hull = M2(0x8a2a2a), steel = M2(0x9aa4ae, 0.75), glass = M2(0x2a3a4a);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.2, 12), hull); body.position.y = 2.0; g.add(body);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 3.4, 12), hull);
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.0, -7.0); g.add(nose);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 3.0), glass); cab.position.set(0, 4.2, 2.4); g.add(cab);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 1.6, 10), steel); stack.position.set(0, 4.6, -4.2); g.add(stack);
  for (const sx of [-1, 1]) for (const dz of [-4, -1, 2, 5]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 12), steel);
    w.rotation.z = Math.PI / 2; w.position.set(sx * 2.0, 1.0, dz); g.add(w);
  }
  return g;
}
function M2(color, metal = 0.35) { return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: metal }); }
