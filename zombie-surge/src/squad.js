// squad.js — 화려하고 귀여운 병력(치비 비율: 큰 머리·큰 눈) + 무기별 총 모델 + 영웅 초상 렌더
import * as THREE from 'three';
import { CHARACTERS, WEAPONS } from './stages.js';

const MAX = 80;
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.0, emissive: o.em ?? 0x000000, emissiveIntensity: o.ei ?? 0 });

// ── 얼굴 텍스처(귀여운 큰 눈) — 머리 앞면에 붙임 ──────────────────────────
function faceTex(C) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#' + C.skin.toString(16).padStart(6, '0'); g.fillRect(0, 0, 128, 128);
  // 큰 눈(흰자 + 홍채 + 하이라이트)
  for (const ex of [42, 86]) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ex, 62, 15, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(ex + 1, 65, 9.5, 0, 7); g.fill();
    g.fillStyle = '#5aa0e0'; g.beginPath(); g.arc(ex + 1, 65, 6, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(ex + 1, 66, 3.4, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex + 5, 59, 3.6, 0, 7); g.fill();
    g.strokeStyle = '#' + C.hair.toString(16).padStart(6, '0'); g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ex - 13, 42); g.lineTo(ex + 12, 39); g.stroke();     // 눈썹
  }
  // 볼 홍조 + 입(살짝 웃는)
  g.fillStyle = 'rgba(255,120,120,0.35)';
  g.beginPath(); g.ellipse(26, 84, 11, 7, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(102, 84, 11, 7, 0, 0, 7); g.fill();
  g.strokeStyle = '#7a3b2e'; g.lineWidth = 4; g.beginPath(); g.arc(64, 88, 12, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 머리 구에 딱 붙는 얼굴 캡(+Z 방향). 평면 텍스처를 캡에 투영하도록 UV를 다시 계산한다.
export function faceCapGeo(r, spread = 0.78) {
  const g = new THREE.SphereGeometry(r, 28, 20, 0, Math.PI * 2, 0, spread);
  g.rotateX(Math.PI / 2);                       // 극점을 +Z로
  const p = g.attributes.position, uv = g.attributes.uv;
  const R = r * Math.sin(spread) * 1.06;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * R) + 0.5, p.getY(i) / (2 * R) + 0.5);
  uv.needsUpdate = true;
  return g;
}

// ── 무기 모델(무기가 바뀌면 눈에 확 보이게) ──────────────────────────────
export function buildGun(key, scale = 1) {
  const g = new THREE.Group();
  const body = M(0x22252b, { rough: 0.35, metal: 0.75 }), dark = M(0x14161a, { rough: 0.5 }), gold = M(0xd8a33a, { rough: 0.3, metal: 0.9 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x7ff0ff });
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  if (key === 'pistol') {
    add(new THREE.BoxGeometry(0.09, 0.14, 0.34), body, 0, 0, 0.06);
    add(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 8), body, 0, 0.03, 0.26, Math.PI / 2);
    add(new THREE.BoxGeometry(0.07, 0.20, 0.09), dark, 0, -0.14, -0.06);
  } else if (key === 'rifle' || key === 'arifle') {
    const big = key === 'arifle';
    if (big) { add(new THREE.BoxGeometry(0.07, 0.07, 0.30), dark, 0, 0.13, 0.30);   // 상단 조준경
      add(new THREE.BoxGeometry(0.09, 0.22, 0.12), dark, 0, -0.20, 0.24); }        // 확장 탄창
  }
  if (key === 'rifle' || key === 'arifle') {
    add(new THREE.BoxGeometry(0.09, 0.13, 0.72), body, 0, 0, 0.08);
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 8), body, 0, 0.035, 0.60, Math.PI / 2);
    add(new THREE.BoxGeometry(0.07, 0.2, 0.09), dark, 0, -0.15, 0.02);
    add(new THREE.BoxGeometry(0.07, 0.1, 0.22), dark, 0, -0.02, -0.36);
  } else if (key === 'smg' || key === 'hsmg') {
    if (key === 'hsmg') { add(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), dark, 0, 0.03, 0.50, Math.PI / 2);   // 소염기
      add(new THREE.BoxGeometry(0.16, 0.05, 0.12), gold, 0, 0.12, 0.06); }                                          // 금색 상부 레일
  }
  if (key === 'smg' || key === 'hsmg') {
    add(new THREE.BoxGeometry(0.10, 0.15, 0.44), body, 0, 0, 0.04);
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.24, 8), body, 0, 0.03, 0.36, Math.PI / 2);
    add(new THREE.BoxGeometry(0.06, 0.26, 0.08), dark, 0, -0.19, 0.0);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.2), dark, 0, 0.10, -0.14);
  } else if (key === 'shotgun' || key === 'ashotgun') {
    if (key === 'ashotgun') { add(new THREE.CylinderGeometry(0.14, 0.14, 0.20, 12), dark, 0.0, -0.10, 0.16, 0);      // 드럼 탄창
      add(new THREE.BoxGeometry(0.05, 0.05, 0.34), gold, 0, 0.13, 0.42); }
  }
  if (key === 'shotgun' || key === 'ashotgun') {
    add(new THREE.BoxGeometry(0.13, 0.16, 0.80), body, 0, 0, 0.08);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), dark, 0, 0.05, 0.62, Math.PI / 2);   // 굵은 총열
    add(new THREE.CylinderGeometry(0.038, 0.038, 0.44, 8), body, 0, -0.05, 0.56, Math.PI / 2); // 펌프
    add(new THREE.BoxGeometry(0.09, 0.13, 0.28), 0 || dark, 0, -0.03, -0.38);
  } else if (key === 'minigun' || key === 'hminigun') {
    if (key === 'hminigun') { add(new THREE.TorusGeometry(0.20, 0.045, 8, 16), gold, 0, 0, 0.30, Math.PI / 2);       // 총열 링
      add(new THREE.BoxGeometry(0.30, 0.16, 0.16), dark, 0, -0.20, -0.34); }                                        // 대형 탄약함
  }
  if (key === 'minigun' || key === 'hminigun') {
    const barrels = new THREE.Group();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), body);
      b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * 0.10, Math.sin(a) * 0.10, 0.5); barrels.add(b); }
    g.add(barrels); g.userData.spin = barrels;
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 12), dark, 0, 0, 0.02, Math.PI / 2);
    add(new THREE.BoxGeometry(0.22, 0.24, 0.30), body, 0, -0.02, -0.24);
    add(new THREE.TorusGeometry(0.12, 0.035, 6, 14), gold, 0.18, -0.16, -0.20);   // 탄띠 릴
  } else {   // laser1 / laser2 / plasma
    const tierUp = key === 'laser2' || key === 'plasma';
    const plasma = key === 'plasma';
    if (plasma) glow.color.setHex(0xc8a0ff);
    if (tierUp) { for (const sx of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.30), glow);
      fin.position.set(sx * 0.11, 0.06, 0.34); g.add(fin); }
      add(new THREE.TorusGeometry(0.11, 0.028, 6, 16), glow, 0, 0.02, 0.62, Math.PI / 2); }
    if (plasma) add(new THREE.SphereGeometry(0.10, 12, 10), glow, 0, 0.16, 0.24);
    add(new THREE.BoxGeometry(0.14, 0.18, 0.66), M(0xdfe8f0, { rough: 0.25, metal: 0.6 }), 0, 0, 0.06);
    add(new THREE.CylinderGeometry(0.055, 0.03, 0.44, 10), M(0x2b3a48, { rough: 0.3, metal: 0.7 }), 0, 0.02, 0.56, Math.PI / 2);
    add(new THREE.SphereGeometry(0.075, 12, 10), glow, 0, 0.02, 0.80);            // 발광 렌즈
    add(new THREE.BoxGeometry(0.16, 0.09, 0.22), glow, 0, 0.14, -0.02);           // 에너지 셀
    add(new THREE.BoxGeometry(0.08, 0.2, 0.1), M(0x2b3a48), 0, -0.17, 0.0);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ── 병력 파츠(치비: 키 1.5, 머리가 큼) ──────────────────────────────────
function makeParts(C) {
  const P = []; const add = (geo, mat, off, anim) => P.push({ geo, mat, off, anim });
  const skin = M(C.skin, { rough: 0.5 }), cloth = M(C.cloth, { rough: 0.6 }), trim = M(C.trim, { rough: 0.35, metal: 0.5 });
  const boot = M(0x232830, { rough: 0.6 });
  // 헬멧은 몸통보다 어둡게 — 뒤에서 봐도 머리/몸이 분리돼 보이도록
  const hc = new THREE.Color(C.cloth).multiplyScalar(0.55).getHex();
  const helm = M(hc, { rough: 0.4, metal: 0.35 });
  const pack = M(new THREE.Color(C.cloth).multiplyScalar(0.4).getHex(), { rough: 0.7 });
  add(new THREE.CapsuleGeometry(0.09, 0.20, 4, 8), cloth, [-0.11, 0.36, 0], 'legL');
  add(new THREE.CapsuleGeometry(0.09, 0.20, 4, 8), cloth, [0.11, 0.36, 0], 'legR');
  add(new THREE.BoxGeometry(0.16, 0.11, 0.24), boot, [-0.11, 0.06, 0.03], 'footL');
  add(new THREE.BoxGeometry(0.16, 0.11, 0.24), boot, [0.11, 0.06, 0.03], 'footR');
  add(new THREE.CapsuleGeometry(0.27, 0.30, 6, 12), cloth, [0, 0.74, 0], 'torso');       // 또렷한 몸통
  add(new THREE.TorusGeometry(0.265, 0.05, 8, 18), trim, [0, 0.58, 0], 'torso');         // 금색 벨트
  add(new THREE.TorusGeometry(0.24, 0.042, 8, 16), trim, [0, 0.90, 0.05], 'torso');      // 금색 탄띠
  add(new THREE.CapsuleGeometry(0.065, 0.16, 4, 8), skin, [-0.28, 0.80, 0.08], 'armL');
  add(new THREE.CapsuleGeometry(0.065, 0.16, 4, 8), skin, [0.28, 0.80, 0.08], 'armR');
  add(new THREE.SphereGeometry(0.225, 16, 14), skin, [0, 1.24, 0], 'head');              // 머리(치비지만 과하지 않게)
  add(new THREE.SphereGeometry(0.235, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), helm, [0, 1.26, 0], 'head');
  add(new THREE.TorusGeometry(0.238, 0.034, 6, 20), trim, [0, 1.21, 0], 'head');          // 금색 헬멧 테두리
  add(new THREE.BoxGeometry(0.07, 0.30, 0.24), trim, [0, 1.36, 0], 'head');               // 금색 볏(위에서 봐도 식별)
  add(new THREE.BoxGeometry(0.30, 0.30, 0.16), pack, [0, 0.78, 0.26], 'torso');           // 백팩
  add(new THREE.BoxGeometry(0.09, 0.13, 0.09), trim, [0.10, 0.94, 0.32], 'torso');
  return P;
}

export class Squad {
  constructor(character = 'cool') {
    this.group = new THREE.Group();
    this.C = CHARACTERS[character] || CHARACTERS.cool;
    this.count = 0; this.shown = 0; this.t = 0; this.firing = false; this.weapon = 'rifle';
    this.pos = new THREE.Vector3();
    this.parts = makeParts(this.C);
    this.inst = this.parts.map((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, MAX); im.count = 0; im.castShadow = true; im.frustumCulled = false; this.group.add(im); return im; });
    // 얼굴(빌보드 판) — 인스턴스로 병력 전원에게
    this.faceMat = new THREE.MeshBasicMaterial({ map: faceTex(this.C), transparent: true });
    this.faceInst = new THREE.InstancedMesh(faceCapGeo(0.229), this.faceMat, MAX);
    this.faceInst.count = 0; this.faceInst.frustumCulled = false; this.group.add(this.faceInst);
    // 총(인스턴스) — 무기 교체 시 지오메트리 스왑
    this.gunInst = null; this._setGunInstance('rifle');
    this.slots = []; this.colX = []; this._cols = 0; this._layout(9);
    this.leader = buildHero(character); this.group.add(this.leader);
  }
  _setGunInstance(key) {
    if (this.gunInst) { this.group.remove(this.gunInst); this.gunInst.geometry.dispose(); }
    const W = WEAPONS[key] || WEAPONS.rifle;
    const proto = buildGun(key, W.gunScale || 1.3);
    const geos = []; proto.updateMatrixWorld(true);
    proto.traverse((o) => { if (o.isMesh) { const gg = o.geometry.clone(); gg.applyMatrix4(o.matrixWorld); geos.push(gg); } });
    // 파츠를 하나의 지오메트리로 병합(인스턴싱용) — 색은 대표 재질
    const merged = mergeGeos(geos);
    this.gunInst = new THREE.InstancedMesh(merged, M(W.gun || 0x4a5460, { rough: 0.3, metal: 0.75, em: W.gun || 0x4a5460, ei: 0.18 }), MAX);
    this.gunInst.count = 0; this.gunInst.castShadow = true; this.gunInst.frustumCulled = false; this.group.add(this.gunInst);
    geos.forEach((g) => g.dispose());
  }
  // 열 수에 맞춰 슬롯 재배치(넓은 대열 = 얕은 깊이)
  _layout(cols) {
    if (cols === this._cols) return; this._cols = cols;
    this.slots.length = 0;
    this.colX = []; for (let c = 0; c < cols; c++) this.colX.push((c - (cols - 1) / 2) * 0.52);
    for (let i = 0; i < MAX; i++) { const row = Math.floor(i / cols), col = i % cols;
      this.slots.push({ x: (col - (cols - 1) / 2) * 0.52 + (row % 2) * 0.26, z: row * 0.46, ph: (i * 0.37) % 1 }); }
  }
  setWeapon(key) { if (key === this.weapon) return; this.weapon = key; this._setGunInstance(key);
    const L = this.leader.userData.parts; if (L.gun) { L.gunHolder.remove(L.gun); L.gun = buildGun(key, (WEAPONS[key] || WEAPONS.rifle).gunScale || 1.3); L.gunHolder.add(L.gun); } }
  setCount(n) { this.count = Math.max(0, Math.round(n)); }
  get cols() { return this._cols; }
  update(dt, camera) {
    this.t += dt;
    const show = Math.min(MAX, this.count); this.shown = show;
    this._layout(Math.max(7, Math.min(11, Math.ceil(show / 7))));   // 폭은 도로보다 좁게 — 조준(좌우 이동)이 의미를 갖도록
    const fire = this.firing;
    for (let k = 0; k < this.parts.length; k++) {
      const p = this.parts[k], im = this.inst[k]; im.count = show;
      for (let i = 0; i < show; i++) {
        const sl = this.slots[i];
        const bob = Math.sin(this.t * 4 + sl.ph * 6.28) * 0.02 + (fire ? Math.abs(Math.sin(this.t * 22 + sl.ph)) * 0.012 : 0);
        _q.setFromAxisAngle(_v.set(0, 1, 0), Math.PI);
        _m.compose(_v.set(this.pos.x + sl.x, bob, this.pos.z + sl.z), _q, _s);
        _m.multiply(local(p, this.t, sl.ph, fire));
        im.setMatrixAt(i, _m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    // 얼굴 + 총
    this.faceInst.count = show; this.gunInst.count = show;
    for (let i = 0; i < show; i++) {
      const sl = this.slots[i];
      const bob = Math.sin(this.t * 4 + sl.ph * 6.28) * 0.02;
      // 얼굴: 머리 앞면(-z 방향)에 부착
      _q.setFromAxisAngle(_v.set(0, 1, 0), Math.PI);
      _m.compose(_v.set(this.pos.x + sl.x, 1.235 + bob, this.pos.z + sl.z), _q, _s);
      this.faceInst.setMatrixAt(i, _m);
      const rec = fire ? Math.abs(Math.sin(this.t * 26 + sl.ph * 3)) * 0.05 : 0;
      _m.compose(_v.set(this.pos.x + sl.x + 0.27, 0.94 + bob, this.pos.z + sl.z - 0.56 + rec), _q, _s);
      this.gunInst.setMatrixAt(i, _m);
    }
    this.faceInst.instanceMatrix.needsUpdate = true; this.gunInst.instanceMatrix.needsUpdate = true;
    this.leader.position.set(this.pos.x, 0, this.pos.z - 0.55);
    animateHero(this.leader, this.t, fire);
  }
}
function local(p, t, ph, fire) {
  const [ox, oy, oz] = p.off; let rx = 0, ry = 0, rz = 0;
  const w = Math.sin(t * 3 + ph * 6.28);
  switch (p.anim) {
    case 'legL': rx = w * 0.10; break; case 'legR': rx = -w * 0.10; break;
    case 'torso': rx = 0.05; break;
    case 'armL': rx = -1.30; rz = 0.30; break;
    case 'armR': rx = -1.20 + (fire ? Math.abs(Math.sin(t * 26 + ph * 3)) * 0.12 : 0); rz = -0.22; break;
    case 'head': ry = Math.sin(t * 0.8 + ph) * 0.10; break;
  }
  _r.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  return new THREE.Matrix4().makeTranslation(ox, oy, oz).multiply(_r);
}
function mergeGeos(geos) {
  let vc = 0, ic = 0; const hasIdx = geos.every((g) => g.index);
  for (const g of geos) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal;
    pos.set(p.array.subarray(0, p.count * 3), vo * 3);
    if (n) nor.set(n.array.subarray(0, n.count * 3), vo * 3);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; }
    else { for (let i = 0; i < p.count; i++) idx[io++] = i + vo; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// ── 영웅(풀 디테일, 귀엽고 화려하게) ────────────────────────────────────
export function buildHero(character = 'cool') {
  const C = CHARACTERS[character] || CHARACTERS.cool;
  const g = new THREE.Group(); g.userData.parts = {};
  const skin = M(C.skin, { rough: 0.45 }), cloth = M(C.cloth, { rough: 0.5 }), trim = M(C.trim, { rough: 0.3, metal: 0.6 }),
        hair = M(C.hair, { rough: 0.7 }), boot = M(0x2a2f38, { rough: 0.55 }), dark = M(0x1b1f26);
  const P = g.userData.parts; const add = (m, n) => { g.add(m); if (n) P[n] = m; return m; };
  const pv = (m, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); p.add(m); return p; };
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.22, 5, 10), cloth); leg.position.y = -0.13;
    const bt = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.28), boot); bt.position.set(0, -0.30, 0.03); leg.add(bt);
    add(pv(leg, sx * 0.13, 0.52, 0), sx < 0 ? 'legL' : 'legR');
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.26, 6, 14), cloth); torso.position.y = 0.82; add(torso, 'torso');
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.05, 8, 20), trim); belt.position.y = 0.68; add(belt);
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.042, 8, 18), trim); sash.position.set(0, 0.96, 0.07); sash.rotation.z = 0.5; add(sash);
  for (let i = 0; i < 5; i++) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 6), M(0xe0b24a, { metal: 0.8, rough: 0.3 }));
    sh.position.set(-0.20 + i * 0.10, 0.99 + i * 0.032, 0.24); sh.rotation.x = Math.PI / 2; add(sh); }
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.16), M(0x3a4450)); pack.position.set(0, 0.86, -0.26); add(pack);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 5, 10), skin); arm.position.y = -0.13;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), trim); cuff.position.y = -0.02; cuff.rotation.x = Math.PI / 2; arm.add(cuff);
    const a = pv(arm, sx * 0.30, 0.94, 0.04); a.rotation.set(sx < 0 ? -1.35 : -1.22, 0, sx * 0.28); add(a, sx < 0 ? 'armL' : 'armR');
  }
  const holder = new THREE.Group(); holder.position.set(0.10, 0.80, 0.40); add(holder, 'gunHolder');
  P.gun = buildGun('rifle', 1.15); holder.add(P.gun);
  // 큰 머리 + 얼굴 + 헬멧/액세서리
  const head = new THREE.Group(); head.position.y = 1.38;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 18), skin));
  const face = new THREE.Mesh(faceCapGeo(0.345), new THREE.MeshBasicMaterial({ map: faceTex(C), transparent: true }));
  face.position.set(0, -0.01, 0.004); head.add(face);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.355, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), M(C.cloth, { rough: 0.35, metal: 0.3 }));
  helm.position.y = 0.10; head.add(helm);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.352, 0.034, 8, 22), trim); band.position.y = 0.085; head.add(band);
  if (C.acc === 'shades') {                       // 선글라스: 렌즈 2 + 브리지 + 금색 다리
    const lens = M(0x121a26, { rough: 0.12, metal: 0.7 });
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), lens);
      l.scale.set(1.0, 0.72, 0.34); l.position.set(sx * 0.092, 0.012, 0.318); head.add(l);
      const tp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.022, 0.02), trim);
      tp.position.set(sx * 0.20, 0.03, 0.235); tp.rotation.y = sx * 0.75; head.add(tp); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.02), trim); br.position.set(0, 0.03, 0.335); head.add(br); }
  if (C.acc === 'beard') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), hair); b.scale.set(1.05, 0.72, 0.78); b.position.set(0, -0.21, 0.19); head.add(b); }
  if (C.acc === 'tiara') {                        // 헬멧 앞이마의 금색 티아라
    for (let i = -1; i <= 1; i++) { const tt = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.11 + (i === 0 ? 0.07 : 0), 6), trim);
      tt.position.set(i * 0.085, 0.24 + (i === 0 ? 0.03 : 0), 0.30); tt.rotation.x = -0.35; head.add(tt); }
    const pt = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 5, 10), hair); pt.position.set(0, -0.05, -0.34); pt.rotation.x = 0.5; head.add(pt); }
  if (C.acc === 'band') { const bn = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.05, 8, 20), M(0xe04a4a)); bn.position.y = 0.10; head.add(bn);
    for (const sx of [-1, 1]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.03), M(0xe04a4a)); tail.position.set(sx * 0.1, -0.06, -0.36); tail.rotation.x = -0.4; head.add(tail); } }
  add(head, 'head');
  g.rotation.y = Math.PI;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function animateHero(g, t, fire) {
  const P = g.userData.parts;
  P.legL.rotation.x = Math.sin(t * 3) * 0.08; P.legR.rotation.x = -Math.sin(t * 3) * 0.08;
  P.torso.position.y = 0.82 + Math.sin(t * 4) * 0.015;
  P.head.rotation.y = Math.sin(t * 0.7) * 0.14;
  const rec = fire ? Math.abs(Math.sin(t * 24)) * 0.07 : 0;
  P.gunHolder.position.z = 0.40 - rec; P.armR.rotation.x = -1.22 + rec * 1.2;
  if (P.gun && P.gun.userData.spin) P.gun.userData.spin.rotation.z += (fire ? 0.55 : 0.05);
}

// ── 메뉴용 영웅 초상: 오프스크린 렌더 → dataURL ─────────────────────────
export function renderPortraits(keys) {
  const out = {};
  const rn = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rn.setSize(256, 256); rn.setPixelRatio(1); rn.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xdfefff, 0x40506a, 1.5));
  const dl = new THREE.DirectionalLight(0xffffff, 2.0); dl.position.set(1.2, 2, 2.4); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  for (const k of keys) {
    const h = buildHero(k); h.rotation.y = 0.22; sc.add(h);
    cam.position.set(0.16, 1.40, 1.72); cam.lookAt(0, 1.28, 0);   // 얼굴+어깨가 다 들어오는 프레이밍
    rn.render(sc, cam); out[k] = rn.domElement.toDataURL('image/png');
    sc.remove(h); h.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  rn.dispose();
  return out;
}
