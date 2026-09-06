// env.js — 스테이지 환경: 다리 상판, 난간, 가로등, 바다, 원경 + 카드/문 메쉬 빌더
import * as THREE from 'three';
import { deckTexture, waterTexture, cardTexture, plateTexture } from './textures.js';
import { normalFromCanvas } from './pbrtex.js';

export const ROAD_HALF = 8.8;    // 다리 반폭
export const HORDE_HALF = 5.0;   // 좀비가 내려오는 가운데 통로
export const SIDE_X = 7.0;       // 카드 문이 내려오는 바깥 좌·우 차선

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
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.6, 0.55), stone); p.position.set(sx * 2.6, 1.8, 0); g.add(p); }
  for (const sx of [-1, 1]) {                       // 양쪽으로 열리는 문짝
    const half = new THREE.Group(); half.position.set(sx * 2.4, 0, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.9, 0.2), wood); panel.position.set(-sx * 1.15, 1.45, 0); half.add(panel);
    for (let b = 0; b < 2; b++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.11, 0.24), iron); bar.position.set(-sx * 1.15, 0.8 + b * 1.35, 0); half.add(bar); }
    g.add(half); g.userData[sx < 0 ? 'L' : 'R'] = half;
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.24), new THREE.MeshBasicMaterial({ map: cardTexture(type, text), toneMapped: false }));
  face.position.set(0, 4.3, 0.05); g.add(face); g.userData.face = face;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = 0.03; g.add(strip);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function breakDoor(door, u) {    // u 0→1 : 문짝이 열리며 표지판이 떠오른다
  door.userData.L.rotation.y = -u * 2.1; door.userData.R.rotation.y = u * 2.1;
  door.userData.face.position.y = 4.3 + u * 2.2; door.userData.face.material.opacity = 1 - u;
  door.userData.face.material.transparent = true;
}
