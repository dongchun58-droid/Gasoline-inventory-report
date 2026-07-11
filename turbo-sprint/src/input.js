// input.js — 키보드 상태머신 (Magic Keyboard)
// 키 매핑은 이 상수 객체 한 곳에서만 관리한다.

export const KEYS = {
  accel:   ['ArrowUp', 'KeyW'],
  brake:   ['ArrowDown', 'KeyS'],
  left:    ['ArrowLeft', 'KeyA'],
  right:   ['ArrowRight', 'KeyD'],
  drift:   ['ShiftLeft', 'ShiftRight'],
  item:    ['Space'],
  restart: ['KeyR'],
  mute:    ['KeyM'],
};

// 스크롤/기본동작을 막을 키들
const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'ShiftLeft', 'ShiftRight',
]);

export class Input {
  constructor() {
    // 물리적 키 눌림 상태
    this._down = new Set();
    // 이번 프레임에 새로 눌린(edge) 액션 — 소비형
    this._pressed = new Set();
    // 첫 입력 콜백(오디오 언락 등)
    this._firstInputCbs = [];
    this._gotFirstInput = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  onFirstInput(cb) { this._firstInputCbs.push(cb); }

  _fireFirstInput() {
    if (this._gotFirstInput) return;
    this._gotFirstInput = true;
    for (const cb of this._firstInputCbs) cb();
  }

  _onKeyDown(e) {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this._fireFirstInput();
    if (!this._down.has(e.code)) {
      this._down.add(e.code);
      // 어떤 액션의 엣지인지 기록
      for (const [action, codes] of Object.entries(KEYS)) {
        if (codes.includes(e.code)) this._pressed.add(action);
      }
    }
  }

  _onKeyUp(e) {
    if (PREVENT.has(e.code)) e.preventDefault();
    this._down.delete(e.code);
  }

  // 홀드 상태
  _any(codes) { for (const c of codes) if (this._down.has(c)) return true; return false; }
  get accel()  { return this._any(KEYS.accel); }
  get brake()  { return this._any(KEYS.brake); }
  get left()   { return this._any(KEYS.left); }
  get right()  { return this._any(KEYS.right); }
  get drift()  { return this._any(KEYS.drift); }

  // 조향: -1(좌) ~ +1(우)
  get steer() {
    let s = 0;
    if (this.left) s -= 1;
    if (this.right) s += 1;
    return s;
  }

  // 엣지(눌린 순간) 소비 — true 한 번만 반환
  consumePressed(action) {
    if (this._pressed.has(action)) { this._pressed.delete(action); return true; }
    return false;
  }

  // 매 프레임 끝에서 호출: 소비되지 않은 엣지 정리
  endFrame() { this._pressed.clear(); }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
