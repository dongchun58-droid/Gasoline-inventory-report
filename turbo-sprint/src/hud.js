// hud.js — DOM 오버레이 갱신
import { ITEMS } from './items.js';

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

export class HUD {
  constructor(track) {
    this.speed = document.getElementById('speed');
    this.rank = document.getElementById('rank');
    this.lap = document.getElementById('lap');
    this.itemIcon = document.getElementById('itemIcon');
    this.result = document.getElementById('result');
    this.rPlace = document.getElementById('rPlace');
    this.rTime = document.getElementById('rTime');
    this.rStandings = document.getElementById('rStandings');
    this.countdown = document.getElementById('countdown');
    this.lapPopup = document.getElementById('lapPopup');
    this._lastItem = undefined;
    this._lastRank = undefined;
    this._cdText = undefined;
    this._lapHideAt = 0;

    // 미니맵 준비
    this.track = track;
    this.map = document.getElementById('minimap');
    this.mctx = this.map ? this.map.getContext('2d') : null;
    if (track && this.mctx) {
      const W = this.map.width, H = this.map.height, pad = 16;
      const { minX, maxX, minZ, maxZ } = track.bounds;
      const sx = (maxX - minX) || 1, sz = (maxZ - minZ) || 1;
      this._toMap = (x, z) => ({
        x: pad + ((x - minX) / sx) * (W - 2 * pad),
        y: pad + ((z - minZ) / sz) * (H - 2 * pad),
      });
      // 트랙 경로(샘플 축약)
      this._path = [];
      const step = Math.max(1, Math.floor(track.samplePos.length / 120));
      for (let i = 0; i < track.samplePos.length; i += step) {
        const p = track.samplePos[i];
        this._path.push(this._toMap(p.x, p.z));
      }
    }
  }

  drawMinimap(karts) {
    const g = this.mctx;
    if (!g || !this._path) return;
    const W = this.map.width, H = this.map.height;
    g.clearRect(0, 0, W, H);
    // 트랙 라인
    g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    this._path.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
    g.closePath(); g.stroke();
    // 스타트라인 표시
    const s0 = this._path[0];
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s0.x, s0.y, 4, 0, 7); g.fill();
    // 카트 점
    for (const k of karts) {
      const m = this._toMap(k.pos.x, k.pos.z);
      const css = '#' + (k.color >>> 0).toString(16).padStart(6, '0');
      g.beginPath();
      g.arc(m.x, m.y, k.isAI ? 5 : 7, 0, 7);
      g.fillStyle = css; g.fill();
      g.lineWidth = 2; g.strokeStyle = k.isAI ? 'rgba(0,0,0,.5)' : '#fff'; g.stroke();
    }
  }

  update({ kmh, rank, lap, laps, item, roulette }) {
    this.speed.firstChild.textContent = kmh;

    if (rank !== this._lastRank) {
      const o = ORD[rank] || rank + 'th';
      this.rank.innerHTML = o.slice(0, -2) + '<sup>' + o.slice(-2) + '</sup>';
      this.rank.animate(
        [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
        { duration: 260, easing: 'ease-out' }
      );
      this._lastRank = rank;
    }

    this.lap.innerHTML = 'LAP <b>' + Math.min(lap + 1, laps) + '</b>/' + laps;

    // 아이템 슬롯 (룰렛 중이면 빠르게 순환)
    let icon = '';
    if (roulette) {
      const keys = Object.keys(ITEMS);
      icon = ITEMS[keys[Math.floor(performance.now() / 80) % keys.length]].emoji;
    } else if (item) {
      icon = ITEMS[item].emoji;
    }
    if (icon !== this._lastItem) { this.itemIcon.textContent = icon; this._lastItem = icon; }
  }

  // 카운트다운 3·2·1·GO!
  showCountdown(rem) {
    let text = '';
    if (rem > 2.4) text = '3';
    else if (rem > 1.6) text = '2';
    else if (rem > 0.8) text = '1';
    else if (rem > -0.2) text = 'GO!';
    if (text !== this._cdText) {
      this._cdText = text;
      this.countdown.textContent = text;
      this.countdown.style.display = text ? 'flex' : 'none';
      this.countdown.classList.toggle('go', text === 'GO!');
      if (text) {
        this.countdown.animate(
          [{ transform: 'scale(1.6)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 260, easing: 'ease-out' }
        );
      }
    }
  }
  hideCountdown() { this.countdown.style.display = 'none'; this._cdText = ''; }

  // 남은 바퀴 팝업
  showLapPopup(text) {
    this.lapPopup.textContent = text;
    this.lapPopup.classList.add('show');
    this.lapPopup.animate(
      [{ transform: 'translateX(-50%) scale(1.4)', opacity: 0 }, { transform: 'translateX(-50%) scale(1)', opacity: 1 }],
      { duration: 300, easing: 'ease-out' }
    );
    this._lapHideAt = performance.now() + 1600;
    setTimeout(() => { if (performance.now() >= this._lapHideAt - 50) this.hideLapPopup(); }, 1650);
  }
  hideLapPopup() { this.lapPopup.classList.remove('show'); }

  // 골인 결과: 최종 순위표
  showResult(standings, player, timeStr) {
    const myRank = standings.indexOf(player) + 1;
    const o = ORD[myRank] || myRank + 'th';
    this.rPlace.textContent = o;
    this.rTime.textContent = 'TIME ' + timeStr;
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
    this.rStandings.innerHTML = standings.map((k, i) =>
      `<div class="rrow${k === player ? ' you' : ''}"><span>${medals[i] || (i + 1)}</span>` +
      `<span>${k.name}</span></div>`
    ).join('');
    this.result.classList.add('show');
  }

  hideResult() { this.result.classList.remove('show'); }
}
