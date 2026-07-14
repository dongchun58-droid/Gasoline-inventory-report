// obstacles.js — 도로를 횡단하는 큰 젖소 (마리오카트 무무 목장 오마주, 오리지널)
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _md = new THREE.Vector3(); // 이동방향
const _rt = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function buildCow(gm) {
  const g = new THREE.Group();
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gm });
  const white = toon(0xf4f4ef), dark = toon(0x2a2a30), pink = toon(0xffb0bf), hoof = toon(0x333338);
  // 몸통(+Z가 앞)
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.25, 2.3), white);
  body.position.y = 1.35; g.add(body);
  // 얼룩
  for (const [x, y, z, s] of [[0.4, 1.6, 0.4, 0.5], [-0.5, 1.2, -0.3, 0.6], [0.3, 1.1, -0.8, 0.4]]) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), dark);
    spot.scale.set(1, 0.7, 1); spot.position.set(x, y, z); g.add(spot);
  }
  // 머리 + 주둥이
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), white);
  head.position.set(0, 1.55, 1.35); g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.35), pink);
  snout.position.set(0, 1.4, 1.75); g.add(snout);
  // 뿔·귀
  for (const sx of [-0.32, 0.32]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.16), white);
    ear.position.set(sx, 1.8, 1.3); g.add(ear);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), toon(0xe8e0c8));
    horn.position.set(sx * 0.5, 1.98, 1.3); g.add(horn);
  }
  // 다리
  for (const sx of [-0.45, 0.45]) for (const sz of [0.75, -0.75]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 8), hoof);
    leg.position.set(sx, 0.7, sz); g.add(leg);
  }
  g.scale.setScalar(2.2); // 2배 크게
  return g;
}

export class Obstacles {
  constructor(track, gm) {
    this.track = track;
    this.group = new THREE.Group();
    this.cows = [];
    this._t = 0;
    const N = track.samplePos.length;
    for (const [t, phase] of [[0.45, 0], [0.80, 1.7]]) {
      const i0 = Math.floor(t * N) % N;
      const mesh = buildCow(gm);
      this.group.add(mesh);
      this.cows.push({ i0, phase, mesh });
    }
  }

  update(dt, karts) {
    this._t += dt;
    const t = this.track;
    const range = t.halfWidth + 2.5;
    for (const cow of this.cows) {
      const i0 = cow.i0;
      const p = t.samplePos[i0], lat = t.sampleLat[i0], up = t.sampleUp[i0];
      const phase = this._t * 0.5 + cow.phase;
      const offset = Math.sin(phase) * range;
      const moving = Math.cos(phase); // 이동 방향 부호
      cow.mesh.position.copy(p).addScaledVector(lat, offset).addScaledVector(up, 0);
      // 이동방향(±lat)으로 몸을 향하게
      _md.copy(lat).multiplyScalar(moving >= 0 ? 1 : -1);
      _rt.copy(_up).cross(_md).normalize();
      _m.makeBasis(_rt, _up, _md);
      cow.mesh.quaternion.setFromRotationMatrix(_m);
      // 걷는 흔들림(높이만)
      cow.mesh.position.y += Math.abs(Math.sin(this._t * 6)) * 0.06;

      // 충돌: 스치면 잠깐 스핀 (공중이면 회피)
      for (const k of karts) {
        if (k.airborne || k.bulletTimer > 0 || k.invincTimer > 0) continue;
        if (k.pos.distanceToSquared(cow.mesh.position) < 26) k.spinOut(0.9);
      }
    }
  }
}
