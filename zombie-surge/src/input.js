// input.js — 좌우 자유 이동(←→ 홀드 / 드래그 조준) + 발사 홀드(스페이스/FIRE 버튼)
export class Input {
  constructor(el, fireBtn) {
    this.axis = 0;            // -1 ~ 1 : 키보드 좌우
    this.axisZ = 0;           // -1 ~ 1 : 키보드 앞뒤(필드 모드)
    this.steer = null;        // -1 ~ 1 : 화면을 끌면 그 위치로 분대가 따라감
    this.steerZ = null;       // -1 ~ 1 : 세로 드래그(필드 모드)
    this.formKey = false;     // N 키: 대형 변경(한 번만 소비)
    this.fire = false;
    this._l = false; this._r = false; this._u = false; this._d = false;
    this._keyFire = false; this._btnFire = false;
    this._first = false; this._cbs = [];
    const L = ['ArrowLeft', 'KeyA'], R = ['ArrowRight', 'KeyD'], U = ['ArrowUp', 'KeyW'], D = ['ArrowDown', 'KeyS'];
    window.addEventListener('keydown', (e) => {
      if ([...L, ...R, ...U, ...D, 'Space'].includes(e.code)) e.preventDefault();
      this._fire1();
      if (L.includes(e.code)) this._l = true;
      if (R.includes(e.code)) this._r = true;
      if (U.includes(e.code)) this._u = true;
      if (D.includes(e.code)) this._d = true;
      if (e.code === 'Space') this._keyFire = true;
      if (e.code === 'KeyN' && !e.repeat) this.formKey = true;
      this._sync();
    });
    window.addEventListener('keyup', (e) => {
      if (L.includes(e.code)) this._l = false;
      if (R.includes(e.code)) this._r = false;
      if (U.includes(e.code)) this._u = false;
      if (D.includes(e.code)) this._d = false;
      if (e.code === 'Space') this._keyFire = false;
      this._sync();
    });
    // 터치/마우스: 누른 지점이 조이스틱 원점. 그대로 누르고만 있으면 사격만 하고
    // 움직이지 않는다(휴대폰에서 탭했다고 분대가 끌려가지 않도록).
    let down = false, ox = 0, oy = 0;
    const unit = () => Math.max(70, Math.min(window.innerWidth, window.innerHeight) * 0.20);
    const upd = (e) => {
      const u = unit(), dead = u * 0.22;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      if (Math.hypot(dx, dy) < dead) { this.steer = 0; this.steerZ = 0; return; }
      this.steer = Math.max(-1, Math.min(1, dx / u));
      this.steerZ = Math.max(-1, Math.min(1, dy / u));
    };
    const start = (e) => { down = true; ox = e.clientX; oy = e.clientY; this.steer = 0; this.steerZ = 0;
      this._fire1(); this._btnFire = true; this._sync(); };
    const move = (e) => { if (down) upd(e); };
    const end = () => { down = false; this.steer = null; this.steerZ = null; this._btnFire = false; this._sync(); };
    el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    // 앱 전환·포커스 상실 시 사격/이동이 눌린 채 남지 않도록 정리(모바일)
    const reset = () => { down = false; this.steer = null; this.steerZ = null;
      this._btnFire = false; this._keyFire = false; this._l = this._r = this._u = this._d = false; this._sync(); };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    if (fireBtn) {   // FIRE 버튼은 이동 없이 사격만
      const bd = (e) => { e.preventDefault(); e.stopPropagation(); this._fire1(); this._btnFire = true; this._sync(); };
      const bu = (e) => { e.preventDefault(); e.stopPropagation(); this._btnFire = false; this._sync(); };
      fireBtn.addEventListener('pointerdown', bd); fireBtn.addEventListener('pointerup', bu);
      fireBtn.addEventListener('pointerleave', bu); fireBtn.addEventListener('pointercancel', bu);
    }
  }
  _sync() { this.axis = (this._r ? 1 : 0) - (this._l ? 1 : 0);
    this.axisZ = (this._d ? 1 : 0) - (this._u ? 1 : 0); this.fire = this._keyFire || this._btnFire; }
  consumeForm() { const f = this.formKey; this.formKey = false; return f; }
  onFirstInput(cb) { this._cbs.push(cb); }
  _fire1() { if (this._first) return; this._first = true; this._cbs.forEach((c) => c()); }
}
