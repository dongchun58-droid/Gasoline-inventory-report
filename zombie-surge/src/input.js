// input.js — 레인 선택 입력: 키보드(←→/A/D), 터치 스와이프, 탭(문 연타)
export class Input {
  constructor(el) {
    this.lane = null;          // 이번 프레임 소비형 이동: -1 / +1
    this.taps = 0;             // 소비형 탭 카운트
    this._first = false; this._firstCbs = [];
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','KeyA','KeyD','Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this._fire();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.lane = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.lane = 1;
      if (e.code === 'Space') this.taps++;
    });
    let sx = 0, sy = 0, moved = false;
    el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; moved = false; this._fire(); });
    el.addEventListener('pointermove', (e) => {
      if (moved || e.buttons === 0) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) { this.lane = dx > 0 ? 1 : -1; moved = true; }
    });
    el.addEventListener('pointerup', (e) => {
      if (!moved) {
        // 탭: 화면 좌/우 절반으로도 레인 선택 가능 + 문 연타 카운트
        this.taps++;
        if (e.clientX < window.innerWidth * 0.5) this.lane = -1; else this.lane = 1;
      }
    });
  }
  onFirstInput(cb) { this._firstCbs.push(cb); }
  _fire() { if (this._first) return; this._first = true; this._firstCbs.forEach((c) => c()); }
  consumeLane() { const l = this.lane; this.lane = null; return l; }
  consumeTaps() { const t = this.taps; this.taps = 0; return t; }
}
