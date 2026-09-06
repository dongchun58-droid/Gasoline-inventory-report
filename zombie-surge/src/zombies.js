// zombies.js — 좀비 무리(인스턴싱) + 디테일 보스(근육질 브루트 · 스크리머)
// 폭력 수위: 짙은 체액 + 재 소멸. 절단/붉은 피 없음.
import * as THREE from 'three';

const MAX = 460;
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, emissive: o.em ?? 0x000000, emissiveIntensity: o.ei ?? 0 });

function parts() {
  const P = []; const add = (geo, mat, off, anim) => P.push({ geo, mat, off, anim });
  const skin = M(0x93a97e, { rough: 0.85 }), rag = M(0x50463a), rag2 = M(0x39434d), dark = M(0x241f1a), eye = new THREE.MeshBasicMaterial({ color: 0xffe27a });
  add(new THREE.CapsuleGeometry(0.085, 0.30, 4, 7), rag2, [-0.11, 0.52, 0], 'legL');
  add(new THREE.CapsuleGeometry(0.085, 0.30, 4, 7), rag2, [0.11, 0.52, 0], 'legR');
  add(new THREE.BoxGeometry(0.15, 0.10, 0.24), dark, [-0.11, 0.05, 0.03], 'footL');
  add(new THREE.BoxGeometry(0.15, 0.10, 0.24), dark, [0.11, 0.05, 0.03], 'footR');
  add(new THREE.CapsuleGeometry(0.20, 0.30, 5, 10), rag, [0, 1.02, 0.05], 'torso');
  add(new THREE.CapsuleGeometry(0.06, 0.28, 4, 7), skin, [-0.25, 1.16, 0.16], 'armL');
  add(new THREE.CapsuleGeometry(0.06, 0.28, 4, 7), skin, [0.25, 1.16, 0.16], 'armR');
  add(new THREE.SphereGeometry(0.155, 12, 10), skin, [0, 1.40, 0.12], 'head');
  add(new THREE.SphereGeometry(0.105, 10, 8), dark, [0, 1.33, 0.25], 'jaw');
  add(new THREE.SphereGeometry(0.028, 6, 6), eye, [-0.06, 1.45, 0.25], 'head');
  add(new THREE.SphereGeometry(0.028, 6, 6), eye, [0.06, 1.45, 0.25], 'head');
  return P;
}

export class ZombiePool {
  constructor() {
    this.group = new THREE.Group(); this.parts = parts();
    this.inst = this.parts.map((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, MAX); im.count = 0; im.castShadow = true; im.frustumCulled = false; this.group.add(im); return im; });
    this.list = [];
  }
  spawn(x, z, type, hp, speed) {
    if (this.list.length >= MAX) return null;
    const runner = type === 'runner';
    const zb = { x, z, hp, maxHp: hp, type, speed: speed * (runner ? 1.85 : 1) * (0.88 + Math.random() * 0.28),
      state: 'walk', dieT: 0, ph: Math.random() * 6.28, scale: (runner ? 0.92 : 1.02) + Math.random() * 0.12, atk: 0.2 };
    this.list.push(zb); return zb;
  }
  get alive() { let n = 0; for (const z of this.list) if (z.state !== 'dying') n++; return n; }
  clearAll() { this.list.length = 0; }
  update(dt, t) {
    for (let i = this.list.length - 1; i >= 0; i--) { const z = this.list[i]; if (z.state === 'dying') { z.dieT += dt; if (z.dieT > 0.5) this.list.splice(i, 1); } }
    const n = this.list.length;
    for (let k = 0; k < this.parts.length; k++) {
      const p = this.parts[k], im = this.inst[k]; im.count = n;
      for (let i = 0; i < n; i++) {
        const z = this.list[i];
        const cyc = (t * (z.type === 'runner' ? 12 : 7) + z.ph) % 6.283;
        let sc = z.scale, y = 0;
        if (z.state === 'dying') { const u = z.dieT / 0.5; sc = z.scale * (1 - u * 0.9); y = -u * 0.8; }
        _q.setFromAxisAngle(_v.set(0, 1, 0), Math.sin(cyc) * 0.10);
        _m.compose(_v.set(z.x, y, z.z), _q, _s.set(sc, sc, sc));
        _m.multiply(local(p, cyc, z.state, t, z.ph));
        im.setMatrixAt(i, _m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
function local(p, cyc, state, t, ph) {
  const [ox, oy, oz] = p.off; let rx = 0, ry = 0, rz = 0, dz = 0, dy = 0;
  const sw = state === 'walk' ? Math.sin(cyc) : 0, atk = state === 'attack' ? Math.abs(Math.sin(t * 13 + ph)) : 0;
  switch (p.anim) {
    case 'legL': rx = sw * 0.62; break; case 'legR': rx = -sw * 0.62; break;
    case 'footL': dz = sw * 0.18; dy = Math.max(0, sw) * 0.07; break; case 'footR': dz = -sw * 0.18; dy = Math.max(0, -sw) * 0.07; break;
    case 'torso': rx = 0.30; break;
    case 'armL': rx = -1.42 - atk * 0.5; rz = 0.16; break; case 'armR': rx = -1.32 - atk * 0.5; rz = -0.16; break;
    case 'head': rx = 0.22; ry = Math.sin(t * 1.6 + ph) * 0.22; break;
    case 'jaw': dy = -atk * 0.05; break;
  }
  const py = p.anim.startsWith('leg') ? 0.18 : p.anim.startsWith('arm') ? 0.16 : 0;
  _r.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  return new THREE.Matrix4().makeTranslation(ox, oy + py + dy, oz + dz).multiply(_r).multiply(new THREE.Matrix4().makeTranslation(0, -py, 0));
}

// ── 보스: 근육질 실루엣 · 찢어진 재킷 · 표정 있는 얼굴 ────────────────────
export function buildBoss(type) {
  const g = new THREE.Group(); const P = g.userData.parts = {};
  const add = (m, n) => { g.add(m); if (n) P[n] = m; return m; };
  const pv = (m, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); p.add(m); return p; };
  const brute = type === 'brute';
  const skin = M(brute ? 0x9c9a72 : 0x8fa47e, { rough: 0.78 });
  const bruise = M(brute ? 0x6b6f4e : 0x5f7358, { rough: 0.85 });
  const jacket = M(brute ? 0xc2402f : 0x4a5a46, { rough: 0.72 });
  const shirt = M(0xe8e2d4, { rough: 0.8 }), pants = M(brute ? 0x3a4658 : 0x2f3a34, { rough: 0.8 });
  const hair = M(brute ? 0xe8c45a : 0x2a2620, { rough: 0.75 });
  const nail = M(0xd9d2c0, { rough: 0.5 }), dark = M(0x1a1512);
  const eye = new THREE.MeshBasicMaterial({ color: brute ? 0xfff0a0 : 0xc8ffe0 });
  const H = brute ? 1.0 : 0.86;

  // 다리(허벅지 근육 + 종아리 + 부츠)
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.5, 6, 12), pants); thigh.position.y = -0.35; leg.add(thigh);
    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.44, 6, 12), pants); calf.position.y = -0.95; leg.add(calf);
    const bt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.62), dark); bt.position.set(0, -1.32, 0.10); leg.add(bt);
    add(pv(leg, sx * 0.42, 1.85 * H, 0), sx < 0 ? 'legL' : 'legR');
  }
  // 골반 · 몸통(가슴근·복근 · 찢어진 재킷)
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.24, 6, 14), pants)).position.y = 1.86 * H;
  const torso = new THREE.Group(); torso.position.y = 2.5 * H;
  const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.62, 8, 18), shirt); trunk.scale.set(1.12, 1, 0.82); torso.add(trunk);
  for (const sx of [-1, 1]) { const pec = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), shirt);
    pec.scale.set(1, 0.72, 0.6); pec.position.set(sx * 0.28, 0.30, 0.40); torso.add(pec); }
  for (let r = 0; r < 2; r++) for (const sx of [-1, 1]) { const ab = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), shirt);
    ab.scale.set(1, 0.8, 0.5); ab.position.set(sx * 0.17, -0.10 - r * 0.26, 0.46); torso.add(ab); }
  // 재킷: 어깨/등판 + 찢어진 소매
  const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.66, 0.6, 8, 18), jacket); back.scale.set(1.14, 1, 0.86); back.position.z = -0.10; torso.add(back);
  for (const sx of [-1, 1]) { const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.92, 0.14), jacket);
    lapel.position.set(sx * 0.42, 0.02, 0.42); lapel.rotation.z = sx * 0.14; torso.add(lapel); }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 8, 20), jacket); collar.rotation.x = Math.PI / 2; collar.position.y = 0.56; torso.add(collar);
  add(torso, 'torso');
  // 팔(삼각근 + 이두 + 전완 + 주먹) — 브루트는 압도적으로 굵게
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), jacket); delt.position.y = 0.02; arm.add(delt);
    const bic = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 6, 12), skin); bic.position.y = -0.40; arm.add(bic);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.42, 6, 12), skin); fore.position.y = -0.94; arm.add(fore);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), bruise); fist.position.y = -1.34; arm.add(fist);
    for (let i = 0; i < 4; i++) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), bruise);
      kn.position.set((i - 1.5) * 0.13, -1.44, 0.24); arm.add(kn); }
    if (!brute) for (let i = 0; i < 3; i++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), nail);
      cl.position.set((i - 1) * 0.16, -1.6, 0.14); cl.rotation.x = 2.6; arm.add(cl); }
    const a = pv(arm, sx * 0.92, 2.86 * H, 0.04); a.rotation.set(-0.42, 0, sx * 0.30);
    add(a, sx < 0 ? 'armL' : 'armR');
  }
  // 목 · 머리 · 얼굴(눈썹/눈/코/입/이빨) · 머리카락
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.22, 12), skin)).position.y = 3.06 * H;
  const head = new THREE.Group(); head.position.set(0, 3.34 * H, 0.04);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 18), skin); skull.scale.set(1, 1.06, 0.98); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 14), bruise); jaw.scale.set(1, 0.66, 0.9); jaw.position.set(0, -0.24, 0.06); head.add(jaw);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.16), skin); brow.position.set(0, 0.10, 0.34); head.add(brow);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eye); e.position.set(sx * 0.17, 0.0, 0.36); head.add(e);
    const bw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.06), hair); bw.position.set(sx * 0.18, 0.14, 0.40); bw.rotation.z = -sx * 0.32; head.add(bw);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 8), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.08, 0.42); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.10), dark); mouth.position.set(0, -0.28, 0.34); head.add(mouth);
  for (let i = 0; i < 5; i++) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.10, 5), nail);
    th.position.set((i - 2) * 0.075, -0.24, 0.40); th.rotation.x = Math.PI; head.add(th); }
  if (brute) { for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), hair);
      const a = (i / 9) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.20, 0.40, Math.sin(a) * 0.16 - 0.02); sp.rotation.set(-0.3 + Math.sin(a) * 0.3, 0, Math.cos(a) * 0.5); head.add(sp); } }
  else { const hood = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), jacket); hood.position.y = 0.05; head.add(hood);
    const thr = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin); thr.position.set(0, -0.42, 0.16); add(thr, 'throat'); head.add(thr); }
  add(head, 'head');
  g.userData.height = 3.9 * H; g.userData.radius = brute ? 1.5 : 1.2;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function animateBoss(g, t, state) {
  const P = g.userData.parts, cyc = t * 4.2, sw = state === 'walk' ? Math.sin(cyc) : 0;
  P.legL.rotation.x = sw * 0.55; P.legR.rotation.x = -sw * 0.55;
  P.torso.rotation.x = 0.06 + Math.sin(t * 2) * 0.03; P.torso.rotation.y = sw * 0.10;
  P.head.rotation.y = Math.sin(t * 1.2) * 0.24; P.head.rotation.x = 0.05;
  if (state === 'slam') { const u = (t * 2) % 1; const s = Math.sin(u * Math.PI);
    P.armR.rotation.x = -0.42 - s * 1.7; P.armL.rotation.x = -0.42 - s * 1.7; }
  else { P.armR.rotation.x = -0.42 + Math.sin(t * 2.2) * 0.2 - (sw * 0.3); P.armL.rotation.x = -0.42 + Math.sin(t * 2.4) * 0.2 + (sw * 0.3); }
  if (P.throat) P.throat.scale.setScalar(1 + (state === 'scream' ? Math.abs(Math.sin(t * 11)) * 0.55 : Math.sin(t * 3) * 0.05));
  g.position.y = Math.abs(Math.sin(cyc)) * (state === 'walk' ? 0.10 : 0);
}
