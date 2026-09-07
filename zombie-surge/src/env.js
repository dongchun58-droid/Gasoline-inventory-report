// env.js — 스테이지 환경: 다리 상판, 난간, 가로등, 바다, 원경 + 카드/문 메쉬 빌더
import * as THREE from 'three';
import { deckTexture, waterTexture, cardTexture, plateTexture } from './textures.js';
import { normalFromCanvas } from './pbrtex.js';

export const ROAD_HALF = 11.4;   // 다리 반폭
export const HORDE_HALF = 5.2;   // 좀비가 내려오는 가운데 통로
export const SIDE_X = 9.0;       // 카드 문이 내려오는 바깥 좌·우 차선(방어선에서 충분히 떨어뜨림)

export function buildEnvironment(theme, length) {
  const g = new THREE.Group(); const L = length + 120;
  // 상판
  const deckTex = deckTexture('#' + new THREE.Color(theme.deck).getHexString()); deckTex.repeat.set(3, L / 6);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2, 1.2, L), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9, normalMap: normalFromCanvas(deckTex.image, 0.6) }));
  deck.position.set(0, -0.6, -L / 2 + 30); deck.receiveShadow = true; g.add(deck);
  // 중앙 점선
  const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.02, 2.2), new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.8 }), Math.floor(L / 5));
  const m = new THREE.Matrix4(); for (let i = 0; i < dash.count; i++) { m.makeTranslation(0, 0.01, 20 - i * 5); dash.setMatrixAt(i, m); } g.add(dash);
  // 통로 구분선: 가운데(좀비) / 바깥 좌·우(카드)
  const laneMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.30, toneMapped: false, depthWrite: false });
  for (const sx of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.26, L), laneMat);
    line.rotation.x = -Math.PI / 2; line.position.set(sx * HORDE_HALF, 0.02, -L / 2 + 30); g.add(line);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, L), new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.07, toneMapped: false, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(sx * SIDE_X, 0.015, -L / 2 + 30); g.add(glow);
  }
  // 난간(석재 기둥 + 가로대)
  const pMat = new THREE.MeshStandardMaterial({ color: theme.parapet, roughness: 0.85 });
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.3, 0.5), pMat, Math.floor(L / 4) * 2);
  let k = 0; for (let i = 0; i < Math.floor(L / 4); i++) for (const sx of [-1, 1]) { m.makeTranslation(sx * (ROAD_HALF + 0.3), 0.65, 20 - i * 4); posts.setMatrixAt(k++, m); }
  posts.castShadow = true; g.add(posts);
  for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, L), pMat); rail.position.set(sx * (ROAD_HALF + 0.3), 1.3, -L / 2 + 30); g.add(rail); }
  // 가로등
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.5 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: theme.time === 'day' ? 0xdde8f0 : 0xffd890, toneMapped: false });
  for (let i = 0; i < L / 40; i++) for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 8), lampMat); pole.position.set(sx * (ROAD_HALF + 0.3), 3.9, 20 - i * 40); g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), lampMat); arm.position.set(sx * (ROAD_HALF - 0.4), 6.9, 20 - i * 40); g.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), bulbMat); bulb.position.set(sx * (ROAD_HALF - 1.0), 6.8, 20 - i * 40); g.add(bulb);
  }
  // 바다(스크롤 텍스처 평면)
  const wt = waterTexture(); wt.repeat.set(40, 60);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 2400), new THREE.MeshStandardMaterial({ map: wt, color: theme.water, roughness: 0.3, metalness: 0.25, normalMap: normalFromCanvas(wt.image, 0.8) }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -4.5, -L / 2 + 30); g.add(sea);
  // 다리 교각(물 위)
  const pierMat = new THREE.MeshStandardMaterial({ color: theme.parapet, roughness: 0.9 });
  for (let i = 0; i < L / 60; i++) { const pier = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 2, 6, 3), pierMat); pier.position.set(0, -3.6, -i * 60); g.add(pier); }
  // 원경 실루엣(도시/크레인)
  const farMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.fog).multiplyScalar(0.55), roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const sx = i % 2 ? 1 : -1; const h = 10 + (i * 37) % 40, w = 8 + (i * 13) % 14;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), farMat); b.position.set(sx * (60 + (i * 23) % 120), h / 2 - 4, -i * (L / 40) - 60); g.add(b);
  }
  return { group: g, sea: wt, update(dt) { wt.offset.y = (wt.offset.y - dt * 0.04) % 1; } };
}

// ---- 카드(레인 위 표지판) ----
export function buildCard(type, text) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.3, 0.18), new THREE.MeshStandardMaterial({ map: cardTexture(type, text), roughness: 0.55 }));
  face.position.y = 1.9; g.add(face);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.8 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), postMat); p.position.set(sx * 1.55, 0.6, 0); g.add(p); }
  // 바닥 발광 띠(레인 인지)
  const col = { plus: 0x2f8fd6, mul: 0xffd23f, minus: 0xe0503a, weapon: 0x8a5cf6, shield: 0x2fd6b8 }[type] || 0xffffff;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = 0.03; g.add(strip);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- 카드 문(부수고 지나가면 획득) : 좌/우 한쪽에 내려온다 ----
export function buildCardDoor(type, text) {
  const g = new THREE.Group(); g.userData = {};
  const col = { plus: 0x2f8fd6, mul: 0xffd23f, minus: 0xe0503a, weapon: 0x8a5cf6, shield: 0x2fd6b8 }[type] || 0xffffff;
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.6 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.9 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.0, 0.4), stone); p.position.set(sx * 2.0, 1.5, 0); g.add(p); }
  for (const sx of [-1, 1]) {                       // 양쪽으로 열리는 문짝
    const half = new THREE.Group(); half.position.set(sx * 1.85, 0, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.3, 0.16), wood); panel.position.set(-sx * 0.88, 1.15, 0); half.add(panel);
    for (let b = 0; b < 2; b++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.09, 0.2), iron); bar.position.set(-sx * 0.88, 0.66 + b * 1.05, 0); half.add(bar); }
    g.add(half); g.userData[sx < 0 ? 'L' : 'R'] = half;
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.73), new THREE.MeshBasicMaterial({ map: cardTexture(type, text), toneMapped: false }));
  face.position.set(0, 4.15, 0.05); g.add(face); g.userData.face = face;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = 0.03; g.add(strip);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function breakDoor(door, u) {    // u 0→1 : 문짝이 열리며 표지판이 떠오른다
  door.userData.L.rotation.y = -u * 2.1; door.userData.R.rotation.y = u * 2.1;
  door.userData.face.position.y = 4.15 + u * 2.2; door.userData.face.material.opacity = 1 - u;
  door.userData.face.material.transparent = true;
}

// ---- 보급 관문: 스테이지 시작 시 좌·우 차선에 하나씩 서 있다.
// 쏴서 부수면 그 차선에서 카드가 계속 내려온다(내구도 = def.hp).
export function buildSupplyGate() {
  const g = new THREE.Group(); g.userData = {};
  const stone = new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.6 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), stone); p.position.set(sx * 2.4, 2.1, 0); g.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.55, 0.6), stone); lintel.position.y = 4.35; g.add(lintel);
  for (const sx of [-1, 1]) {
    const half = new THREE.Group(); half.position.set(sx * 2.2, 0, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.5, 0.24), wood); panel.position.set(-sx * 1.05, 1.75, 0); half.add(panel);
    for (let b = 0; b < 3; b++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.14, 0.28), iron); bar.position.set(-sx * 1.05, 0.6 + b * 1.2, 0); half.add(bar); }
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), iron); boss.position.set(-sx * 1.75, 1.8, 0.14); half.add(boss);
    g.add(half); g.userData[sx < 0 ? 'L' : 'R'] = half;
  }
  // 내구도 바
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.44), new THREE.MeshBasicMaterial({ color: 0x2a1410, toneMapped: false }));
  back.position.set(0, 5.0, 0.05); g.add(back);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.30), new THREE.MeshBasicMaterial({ color: 0xffb03a, toneMapped: false }));
  bar.position.set(0, 5.0, 0.07); g.add(bar); g.userData.bar = bar;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.8), new THREE.MeshBasicMaterial({ map: labelTexture('보급 관문'), transparent: true, toneMapped: false }));
  tag.position.set(0, 5.7, 0.05); g.add(tag);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function setGateHp(gate, frac) {
  const b = gate.userData.bar; b.scale.x = Math.max(0.001, frac);
  b.position.x = -(1 - Math.max(0, frac)) * 2.2;
  b.material.color.setHex(frac > 0.5 ? 0xffb03a : frac > 0.22 ? 0xff7a3a : 0xe0503a);
}
export function openGate(gate, u) {   // u 0→1
  gate.userData.L.rotation.y = -u * 2.2; gate.userData.R.rotation.y = u * 2.2;
  gate.userData.bar.visible = u < 0.02;
}
function labelTexture(text) {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 96; const g = cv.getContext('2d');
  g.clearRect(0, 0, 384, 96);
  g.font = 'bold 58px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(text, 192, 52);
  g.fillStyle = '#ffe9a0'; g.fillText(text, 192, 52);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- 장갑차(Phase C 아군): 분대 옆에서 중기관총으로 함께 사격 ----
export function buildAPC() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x4a5340, roughness: 0.65, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23271f, roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a7280, roughness: 0.35, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a3a44, roughness: 0.2, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.15, 4.6), hull); body.position.y = 1.15; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.72, 1.2), hull); nose.position.set(0, 0.86, -2.4); g.add(nose);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 1.1), glass); cab.position.set(0, 1.62, -1.5); g.add(cab);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.46, 14), dark);
    wh.rotation.z = Math.PI / 2; wh.position.set(sx * 1.28, 0.56, -1.5 + i * 1.6); g.add(wh);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.50, 8), steel);
    hb.rotation.z = Math.PI / 2; hb.position.copy(wh.position); g.add(hb);
  }
  // 상부 총탑
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.56, 12), hull); turret.position.y = 2.0; g.add(turret);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.62, 0.14), steel); shield.position.set(0, 2.15, 0.62); g.add(shield);
  for (let i = 0; i < 4; i++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.7, 8), steel);
    br.rotation.x = Math.PI / 2; br.position.set((i - 1.5) * 0.11, 2.18, 1.5); g.add(br); }
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.6), dark); box.position.set(0.66, 2.02, 0.1); g.add(box);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.2), steel); bar.position.set(0, 0.7, -3.05); g.add(bar);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- 평야 필드(Phase B/C): 사방이 트인 개활지 ----
export const FIELD_R = 46;          // 전장 반경
export function buildField(theme, R = FIELD_R) {
  const g = new THREE.Group();
  // 지면
  const gt = fieldTexture(theme.deck); gt.repeat.set(30, 30);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 34, 64),
    new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95, normalMap: normalFromCanvas(gt.image, 0.5) }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  // 교전 한계선(빛나는 링)
  const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.5, R + 0.5, 96),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  // 외곽 철조망 기둥
  const postMat = new THREE.MeshStandardMaterial({ color: theme.parapet, roughness: 0.85 });
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 2.4, 0.35), postMat, 72);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * (R + 3), 1.2, Math.sin(a) * (R + 3)); posts.setMatrixAt(i, m); }
  posts.castShadow = true; g.add(posts);
  const wire = new THREE.Mesh(new THREE.TorusGeometry(R + 3, 0.06, 6, 96), new THREE.MeshStandardMaterial({ color: 0x6a7280, roughness: 0.5, metalness: 0.6 }));
  wire.rotation.x = Math.PI / 2; wire.position.y = 2.0; g.add(wire);
  // 흩어진 바위 · 마른 나무 · 드럼통(개활지 실루엣)
  const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.parapet).multiplyScalar(0.8), roughness: 1 });
  const barMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.8 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 0.95 });
  let seed = 8123; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, d = 14 + rnd() * (R + 22);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (d < R - 4 && Math.abs(z) < 22) continue;                    // 교전 중심은 비워둔다
    const k = rnd();
    if (k < 0.45) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rnd() * 1.5), rockMat);
      r.position.set(x, 0.2, z); r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); r.castShadow = true; g.add(r); }
    else if (k < 0.75) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 4 + rnd() * 3, 7), trunkMat);
      t.position.set(x, 2.2, z); t.rotation.z = (rnd() - 0.5) * 0.3; t.castShadow = true; g.add(t);
      for (let b = 0; b < 3; b++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 1.6, 5), trunkMat);
        br.position.set(x + (rnd() - 0.5) * 1.2, 3.4 + rnd() * 1.2, z + (rnd() - 0.5) * 1.2);
        br.rotation.set(rnd() - 0.5, 0, rnd() - 0.5); g.add(br); } }
    else { const d2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12), barMat);
      d2.position.set(x, 0.7, z); d2.rotation.z = rnd() < 0.4 ? Math.PI / 2 : 0; d2.castShadow = true; g.add(d2); }
  }
  // 먼 산 실루엣
  const farMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.fog).multiplyScalar(0.6), roughness: 1 });
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + 0.1;
    const h = 16 + ((i * 37) % 30), w = 26 + ((i * 13) % 22);
    const b = new THREE.Mesh(new THREE.ConeGeometry(w, h, 4), farMat);
    b.position.set(Math.cos(a) * (R + 120), h / 2 - 4, Math.sin(a) * (R + 120)); b.rotation.y = a; g.add(b);
  }
  return { group: g, update() {} };
}

// 평야 지면 텍스처: 벽돌 결이 없는 얼룩덜룩한 흙/풀
function fieldTexture(hex) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  const base = new THREE.Color(hex);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 256, 256);
  let seed = 4451; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 900; i++) {                       // 흙 얼룩
    const c = base.clone().multiplyScalar(0.72 + rnd() * 0.55);
    g.fillStyle = 'rgba(' + (c.r * 255 | 0) + ',' + (c.g * 255 | 0) + ',' + (c.b * 255 | 0) + ',' + (0.16 + rnd() * 0.3) + ')';
    const r = 3 + rnd() * 22; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, r, r * (0.5 + rnd()), rnd() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < 700; i++) {                       // 마른 풀
    const c = base.clone().multiplyScalar(1.25 + rnd() * 0.4);
    g.strokeStyle = 'rgba(' + (c.r * 255 | 0) + ',' + (c.g * 255 | 0) + ',' + (c.b * 255 | 0) + ',' + (0.18 + rnd() * 0.3) + ')';
    g.lineWidth = 1 + rnd(); const x = rnd() * 256, y = rnd() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y - 3 - rnd() * 6); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
