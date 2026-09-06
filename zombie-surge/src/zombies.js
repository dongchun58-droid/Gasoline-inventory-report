// zombies.js — 좀비 풀(파츠별 InstancedMesh, 최대 220) + 보스(풀 디테일)
// 폭력 수위: 사망 시 짙은 체액 파티클 + 재로 소멸(축소·침강). 절단/붉은 피 없음.
import * as THREE from 'three';
import { noiseNormal } from './textures.js';

const MAX = 220;
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _p = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const skinN = noiseNormal(64, 0.9), ragN = noiseNormal(64, 1.2);
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.85, metalness: 0, normalMap: o.normal || null, normalScale: new THREE.Vector2(0.6, 0.6) });

function zombieParts() {
  const P = []; const add = (geo, m, off, anim) => P.push({ geo, mat: m, off, anim });
  const mSkin = mat(0x8fa07a, { rough: 0.9, normal: skinN }), mRag = mat(0x4a4038, { normal: ragN }), mRag2 = mat(0x2e3a44, { normal: ragN }), mDark = mat(0x2a2620);
  add(new THREE.CapsuleGeometry(0.07, 0.34, 4, 7), mRag2, [-0.10, 0.60, 0], 'legL');
  add(new THREE.CapsuleGeometry(0.07, 0.34, 4, 7), mRag2, [0.10, 0.60, 0], 'legR');
  add(new THREE.BoxGeometry(0.14, 0.10, 0.24), mDark, [-0.10, 0.05, 0.03], 'footL');
  add(new THREE.BoxGeometry(0.14, 0.10, 0.24), mDark, [0.10, 0.05, 0.03], 'footR');
  add(new THREE.BoxGeometry(0.36, 0.48, 0.22), mRag, [0, 1.16, 0.06], 'torso');       // 구부정
  add(new THREE.CapsuleGeometry(0.055, 0.30, 4, 7), mSkin, [-0.24, 1.30, 0.14], 'armL');  // 앞으로 뻗은 팔
  add(new THREE.CapsuleGeometry(0.055, 0.30, 4, 7), mSkin, [0.24, 1.30, 0.14], 'armR');
  add(new THREE.SphereGeometry(0.055, 7, 6), mSkin, [-0.24, 1.22, 0.50], 'handL');
  add(new THREE.SphereGeometry(0.055, 7, 6), mSkin, [0.24, 1.22, 0.50], 'handR');
  add(new THREE.SphereGeometry(0.12, 10, 9), mSkin, [0, 1.50, 0.16], 'head');
  add(new THREE.SphereGeometry(0.09, 8, 7), mDark, [0, 1.44, 0.24], 'jaw');              // 벌어진 턱(어두운 입)
  return P;
}

export class ZombiePool {
  constructor() {
    this.group = new THREE.Group();
    this.parts = zombieParts();
    this.inst = this.parts.map((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, MAX); im.count = 0; im.castShadow = true; im.frustumCulled = false; this.group.add(im); return im; });
    this.list = [];   // {x,z,hp,maxHp,type,speed,state,dieT,ph,scale,attackCd,gate}
  }
  spawn(x, z, type, hp, speed, gate = null) {
    if (this.list.length >= MAX) return null;
    const zb = { x, z, hp, maxHp: hp, type, speed: speed * (type === 'runner' ? 1.9 : 1) * (0.9 + Math.random() * 0.25), state: 'walk', dieT: 0, ph: Math.random() * 6.28, scale: type === 'runner' ? 0.92 : 1 + Math.random() * 0.12, attackCd: 0.25, gate, lane: null };
    this.list.push(zb); return zb;
  }
  alive() { return this.list.filter((z) => z.state !== 'dying'); }
  update(dt, t) {
    // 사망 진행·정리
    for (let i = this.list.length - 1; i >= 0; i--) { const z = this.list[i]; if (z.state === 'dying') { z.dieT += dt; if (z.dieT > 0.55) this.list.splice(i, 1); } }
    const n = this.list.length;
    for (let k = 0; k < this.parts.length; k++) {
      const p = this.parts[k], im = this.inst[k]; im.count = n;
      for (let i = 0; i < n; i++) {
        const z = this.list[i];
        const cyc = (t * (z.type === 'runner' ? 11 : 6.5) + z.ph) % 6.283;
        let sc = z.scale, y = 0;
        if (z.state === 'dying') { const u = z.dieT / 0.55; sc = z.scale * (1 - u * 0.85); y = -u * 0.9; }   // 재로 스러지듯 침강·축소
        const lurch = z.state === 'walk' ? Math.sin(cyc) * 0.05 : 0;
        _q.setFromAxisAngle(_v.set(0, 1, 0), lurch * 2 + (z.state === 'attack' ? Math.sin(t * 20) * 0.08 : 0));
        _m.compose(_v.set(z.x, y, z.z), _q, _s.set(sc, sc, sc));
        _p.copy(_m).multiply(zLocal(p, cyc, z.state, t, z.ph));
        im.setMatrixAt(i, _p);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
}

function zLocal(p, cyc, state, t, ph) {
  const [ox, oy, oz] = p.off; let rx = 0, ry = 0, rz = 0, dz = 0, dy = 0;
  const sw = state === 'walk' ? Math.sin(cyc) : 0;
  const atk = state === 'attack' ? Math.abs(Math.sin(t * 12 + ph)) : 0;
  switch (p.anim) {
    case 'legL': rx = sw * 0.6; break; case 'legR': rx = -sw * 0.6; break;
    case 'footL': dz = sw * 0.18; dy = Math.max(0, sw) * 0.08; break; case 'footR': dz = -sw * 0.18; dy = Math.max(0, -sw) * 0.08; break;
    case 'torso': rx = 0.35; break;
    case 'armL': rx = -1.35 - atk * 0.6; rz = 0.15 + Math.sin(t * 3 + ph) * 0.1; break;
    case 'armR': rx = -1.25 - atk * 0.6; rz = -0.15 - Math.sin(t * 2.6 + ph) * 0.1; break;
    case 'handL': dz = -atk * 0.15; break; case 'handR': dz = -atk * 0.15; break;
    case 'head': rx = 0.25; ry = Math.sin(t * 1.7 + ph) * 0.25; rz = Math.sin(t * 1.1 + ph) * 0.15; break;
    case 'jaw': dy = -atk * 0.03; break;
  }
  const pivotY = p.anim.startsWith('leg') ? 0.2 : p.anim.startsWith('arm') ? 0.18 : 0;
  _r.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  return new THREE.Matrix4().makeTranslation(ox, oy + pivotY + dy, oz + dz).multiply(_r).multiply(new THREE.Matrix4().makeTranslation(0, -pivotY, 0));
}

// ---- 보스 ----
export function buildBoss(type) {
  const g = new THREE.Group(); g.userData.parts = {};
  const mSkin = mat(type === 'screamer' ? 0x9aa48a : 0x7c8a66, { rough: 0.85, normal: skinN }), mRag = mat(0x3a332c, { normal: ragN }), mDark = mat(0x1e1a16), mBone = mat(0xd9d2c0, { rough: 0.6 });
  const add = (mesh, name) => { g.add(mesh); if (name) g.userData.parts[name] = mesh; return mesh; };
  const pivot = (mesh, x, y, z) => { const pv = new THREE.Group(); pv.position.set(x, y, z); pv.add(mesh); return pv; };
  if (type === 'brute') {
    // 거구(키 3.4): 굵은 다리, 거대한 상체, 한쪽 팔 비대, 등 뼈 돌기
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 12), mRag); leg.position.y = -0.45; const pv = pivot(leg, sx * 0.32, 1.35, 0); add(pv, sx < 0 ? 'legL' : 'legR'); }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), mRag)).position.y = 1.5;
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 14), mSkin); torso.scale.set(1.1, 1.0, 0.85); torso.position.y = 2.35; torso.rotation.x = 0.25; add(torso, 'torso');
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), mBone); sp.position.set((i - 2) * 0.18, 2.75 + Math.abs(i - 2) * -0.08, -0.62); sp.rotation.x = -0.6; add(sp); }
    for (const sx of [-1, 1]) {
      const big = sx > 0; const arm = new THREE.Mesh(new THREE.CapsuleGeometry(big ? 0.26 : 0.16, big ? 1.0 : 0.8, 4, 12), mSkin); arm.position.y = -0.55;
      const fist = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.36 : 0.2, 12, 10), mSkin); fist.position.y = -1.1; arm.add(fist);
      const pv = pivot(arm, sx * 1.0, 2.7, 0.1); pv.rotation.set(-0.9, 0, sx * 0.35); add(pv, sx < 0 ? 'armL' : 'armR');
    }
    const head = new THREE.Group(); head.position.set(0, 3.15, 0.35);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), mSkin));
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.28), mDark); jaw.position.set(0, -0.2, 0.12); head.add(jaw);
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb040 })); eye.position.set(sx * 0.12, 0.04, 0.29); head.add(eye); }
    add(head, 'head');
    g.userData.height = 3.4; g.userData.radius = 1.3;
  } else {
    // 스크리머(키 2.6): 마른 체형, 긴 팔, 거대한 입, 목 부풀림
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.7, 4, 10), mRag); leg.position.y = -0.45; const pv = pivot(leg, sx * 0.18, 1.25, 0); add(pv, sx < 0 ? 'legL' : 'legR'); }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 6, 14), mSkin); torso.position.y = 1.85; torso.rotation.x = 0.2; add(torso, 'torso');
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.1, 4, 10), mSkin); arm.position.y = -0.6;
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), mBone); claw.position.y = -1.25; claw.rotation.x = Math.PI; arm.add(claw);
      const pv = pivot(arm, sx * 0.48, 2.3, 0.1); pv.rotation.set(-0.6, 0, sx * 0.9); add(pv, sx < 0 ? 'armL' : 'armR');
    }
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mSkin); throat.position.set(0, 2.42, 0.18); add(throat, 'throat');
    const head = new THREE.Group(); head.position.set(0, 2.72, 0.2);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mSkin));
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mDark); mouth.scale.set(1, 1.3, 0.6); mouth.position.set(0, -0.12, 0.18); head.add(mouth);
    for (let i = 0; i < 6; i++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 5), mBone); tooth.position.set((i - 2.5) * 0.06, -0.02, 0.3); tooth.rotation.x = Math.PI; head.add(tooth); }
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xc0ffe0 })); eye.position.set(sx * 0.11, 0.08, 0.22); head.add(eye); }
    add(head, 'head');
    g.userData.height = 2.6; g.userData.radius = 0.9;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function animateBoss(g, t, state) {
  const P = g.userData.parts; const cyc = t * 4.5; const sw = state === 'walk' ? Math.sin(cyc) : 0;
  P.legL.rotation.x = sw * 0.5; P.legR.rotation.x = -sw * 0.5;
  P.torso.rotation.x = 0.25 + Math.sin(t * 2) * 0.03;
  P.head.rotation.y = Math.sin(t * 1.3) * 0.3; P.head.rotation.z = Math.sin(t * 0.9) * 0.1;
  if (state === 'slam') { const u = Math.min(1, (t % 1)); P.armR.rotation.x = -0.9 - Math.sin(u * Math.PI) * 1.4; P.armL.rotation.x = -0.9 - Math.sin(u * Math.PI) * 1.4; }
  else { P.armR.rotation.x = -0.9 + Math.sin(t * 2.2) * 0.15; P.armL.rotation.x = -0.9 + Math.sin(t * 2.5) * 0.15; }
  if (P.throat) { const s = 1 + (state === 'scream' ? Math.abs(Math.sin(t * 10)) * 0.5 : 0.05 * Math.sin(t * 3)); P.throat.scale.setScalar(s); }
  g.position.y = Math.abs(Math.sin(cyc)) * (state === 'walk' ? 0.08 : 0);
}
