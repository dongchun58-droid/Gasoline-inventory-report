// input.js — 좌우 자유 이동(←→ 홀드 / 드래그 조준) + 발사 홀드(스페이스/FIRE 버튼)
export class Input {
  constructor(el, fireBtn) {
    this.axis = 0;            // -1 ~ 1 : 키보드 좌우
    this.steer = null;        // -1 ~ 1 : 화면을 끌면 그 위치로 분대가 따라감
    this.fire = false;
    this._l = false; this._r = false;
    this._keyFire = false; this._btnFire = false;
    this._first = false; this._cbs = [];
    const L = ['ArrowLeft', 'KeyA'], R = ['ArrowRight', 'KeyD'];
    window.addEventListener('keydown', (e) => {
      if ([...L, ...R, 'Space'].includes(e.code)) e.preventDefault();
      this._fire1();
      if (L.includes(e.code)) this._l = true;
      if (R.includes(e.code)) this._r = true;
      if (e.code === 'Space') this._keyFire = true;
      this._sync();
    });
    window.addEventListener('keyup', (e) => {
      if (L.includes(e.code)) this._l = false;
      if (R.includes(e.code)) this._r = false;
      if (e.code === 'Space') this._keyFire = false;
      this._sync();
    });
    // 터치/마우스: 누르고 있으면 사격, 좌우로 끌면 그 지점으로 분대가 이동
    let down = false;
    const at = (e) => (e.clientX / window.innerWidth - 0.5) * 2;
    const start = (e) => { down = true; this.steer = at(e); this._fire1(); this._btnFire = true; this._sync(); };
    const move = (e) => { if (down) this.steer = at(e); };
    const end = () => { down = false; this.steer = null; this._btnFire = false; this._sync(); };
    el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    if (fireBtn) {   // FIRE 버튼은 이동 없이 사격만
      const bd = (e) => { e.preventDefault(); e.stopPropagation(); this._fire1(); this._btnFire = true; this._sync(); };
      const bu = (e) => { e.preventDefault(); e.stopPropagation(); this._btnFire = false; this._sync(); };
      fireBtn.addEventListener('pointerdown', bd); fireBtn.addEventListener('pointerup', bu);
      fireBtn.addEventListener('pointerleave', bu); fireBtn.addEventListener('pointercancel', bu);
    }
  }
  _sync() { this.axis = (this._r ? 1 : 0) - (this._l ? 1 : 0); this.fire = this._keyFire || this._btnFire; }
  onFirstInput(cb) { this._cbs.push(cb); }
  _fire1() { if (this._first) return; this._first = true; this._cbs.forEach((c) => c()); }
}
