// hud.js — DOM 오버레이 갱신
import { ITEMS } from './items.js';

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

export class HUD {
  constructor() {
    this.speed = document.getElementById('speed');
    this.rank = document.getElementById('rank');
    this.lap = document.getElementById('lap');
    this.itemIcon = document.getElementById('itemIcon');
    this.result = document.getElementById('result');
    this.rPlace = document.getElementById('rPlace');
    this.rTime = document.getElementById('rTime');
    this._lastItem = undefined;
    this._lastRank = undefined;
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

  showResult(rank, timeStr) {
    const o = ORD[rank] || rank + 'th';
    this.rPlace.textContent = o;
    this.rTime.textContent = 'TIME ' + timeStr;
    this.result.classList.add('show');
  }

  hideResult() { this.result.classList.remove('show'); }
}
