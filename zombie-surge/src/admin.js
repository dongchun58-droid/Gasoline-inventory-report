// admin.js — 관리자(치트) 콘솔
// 열기: F9 또는 ` 키 · 키보드로 "admin" 입력 · 코인 표시를 5번 연속 탭(휴대폰)
// 콘솔에서는 window.admin 으로 전부 호출할 수 있다. admin.help() 로 목록 확인.
import * as THREE from 'three';
import { buildGodzilla, animateGodzilla } from './zombies.js';
import { WEAPON_ORDER, TROOP_CAP, STAGES } from './stages.js';
import { save } from './save.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const FLY_H = 7.5;              // 비행 고도(m)
const BURN_R = 34;              // 고질라 브레스 반경(m)
const TRILLION = 1e12;          // 1조

export class Admin {
  constructor(ctx) {
    this.ctx = ctx;                   // { state, camera, fx, audio, hud, launch }
    this.timeScale = 1;
    this.flying = false; this.godMode = false; this.godTroops = 0;
    this.godz = null;                 // 보너스 스테이지 밖에서 쓰는 관리자 전용 고질라
    this.open = false;
    this._seq = '';
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
    r.flyY = this.flying ? FLY_H : 0;
    r.camY = this.flying ? FLY_H * 0.75 : 0;
    r.squad.group.position.y = r.flyY;
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
    for (let i = 0; i < n; i++) r._breakNumber();
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
    if (this.flying) this.fly(false);
    if (r && (r.godz || this.godz)) this.human();
    if (r) { r.bonusKills = 0; r.shieldT = 0; }
    this._toast('치트 해제', '#9fb8cf');
  }
  help() {
    const rows = [
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

  // ────────────────────────────────── 매 프레임 유지
  update(dt) {
    const r = this.run; if (!r) return;
    if (this.godMode) { r.shieldT = Infinity; r.troops = Math.max(r.troops, this.godTroops || 1); }
    if (this.flying) {
      r.flyY = FLY_H; r.camY = FLY_H * 0.75; r.squad.group.position.y = FLY_H;
      r.shieldT = Infinity;
      if (this.ctx.fx && Math.random() < 0.6)                      // 발밑 제트 분사
        this.ctx.fx.spark(_a.set(r.x + (Math.random() - 0.5) * 1.6, FLY_H - 0.4, (r.z || 0) + (Math.random() - 0.5) * 1.6), 1, 0x8fd6ff);
    }
    if (this.godz) this._burn(dt);
    this._syncPanel();
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
      { label: '💀 몰살', fn: () => this.killAll() },
      { label: '🦖 고질라', fn: () => this.godzilla(), on: () => !!(this.run && this.run.godz) || !!this.godz },
      { label: '🕊 비행', fn: () => this.fly(), on: () => this.flying },
      { label: '🛡 무적', fn: () => this.god(), on: () => this.godMode },
      { label: '👥 병력 MAX', fn: () => this.army() },
      { label: '🔫 최강 무기', fn: () => this.gun() },
      { label: '💥 1조 킬', fn: () => this.trillion() },
      { label: '🪙 코인 +9999', fn: () => this.coins() },
      { label: '🔢 배수 +3', fn: () => this.tier(3) },
      { label: '⏩ 속도', fn: () => this.speed(), tag: () => '×' + this.timeScale },
      { label: '🔓 전스테이지 해금', fn: () => this.unlockAll(), wide: true },
      { label: '🏁 즉시 클리어', fn: () => this.win() },
      { label: '♻️ 치트 해제', fn: () => this.reset() },
      { label: '✖ 닫기', fn: () => this.panel(false), wide: true, cls: 'close' },
    ];
    const h = document.createElement('h4'); h.textContent = 'Admin · 치트'; this.el.appendChild(h);
    for (const b of this.btns) {
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
      if (e.code === 'F9' || e.code === 'Backquote') { e.preventDefault(); this.panel(); return; }
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
