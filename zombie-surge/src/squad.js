// squad.js — 병력(군인) 렌더러: 파츠별 InstancedMesh(최대 72명) + 대장 1명 풀 디테일
// 실사 비율(7.5등신, 키 1.75), 방탄조끼·헬멧·소총, 달리기/사격 애니메이션
import * as THREE from 'three';
import { noiseNormal } from './textures.js';
import { CHARACTERS } from './stages.js';

const MAX = 72;
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _p = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const skinN = noiseNormal(64, 0.5), clothN = noiseNormal(64, 1.0);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0.0, normalMap: opts.normal || null, normalScale: new THREE.Vector2(0.5, 0.5) });
}

// 파츠 정의: 로컬 오프셋(발 기준 y=0), 애니메이션 종류
function makeParts(skin, cloth, vest, helmetCol = 0x6d6a55) {
  const P = [];
  const add = (geo, m, off, anim) => P.push({ geo, mat: m, off, anim });
  const mSkin = mat(skin, { rough: 0.6, normal: skinN }), mCloth = mat(cloth, { rough: 0.9, normal: clothN }), mVest = mat(vest, { rough: 0.85, normal: clothN });
  const mHelmet = mat(helmetCol, { rough: 0.5, metal: 0.1 }), mBoot = mat(0x1a1612, { rough: 0.7 }), mGun = mat(0x1c1d20, { rough: 0.4, metal: 0.6 });
  // 다리(허벅지+정강이 캡슐), 부츠
  add(new THREE.CapsuleGeometry(0.075, 0.36, 4, 8), mCloth, [-0.11, 0.62, 0], 'legL');
  add(new THREE.CapsuleGeometry(0.075, 0.36, 4, 8), mCloth, [0.11, 0.62, 0], 'legR');
  add(new THREE.BoxGeometry(0.16, 0.12, 0.28), mBoot, [-0.11, 0.06, 0.04], 'footL');
  add(new THREE.BoxGeometry(0.16, 0.12, 0.28), mBoot, [0.11, 0.06, 0.04], 'footR');
  // 몸통 + 조끼(판넬) + 골반
  add(new THREE.BoxGeometry(0.30, 0.20, 0.20), mCloth, [0, 0.93, 0], 'hip');
  add(new THREE.BoxGeometry(0.40, 0.46, 0.24), mCloth, [0, 1.25, 0], 'torso');
  add(new THREE.BoxGeometry(0.44, 0.34, 0.30), mVest, [0, 1.27, 0], 'torso');
  // 팔(소총 파지 자세: 앞으로)
  add(new THREE.CapsuleGeometry(0.06, 0.30, 4, 8), mCloth, [-0.27, 1.30, 0.10], 'armL');
  add(new THREE.CapsuleGeometry(0.06, 0.30, 4, 8), mCloth, [0.27, 1.30, 0.10], 'armR');
  add(new THREE.SphereGeometry(0.06, 8, 6), mSkin, [-0.22, 1.18, 0.34], 'handL');
  add(new THREE.SphereGeometry(0.06, 8, 6), mSkin, [0.24, 1.14, 0.22], 'handR');
  // 소총
  add(new THREE.BoxGeometry(0.06, 0.09, 0.78), mGun, [0.05, 1.20, 0.42], 'gun');
  // 목·머리·헬멧
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 8), mSkin, [0, 1.52, 0], 'head');
  add(new THREE.SphereGeometry(0.115, 12, 10), mSkin, [0, 1.63, 0.01], 'head');
  add(new THREE.SphereGeometry(0.13, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mHelmet, [0, 1.65, 0], 'head');
  return P;
}

export class Squad {
  constructor(character = 'cool') {
    this.group = new THREE.Group();
    this.count = 0; this.shown = 0; this.t = 0;
    this.pos = new THREE.Vector3(); this.laneX = 0;
    const C = CHARACTERS[character] || CHARACTERS.cool;
    // 병력: 대장과 같은 팀 컬러(조끼)로 통일감
    this.parts = makeParts(0xdcb090, C.cloth, C.vest);
    this.inst = this.parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geo, p.mat, MAX); im.count = 0; im.castShadow = true; im.frustumCulled = false; this.group.add(im); return im;
    });
    this.slots = []; // 대형 위치(대장 뒤 촘촘한 대열)
    for (let i = 0; i < MAX; i++) { const row = Math.floor(i / 8), col = i % 8; const cx = (col - 3.5) * 0.62 + (row % 2) * 0.31; this.slots.push({ x: cx, z: 1.0 + row * 0.66, ph: (i * 0.37) % 1 }); }
    this.leader = buildLeader(character);
    this.group.add(this.leader);
    this.shooting = true;
  }
  setCount(n) { this.count = Math.max(0, Math.round(n)); }
  update(dt, speedFrac = 1) {
    this.t += dt;
    const show = Math.min(MAX, this.count);
    this.shown = show;
    const run = speedFrac > 0.05;
    for (let k = 0; k < this.parts.length; k++) {
      const p = this.parts[k], im = this.inst[k];
      im.count = show;
      for (let i = 0; i < show; i++) {
        const sl = this.slots[i];
        const x = this.pos.x + sl.x * 0.85, z = this.pos.z + sl.z, y = this.pos.y;
        const cyc = (this.t * 9 + sl.ph * Math.PI * 2) % (Math.PI * 2);
        const bob = run ? Math.abs(Math.sin(cyc)) * 0.04 : 0;
        // 뿌리 행렬: 위치 + 진행방향(-z) 바라봄(모델 +z가 앞이므로 180° 회전)
        _q.setFromAxisAngle(_v.set(0, 1, 0), Math.PI);
        _m.compose(_v.set(x, y + bob, z), _q, _s);
        _p.copy(_m).multiply(partLocal(p, cyc, run, this.t, sl.ph));
        im.setMatrixAt(i, _p);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    // 대장(맨 앞 중앙)
    this.leader.position.set(this.pos.x, this.pos.y, this.pos.z - 0.2);
    animateLeader(this.leader, this.t, run);
  }
}

function partLocal(p, cyc, run, t, ph) {
  const [ox, oy, oz] = p.off; let rx = 0, ry = 0, rz = 0, dy = 0, dz = 0;
  const sw = run ? Math.sin(cyc) : 0;
  switch (p.anim) {
    case 'legL': rx = sw * 0.75; dz = sw * 0.05; break;
    case 'legR': rx = -sw * 0.75; dz = -sw * 0.05; break;
    case 'footL': rx = sw * 0.5; dz = sw * 0.22; dy = Math.max(0, sw) * 0.1; break;
    case 'footR': rx = -sw * 0.5; dz = -sw * 0.22; dy = Math.max(0, -sw) * 0.1; break;
    case 'torso': rx = 0.10; break;                    // 앞으로 살짝 숙인 전투 자세
    case 'armL': rx = -1.15; rz = 0.35; break;         // 총열 받침
    case 'armR': rx = -1.05; rz = -0.25; break;
    case 'gun': rx = -0.06 + (run ? Math.sin(cyc * 2) * 0.02 : 0); break;
    case 'head': ry = Math.sin(t * 0.9 + ph) * 0.08; break;
  }
  // 회전 피벗: 다리/팔은 상단 관절 기준이 자연스러움 → 오프셋 후 회전
  const pivotY = (p.anim.startsWith('leg') ? 0.22 : p.anim.startsWith('arm') ? 0.18 : 0);
  _r.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  const local = new THREE.Matrix4().makeTranslation(ox, oy + pivotY + dy, oz + dz).multiply(_r).multiply(new THREE.Matrix4().makeTranslation(0, -pivotY, 0));
  return local;
}

// ---- 대장(풀 디테일): 얼굴·헤어·액세서리·배낭·무전기·무릎보호대 ----
export function buildLeader(character = 'cool') {
  const C = CHARACTERS[character] || CHARACTERS.cool;
  const g = new THREE.Group(); g.userData.parts = {};
  const mSkin = mat(C.skin, { rough: 0.55, normal: skinN }), mCloth = mat(C.cloth, { rough: 0.9, normal: clothN }), mVest = mat(C.vest, { rough: 0.85, normal: clothN });
  const mHair = mat(C.hair, { rough: 0.8 }), mBoot = mat(0x1a1612), mGun = mat(0x1c1d20, { rough: 0.4, metal: 0.6 }), mStrap = mat(0x3a3a30, { rough: 0.9 }), mPad = mat(0x15171a, { rough: 0.6 });
  const big = character === 'hulk';
  const S = big ? 1.12 : 1.0;
  const add = (mesh, name) => { g.add(mesh); if (name) g.userData.parts[name] = mesh; return mesh; };
  const pivot = (mesh, x, y, z) => { const pv = new THREE.Group(); pv.position.set(x, y, z); pv.add(mesh); return pv; };
  // 다리
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08 * S, 0.38, 4, 10), mCloth); leg.position.y = -0.22;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.10), mPad); pad.position.set(0, -0.30, 0.07); leg.add(pad);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.30), mBoot); boot.position.set(0, -0.44, 0.04); leg.add(boot);
    const pv = pivot(leg, sx * 0.12 * S, 0.88, 0); add(pv, sx < 0 ? 'legL' : 'legR');
  }
  // 골반/몸통/조끼/판넬/벨트
  add(new THREE.Mesh(new THREE.BoxGeometry(0.32 * S, 0.2, 0.22), mCloth)).position.y = 0.94;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42 * S, 0.48, 0.26), mCloth); torso.position.y = 1.26; torso.rotation.x = 0.08; add(torso, 'torso');
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.46 * S, 0.36, 0.32), mVest); vest.position.y = 1.28; add(vest);
  for (let i = 0; i < 3; i++) { const mg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.05), mPad); mg.position.set((i - 1) * 0.12, 1.20, 0.19); add(mg); }
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.05), mPad); radio.position.set(-0.18, 1.40, 0.16); add(radio);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44 * S, 0.06, 0.28), mStrap); belt.position.y = 1.02; add(belt);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.16), mStrap); pack.position.set(0, 1.28, -0.20); add(pack);
  // 팔(어깨 피벗) + 손 + 소총
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065 * S, 0.30, 4, 10), mCloth); arm.position.y = -0.17;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), mSkin); hand.position.y = -0.36; arm.add(hand);
    const pv = pivot(arm, sx * 0.29 * S, 1.46, 0.02); pv.rotation.set(sx < 0 ? -1.2 : -1.05, 0, sx * 0.3); add(pv, sx < 0 ? 'armL' : 'armR');
  }
  const gun = new THREE.Group();
  gun.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.62), mGun));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), mGun); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, 0.46); gun.add(barrel);
  const magz = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), mGun); magz.position.set(0, -0.12, 0.06); gun.add(magz);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.22), mPad); stock.position.set(0, -0.02, -0.38); gun.add(stock);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), mGun); scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.09, 0.05); gun.add(scope);
  gun.position.set(0.06, 1.22, 0.40); add(gun, 'gun');
  // 목·머리·얼굴
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.09, 10), mSkin)).position.y = 1.55;
  const head = new THREE.Group(); head.position.y = 1.67;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), mSkin));
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 12), mSkin); jaw.scale.set(0.95, 0.8, 0.9); jaw.position.set(0, -0.06, 0.01); head.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 8), mSkin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.01, 0.13); head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), mat(0xf4f4f4, { rough: 0.3 })); eye.position.set(sx * 0.045, 0.02, 0.11); head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), mat(0x1a1410)); pupil.position.set(sx * 0.045, 0.02, 0.126); head.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.008, 0.01), mHair); brow.position.set(sx * 0.045, 0.05, 0.115); head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.01), mat(0x6a3a30)); mouth.position.set(0, -0.055, 0.115); head.add(mouth);
  // 캐릭터별 액세서리
  if (character === 'cool') { const sg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.03), mat(0x0a0a0a, { rough: 0.2, metal: 0.4 })); sg.position.set(0, 0.025, 0.115); head.add(sg); }
  if (character === 'bearded') { const bd = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), mHair); bd.scale.set(1.05, 0.75, 0.75); bd.position.set(0, -0.075, 0.045); head.add(bd); }
  if (character === 'princess') { const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), mHair); tail.position.set(0, -0.06, -0.14); tail.rotation.x = 0.5; head.add(tail); }
  // 헬멧(헐크는 반다나)
  if (big) { const bandana = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(0x2f4a2e)); bandana.position.y = 0.02; head.add(bandana); }
  else { const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x6d6a55, { rough: 0.55, metal: 0.05 })); helmet.position.y = 0.02; head.add(helmet);
         const strap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 20), mStrap); strap.rotation.x = Math.PI / 2; strap.position.y = -0.02; head.add(strap); }
  // 헤드셋(프린세스)
  if (character === 'princess') { const hs = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 20, Math.PI), mPad); hs.rotation.z = Math.PI; hs.position.y = 0.06; head.add(hs); }
  add(head, 'head');
  g.scale.setScalar(S);
  g.rotation.y = Math.PI;   // 전방(-z) 바라봄
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}

export function animateLeader(g, t, run) {
  const P = g.userData.parts; const cyc = t * 9; const sw = run ? Math.sin(cyc) : 0;
  P.legL.rotation.x = sw * 0.8; P.legR.rotation.x = -sw * 0.8;
  P.torso.rotation.x = 0.08 + (run ? Math.abs(Math.sin(cyc)) * 0.03 : 0);
  P.head.rotation.y = Math.sin(t * 0.7) * 0.15;
  g.position.y += run ? Math.abs(Math.sin(cyc)) * 0.04 : 0;
  P.gun.rotation.x = run ? Math.sin(cyc * 2) * 0.02 : 0;
}
