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
    const runner = type === 'runner', tank = type === 'tank';
    const spd = runner ? 1.85 : tank ? 0.62 : 1;
    const sc = runner ? 0.92 : tank ? 1.46 : 1.02;
    const zb = { x, z, hp, maxHp: hp, type, speed: speed * spd * (0.88 + Math.random() * 0.28),
      state: 'walk', dieT: 0, ph: Math.random() * 6.28, scale: sc + Math.random() * 0.12, atk: 0.2 };
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
        const cyc = (t * (z.type === 'runner' ? 12 : z.type === 'tank' ? 4.6 : 7) + z.ph) % 6.283;
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
// 보스 무기: 도끼 · 쌍칼 · 대형 식칼 · 스파이크 해머
function bossWeapon(kind) {
  const g = new THREE.Group();
  const steel = M(0xb9c0c8, { rough: 0.28, metal: 0.9 }), edge = M(0xe8eef4, { rough: 0.15, metal: 0.95 });
  const wood = M(0x4a3524, { rough: 0.85 }), rust = M(0x7a3a24, { rough: 0.8 });
  if (kind === 'axe') {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 2.6, 8), wood); haft.position.y = -0.9; g.add(haft);
    for (const sx of [-1, 1]) {                                   // 양날 도끼
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.16, 0.16, 3), edge);
      blade.rotation.set(Math.PI / 2, 0, sx * Math.PI / 2); blade.position.set(sx * 0.44, 0.28, 0); g.add(blade);
    }
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.30, 8), steel); collar.position.y = 0.28; g.add(collar);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.42, 6), steel); spike.position.y = 0.62; g.add(spike);
  } else if (kind === 'twin') {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.52, 8), rust); haft.position.y = -0.24; g.add(haft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.15, 0.40), edge); blade.position.y = 1.15; g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.62, 4), edge); tip.position.y = 2.42; tip.rotation.y = Math.PI / 4; g.add(tip);
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.9, 0.10), steel); fuller.position.set(0, 1.15, 0.17); g.add(fuller);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.11, 0.20), steel); guard.position.y = 0.08; g.add(guard);
  } else if (kind === 'cleaver') {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.9, 8), wood); haft.position.y = -0.4; g.add(haft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 1.15), edge); blade.position.set(0, 0.9, 0.35); g.add(blade);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.5, 0.4), rust); notch.position.set(0, 1.5, 0.86); g.add(notch);
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.22, 8), steel); rivet.rotation.z = Math.PI / 2; rivet.position.y = 0.1; g.add(rivet);
  } else if (kind === 'maul') {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.11, 2.4, 8), rust); haft.position.y = -0.8; g.add(haft);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.72, 0.78), steel); head.position.y = 0.42; g.add(head);
    for (let i = 0; i < 10; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.34, 5), edge);
      const a = (i / 10) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.44, 0.42, Math.sin(a) * 0.44);
      sp.rotation.z = -Math.cos(a) * 1.57; sp.rotation.x = Math.sin(a) * 1.57; g.add(sp); }
  } else return null;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildBoss(def) {
  const D = typeof def === 'string' ? { kind: def } : (def || {});
  const type = D.kind || D.type || 'brute';
  const g = new THREE.Group(); const P = g.userData.parts = {};
  const add = (m, n) => { g.add(m); if (n) P[n] = m; return m; };
  const pv = (m, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); p.add(m); return p; };
  const brute = type === 'brute' || type === 'butcher' || type === 'warlord';
  // 종류별 색/실루엣
  const PAL = {
    brute:    { skin: 0x9c9a72, bruise: 0x6b6f4e, jacket: 0xc2402f, shirt: 0xe8e2d4, pants: 0x3a4658, hair: 0xe8c45a, eye: 0xfff0a0, H: 1.00 },
    screamer: { skin: 0x8fa47e, bruise: 0x5f7358, jacket: 0x4a5a46, shirt: 0xd8dcc8, pants: 0x2f3a34, hair: 0x2a2620, eye: 0xc8ffe0, H: 0.86 },
    butcher:  { skin: 0xa89a76, bruise: 0x6e5a3a, jacket: 0x7a2a22, shirt: 0xb9a98c, pants: 0x2e2a26, hair: 0x1c1a18, eye: 0xff9a50, H: 1.06 },
    reaper:   { skin: 0x7f8f86, bruise: 0x4a5a54, jacket: 0x241f2e, shirt: 0x3a3446, pants: 0x1a1720, hair: 0x0e0c12, eye: 0x9fe8ff, H: 0.94 },
    warlord:  { skin: 0x8a7a5e, bruise: 0x5a4a32, jacket: 0x2c2f3a, shirt: 0x6a5f4c, pants: 0x22242c, hair: 0x120f0c, eye: 0xff5a3a, H: 1.14 },
  }[type] || { skin: 0x9c9a72, bruise: 0x6b6f4e, jacket: 0xc2402f, shirt: 0xe8e2d4, pants: 0x3a4658, hair: 0xe8c45a, eye: 0xfff0a0, H: 1.0 };
  const skin = M(PAL.skin, { rough: 0.78 });
  const bruise = M(PAL.bruise, { rough: 0.85 });
  const jacket = M(PAL.jacket, { rough: 0.72 });
  const shirt = M(PAL.shirt, { rough: 0.8 }), pants = M(PAL.pants, { rough: 0.8 });
  const hair = M(PAL.hair, { rough: 0.75 });
  const plate = M(0x59606c, { rough: 0.4, metal: 0.75 });
  const nail = M(0xd9d2c0, { rough: 0.5 }), dark = M(0x1a1512);
  const eye = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const H = PAL.H;

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
    if (type === 'screamer' || type === 'reaper') for (let i = 0; i < 3; i++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), nail);
      cl.position.set((i - 1) * 0.16, -1.6, 0.14); cl.rotation.x = 2.6; arm.add(cl); }
    if (type === 'butcher' || type === 'warlord') {                 // 어깨 장갑판
      const pd = new THREE.Mesh(new THREE.SphereGeometry(0.40, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), plate);
      pd.position.y = 0.10; arm.add(pd);
      for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 5), plate);
        st.position.set((i - 1) * 0.22, 0.30, 0); arm.add(st); }
    }
    // 무기: 쌍칼은 양손, 나머지는 오른손
    const W = D.weapon || 'none';
    if (W === 'twin' || (W !== 'none' && sx > 0)) {
      const wp = bossWeapon(W === 'twin' ? 'twin' : W);
      if (wp) {
        if (W === 'twin') { wp.position.set(sx * 0.10, -1.52, 0.40); wp.rotation.set(-1.05, 0, sx * 0.42); }
        else { wp.position.set(sx * 0.06, -1.55, 0.22); wp.rotation.set(-0.28, 0, sx * 0.14); }
        arm.add(wp);
      }
    }
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
  if (type === 'brute') { for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), hair);
      const a = (i / 9) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.20, 0.40, Math.sin(a) * 0.16 - 0.02); sp.rotation.set(-0.3 + Math.sin(a) * 0.3, 0, Math.cos(a) * 0.5); head.add(sp); } }
  else if (type === 'butcher') {                                   // 가죽 앞치마 마스크 + 정수리 볼트
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.18), bruise); mask.position.set(0, -0.20, 0.32); head.add(mask);
    for (const sx of [-1, 1]) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.30, 8), plate);
      bolt.rotation.z = Math.PI / 2; bolt.position.set(sx * 0.42, 0.06, 0.06); head.add(bolt); }
    const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), plate); stitch.position.set(0, 0.30, 0.36); head.add(stitch);
  } else if (type === 'warlord') {                                 // 뿔 투구
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), plate); helm.position.y = 0.04; head.add(helm);
    for (const sx of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.95, 7), nail);
      horn.position.set(sx * 0.40, 0.30, -0.02); horn.rotation.set(-0.35, 0, sx * 1.05); head.add(horn); }
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.62), nail); crest.position.set(0, 0.44, -0.02); head.add(crest);
  } else { const hood = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), jacket); hood.position.y = 0.05; head.add(hood);
    if (type === 'reaper') for (const sx of [-1, 1]) { const hn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 6), nail);
      hn.position.set(sx * 0.30, 0.34, -0.10); hn.rotation.set(-0.7, 0, sx * 0.5); head.add(hn); }
    const thr = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin); thr.position.set(0, -0.42, 0.16); add(thr, 'throat'); head.add(thr); }
  add(head, 'head');
  const sc = D.scale || 1;
  g.scale.setScalar(sc);
  g.userData.height = 3.9 * H * sc; g.userData.radius = (brute ? 1.5 : 1.2) * sc;
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
