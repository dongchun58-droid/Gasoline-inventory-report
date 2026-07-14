// touch.js — 화면 터치 조작 (키보드 없는 기기용)
// 터치 지원 기기에서 버튼을 띄우고, 실제 키를 누르면 자동으로 숨긴다(키보드 우선).
export function setupTouch(input) {
  const el = document.getElementById('touch');
  if (!el) return;

  const supportsTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (supportsTouch) el.classList.add('show');
  // 실제 키보드 입력이 감지되면 터치 UI 숨김
  window.addEventListener('keydown', () => el.classList.remove('show'));

  const hold = (id, on, off) => {
    const b = document.getElementById(id);
    if (!b) return;
    const start = (e) => { e.preventDefault(); input.pressAction && input._fireFirstInput(); on(); b.classList.add('active'); };
    const end = (e) => { if (e) e.preventDefault(); off(); b.classList.remove('active'); };
    b.addEventListener('touchstart', start, { passive: false });
    b.addEventListener('touchend', end, { passive: false });
    b.addEventListener('touchcancel', end, { passive: false });
    b.addEventListener('mousedown', start);
    b.addEventListener('mouseup', end);
    b.addEventListener('mouseleave', end);
  };
  hold('btnLeft', () => (input.touch.left = true), () => (input.touch.left = false));
  hold('btnRight', () => (input.touch.right = true), () => (input.touch.right = false));
  hold('btnGas', () => (input.touch.accel = true), () => (input.touch.accel = false));
  hold('btnBrake', () => (input.touch.brake = true), () => (input.touch.brake = false));
  hold('btnDrift', () => (input.touch.drift = true), () => (input.touch.drift = false));

  const tap = (id, fn) => {
    const b = document.getElementById(id);
    if (!b) return;
    const h = (e) => { e.preventDefault(); fn(); };
    b.addEventListener('touchstart', h, { passive: false });
    b.addEventListener('mousedown', h);
  };
  tap('btnItem', () => input.pressAction('item'));
  tap('btnRestart', () => input.pressAction('restart'));
  // 결과 화면 아무 곳이나 탭 → 재시작
  const result = document.getElementById('result');
  if (result) {
    const h = (e) => { e.preventDefault(); input.pressAction('restart'); };
    result.addEventListener('touchstart', h, { passive: false });
    result.addEventListener('mousedown', h);
  }
}
