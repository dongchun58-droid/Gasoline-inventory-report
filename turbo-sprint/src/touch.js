// touch.js — 화면 터치 조작: 왼쪽 아날로그 조이스틱 + 오른쪽 버튼
// 조이스틱: 위=가속 / 아래=브레이크 / 좌우=조향(아날로그).
// 터치 지원 기기에서 자동 표시, 실제 키 입력 시 숨김(키보드 우선).
export function setupTouch(input) {
  const layer = document.getElementById('touch');
  if (!layer) return;

  const supportsTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (supportsTouch) layer.classList.add('show');
  window.addEventListener('keydown', () => layer.classList.remove('show'));

  // ---- 왼쪽 조이스틱 (플로팅) ----
  const zone = document.getElementById('joyZone');
  const base = document.getElementById('joyBase');
  const knob = document.getElementById('joyKnob');
  const R = 62; // 노브 최대 이동 반경
  let joyId = null, ox = 0, oy = 0;

  const place = (elm, x, y) => { elm.style.left = x + 'px'; elm.style.top = y + 'px'; };
  const showJoy = (x, y) => { place(base, x, y); place(knob, x, y); base.style.opacity = 1; knob.style.opacity = 1; };
  const hideJoy = () => {
    base.style.opacity = 0; knob.style.opacity = 0;
    input.touch.joyActive = false; input.touch.steerX = 0; input.touch.throttle = 0;
  };

  zone.addEventListener('pointerdown', (e) => {
    if (joyId !== null) return;
    joyId = e.pointerId; ox = e.clientX; oy = e.clientY;
    try { zone.setPointerCapture(joyId); } catch (_) {}
    input.touch.joyActive = true;
    input._fireFirstInput();
    showJoy(ox, oy);
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    place(knob, ox + dx, oy + dy);
    input.touch.steerX = dx / R;
    input.touch.throttle = -dy / R; // 위로 밀면 +(가속)
    e.preventDefault();
  });
  const endJoy = (e) => { if (e.pointerId !== joyId) return; joyId = null; hideJoy(); };
  zone.addEventListener('pointerup', endJoy);
  zone.addEventListener('pointercancel', endJoy);

  // ---- 오른쪽 버튼 ----
  const hold = (id, on, off) => {
    const b = document.getElementById(id);
    if (!b) return;
    const start = (e) => { e.preventDefault(); input._fireFirstInput(); on(); b.classList.add('active'); };
    const end = (e) => { if (e) e.preventDefault(); off(); b.classList.remove('active'); };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('pointerleave', end);
  };
  hold('btnDrift', () => (input.touch.drift = true), () => (input.touch.drift = false));

  const tap = (id, fn) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  };
  tap('btnItem', () => input.pressAction('item'));
  tap('btnRestart', () => input.pressAction('restart'));

  // 결과 화면 아무 곳이나 탭 → 재시작
  const result = document.getElementById('result');
  if (result) result.addEventListener('pointerdown', (e) => { e.preventDefault(); input.pressAction('restart'); });
}
