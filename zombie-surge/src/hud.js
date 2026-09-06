// hud.js — DOM HUD + 메뉴/결과/크레딧 화면
import { STAGES, CHARACTERS, CHARACTER_ORDER } from './stages.js';
const $ = (id) => document.getElementById(id);
export class HUD {
  constructor() {
    this.el = { stage: $('stageLbl'), prog: $('progFill'), troops: $('troopsN'), weapon: $('weapon'), coins: $('coins'), bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossHpFill'), msg: $('msg'), hint: $('hint'), menu: $('menu'), result: $('result'), credits: $('credits') };
    this._msgT = 0; this._lastMsg = null;
  }
  setStage(st) { this.el.stage.textContent = `STAGE ${st.n} · ${st.name}`; }
  update(s) {
    this.el.troops.textContent = s.troops; this.el.troops.style.color = s.shield ? '#7fffe0' : '#8fd6ff';
    this.el.weapon.textContent = s.weapon + (s.shield ? ' · SHIELD' : ''); this.el.prog.style.width = (s.prog * 100).toFixed(1) + '%';
    this.el.coins.textContent = '🪙 ' + s.coins;
    if (s.boss) { this.el.bossBar.style.display = 'block'; this.el.bossName.textContent = s.boss.name; this.el.bossFill.style.width = (Math.max(0, s.boss.frac) * 100) + '%'; } else this.el.bossBar.style.display = 'none';
    if (s.msg && s.msg !== this._lastMsg) { this._lastMsg = s.msg; this.el.msg.textContent = s.msg.text; this.el.msg.style.color = s.msg.color; this.el.msg.style.opacity = 1; this._msgT = s.msg.t; }
    if (this._msgT > 0) { this._msgT -= 1 / 60; if (this._msgT <= 0) this.el.msg.style.opacity = 0; }
  }
  showHint(v) { this.el.hint.style.display = v ? 'block' : 'none'; }
  // ---- 메뉴 ----
  buildMenu(save, onPlay, onCredits) {
    const chars = $('chars'); chars.innerHTML = '';
    for (const k of CHARACTER_ORDER) { const c = CHARACTERS[k]; const d = document.createElement('div'); d.className = 'chr' + (save.character === k ? ' sel' : ''); d.dataset.k = k;
      d.innerHTML = `<div class="ic" style="background:radial-gradient(circle at 40% 35%, #${c.skin.toString(16).padStart(6,'0')}, #${c.cloth.toString(16).padStart(6,'0')} 70%)"></div>${c.name}<small>${c.role}</small>`;
      d.onclick = () => { save.character = k; chars.querySelectorAll('.chr').forEach((x) => x.classList.toggle('sel', x.dataset.k === k)); }; chars.appendChild(d); }
    const grid = $('stages'); grid.innerHTML = ''; this.selStage = Math.min(save.unlocked, 2);
    for (const st of STAGES) { const d = document.createElement('div'); const locked = st.n > save.unlocked || !st.playable; d.className = 'st' + (locked ? ' lock' : '') + (st.n === this.selStage ? ' sel' : ''); d.dataset.n = st.n;
      const stars = save.stars[st.n] ? '★'.repeat(save.stars[st.n]) : (st.playable ? '' : '준비중'); d.innerHTML = `<span class="disp">${st.n}</span><span class="stars">${stars}</span>`;
      if (!locked) d.onclick = () => { this.selStage = st.n; grid.querySelectorAll('.st').forEach((x) => x.classList.toggle('sel', +x.dataset.n === st.n)); };
      grid.appendChild(d); }
    $('playBtn').onclick = () => onPlay(this.selStage, save.character);
    $('creditsBtn').onclick = onCredits; $('creditsClose').onclick = () => this.el.credits.classList.add('hidden');
    this.el.menu.classList.remove('hidden');
  }
  hideMenu() { this.el.menu.classList.add('hidden'); }
  showCredits(text) { $('creditsBody').innerHTML = text; this.el.credits.classList.remove('hidden'); }
  showResult(r, onNext, onRetry, onMenu) {
    $('resTitle').textContent = r.clear ? 'MISSION CLEAR' : 'MISSION FAILED'; $('resTitle').style.background = r.clear ? '' : 'linear-gradient(180deg,#fff,#ff9a7a 60%,#e0503a)';
    $('resStars').textContent = r.clear ? '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '';
    $('rTroops').textContent = r.troops; $('rPeak').textContent = r.peak; $('rKills').textContent = r.kills; $('rTime').textContent = r.time.toFixed(0) + 's'; $('rCoins').textContent = '+' + r.coins;
    $('nextBtn').style.display = r.clear && r.hasNext ? '' : 'none'; $('nextBtn').onclick = onNext; $('retryBtn').onclick = onRetry; $('menuBtn').onclick = onMenu;
    this.el.result.classList.remove('hidden');
  }
  hideResult() { this.el.result.classList.add('hidden'); }
}
