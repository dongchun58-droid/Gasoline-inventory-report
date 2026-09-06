// hud.js — DOM HUD + 메뉴(3D 초상)/결과/크레딧/튜토리얼
import { STAGES, CHARACTERS, CHARACTER_ORDER } from './stages.js';
const $ = (id) => document.getElementById(id);
export class HUD {
  constructor() {
    this.el = { stage: $('stageLbl'), prog: $('progFill'), troops: $('troopsN'), weapon: $('weapon'), coins: $('coins'),
      bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossHpFill'), msg: $('msg'), hint: $('hint'),
      menu: $('menu'), result: $('result'), credits: $('credits'), wave: $('waveLbl'), remain: $('remain'),
      fire: $('fireBtn'), tut: $('tut'), badge: $('heroBadge'), face: $('heroFace'), hname: $('heroName'), hrole: $('heroRole'),
      wpnPop: $('wpnPop') };
    this._msgT = 0; this._last = null; this._wpnT = 0; this._wpn = null;
  }
  setStage(st) { this.el.stage.textContent = `STAGE ${st.n} · ${st.name}`; }
  setHero(key, portraits) { const c = CHARACTERS[key]; if (!c) return;
    this.el.hname.textContent = c.name; this.el.hrole.textContent = c.role;
    if (portraits && portraits[key]) this.el.face.style.backgroundImage = `url(${portraits[key]})`;
    this.el.face.style.borderColor = '#' + c.trim.toString(16).padStart(6, '0'); }
  update(s) {
    this.el.troops.textContent = s.troops;
    this.el.troops.style.color = s.shield ? '#7fffe0' : (s.firing ? '#ffe9a0' : '#8fd6ff');
    this.el.weapon.textContent = s.weapon + (s.shield ? ' · SHIELD' : '');
    // 무기 교체를 화면 중앙 배너로 확실히 알림
    if (this._wpn !== null && s.weapon !== this._wpn) { this.el.wpnPop.textContent = '▲ ' + s.weapon; this.el.wpnPop.style.opacity = 1; this._wpnT = 1.6; }
    this._wpn = s.weapon;
    if (this._wpnT > 0) { this._wpnT -= 1 / 60; if (this._wpnT <= 0) this.el.wpnPop.style.opacity = 0; }
    this.el.prog.style.width = (s.prog * 100).toFixed(1) + '%';
    this.el.coins.textContent = '🪙 ' + s.coins;
    this.el.wave.textContent = `처치 ${s.kills} / ${s.quota}`;
    this.el.remain.textContent = s.remain > 0 ? `접근 중 ${s.remain}` : '';
    if (s.boss) { this.el.bossBar.style.display = 'block'; this.el.bossName.textContent = s.boss.name; this.el.bossFill.style.width = (Math.max(0, s.boss.frac) * 100) + '%'; }
    else this.el.bossBar.style.display = 'none';
    if (s.msg && s.msg !== this._last) { this._last = s.msg; this.el.msg.textContent = s.msg.text; this.el.msg.style.color = s.msg.color; this.el.msg.style.opacity = 1; this._msgT = s.msg.t; }
    if (this._msgT > 0) { this._msgT -= 1 / 60; if (this._msgT <= 0) this.el.msg.style.opacity = 0; }
  }
  showGame(v) { this.el.badge.style.display = v ? 'flex' : 'none'; this.el.fire.style.display = v ? 'block' : 'none'; this.el.wave.style.display = v ? 'block' : 'none';
    this.el.remain.style.display = v ? 'block' : 'none'; this.el.hint.style.display = v ? 'block' : 'none';
    this.el.troops.parentElement.style.display = v ? 'block' : 'none'; this.el.prog.parentElement.style.display = v ? 'block' : 'none';
    this.el.stage.style.display = v ? 'block' : 'none'; this.el.coins.style.display = v ? 'block' : 'none'; }
  showTutorial(onClose) { this.el.tut.classList.remove('hidden'); $('tutClose').onclick = () => { this.el.tut.classList.add('hidden'); onClose && onClose(); }; }
  buildMenu(save, portraits, onPlay, onCredits, onHelp) {
    const chars = $('chars'); chars.innerHTML = '';
    for (const k of CHARACTER_ORDER) {
      const c = CHARACTERS[k]; const d = document.createElement('div');
      d.className = 'chr' + (save.character === k ? ' sel' : ''); d.dataset.k = k;
      const img = portraits[k] ? `background-image:url(${portraits[k]});background-size:cover;background-position:center` : '';
      d.innerHTML = `<div class="ic" style="${img}"></div>${c.name}<small>${c.role}</small><small style="color:#7f97ad">${c.desc}</small>`;
      d.onclick = () => { save.character = k; chars.querySelectorAll('.chr').forEach((x) => x.classList.toggle('sel', x.dataset.k === k)); };
      chars.appendChild(d);
    }
    const grid = $('stages'); grid.innerHTML = ''; this.selStage = Math.min(save.unlocked, 2);
    for (const st of STAGES) {
      const d = document.createElement('div'); const locked = st.n > save.unlocked || !st.playable;
      d.className = 'st' + (locked ? ' lock' : '') + (st.n === this.selStage ? ' sel' : ''); d.dataset.n = st.n;
      const stars = save.stars[st.n] ? '★'.repeat(save.stars[st.n]) : (st.playable ? '' : '준비중');
      d.innerHTML = `<span class="disp">${st.n}</span><span class="stars">${stars}</span>`;
      if (!locked) d.onclick = () => { this.selStage = st.n; grid.querySelectorAll('.st').forEach((x) => x.classList.toggle('sel', +x.dataset.n === st.n)); };
      grid.appendChild(d);
    }
    $('playBtn').onclick = () => onPlay(this.selStage, save.character);
    $('creditsBtn').onclick = onCredits; $('creditsClose').onclick = () => this.el.credits.classList.add('hidden');
    if ($('helpBtn')) $('helpBtn').onclick = onHelp;
    this.el.menu.classList.remove('hidden'); this.showGame(false);
  }
  hideMenu() { this.el.menu.classList.add('hidden'); this.showGame(true); }
  showCredits(html) { $('creditsBody').innerHTML = html; this.el.credits.classList.remove('hidden'); }
  showResult(r, onNext, onRetry, onMenu) {
    $('resTitle').textContent = r.clear ? 'MISSION CLEAR' : 'MISSION FAILED';
    $('resTitle').style.background = r.clear ? '' : 'linear-gradient(180deg,#fff,#ff9a7a 60%,#e0503a)';
    $('resStars').textContent = r.clear ? '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '';
    $('rTroops').textContent = r.troops; $('rPeak').textContent = r.peak; $('rKills').textContent = r.kills;
    $('rTime').textContent = r.time.toFixed(0) + 's'; $('rCoins').textContent = '+' + r.coins;
    $('nextBtn').style.display = r.clear && r.hasNext ? '' : 'none';
    $('nextBtn').onclick = onNext; $('retryBtn').onclick = onRetry; $('menuBtn').onclick = onMenu;
    this.el.result.classList.remove('hidden'); this.showGame(false);
  }
  hideResult() { this.el.result.classList.add('hidden'); }
}
