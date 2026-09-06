// input.js — 레인 이동(←→/스와이프) + 발사 홀드(스페이스/FIRE 버튼)
export class Input {
  constructor(el, fireBtn) {
    this.lane = null; this.fire = false;
    this._keyFire = false; this._btnFire = false;
    this._first = false; this._cbs = [];
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
      this._fire1();
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.lane = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.lane = 1;
      if (e.code === 'Space') { this._keyFire = true; this._sync(); }
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') { this._keyFire = false; this._sync(); } });
    // 터치/마우스: 화면을 누르고 있으면 발사, 좌우로 끌면 레인 이동
    let sx = 0, moved = false, down = false;
    const start = (e) => { down = true; sx = e.clientX; moved = false; this._fire1(); this._btnFire = true; this._sync(); };
    const move = (e) => { if (!down || moved) return; const dx = e.clientX - sx;
      if (Math.abs(dx) > 26) { this.lane = dx > 0 ? 1 : -1; moved = true; } };
    const end = () => { down = false; this._btnFire = false; this._sync(); };
    el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    if (fireBtn) {
      const bd = (e) => { e.preventDefault(); e.stopPropagation(); this._fire1(); this._btnFire = true; this._sync(); };
      const bu = (e) => { e.preventDefault(); e.stopPropagation(); this._btnFire = false; this._sync(); };
      fireBtn.addEventListener('pointerdown', bd); fireBtn.addEventListener('pointerup', bu);
      fireBtn.addEventListener('pointerleave', bu); fireBtn.addEventListener('pointercancel', bu);
    }
  }
  _sync() { this.fire = this._keyFire || this._btnFire; }
  onFirstInput(cb) { this._cbs.push(cb); }
  _fire1() { if (this._first) return; this._first = true; this._cbs.forEach((c) => c()); }
  consumeLane() { const l = this.lane; this.lane = null; return l; }
}
