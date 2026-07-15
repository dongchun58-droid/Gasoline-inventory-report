// obstacles.js — 도로를 횡단하는 큰 젖소 (마리오카트 무무 목장 오마주, 오리지널)
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _md = new THREE.Vector3(); // 이동방향
const _rt = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function buildCow(gm) {
  const g = new THREE.Group();
  const toon = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.0 });
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

// 불덩이 (성 맵 장애물) — 발광 코어 + 반투명 화염
function buildFireball() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, toneMapped: false }));
  g.add(core);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff5a1e, transparent: true, opacity: 0.55, toneMapped: false }));
  g.add(flame);
  const outer = new THREE.Mesh(new THREE.SphereGeometry(2.0, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff2a08, transparent: true, opacity: 0.28, toneMapped: false }));
  g.add(outer);
  g.userData.core = core; g.userData.flame = flame; g.userData.outer = outer;
  g.position.y = 1.6;
  g.scale.setScalar(1.6);
  return g;
}

// 굴러다니는 거대 눈덩이 (얼음 왕국) — 흰 구 + 파랑 얼룩
function buildSnowball() {
  const g = new THREE.Group();
  const snow = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.85, metalness: 0.0 });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), snow);
  g.add(ball);
  for (let k = 0; k < 8; k++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.28 + (k % 3) * 0.1, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.8 }));
    const a = k * 0.9, r = 1.5;
    s.position.set(Math.cos(a) * r, Math.sin(a * 1.7) * 0.9, Math.sin(a) * r);
    g.add(s);
  }
  g.userData.ball = ball;
  g.position.y = 1.6;
  g.scale.setScalar(1.9);
  return g;
}

export class Obstacles {
  constructor(track, gm, theme = 'cow') {
    this.track = track;
    this.theme = theme;
    this.group = new THREE.Group();
    this.cows = []; // (장애물 배열 — 테마 무관하게 재사용)
    this._t = 0;
    const N = track.samplePos.length;
    for (const [t, phase] of [[0.45, 0], [0.80, 1.7]]) {
      const i0 = Math.floor(t * N) % N;
      const mesh = theme === 'fireball' ? buildFireball() : theme === 'snowball' ? buildSnowball() : buildCow(gm);
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
      const lift = this.theme === 'fireball' ? 1.8 : this.theme === 'snowball' ? 3.0 : 0;
      cow.mesh.position.copy(p).addScaledVector(lat, offset).addScaledVector(up, lift);
      if (this.theme === 'fireball') {
        // 불덩이: 공중 부유 + 화염 점멸/회전
        cow.mesh.position.y += Math.sin(this._t * 3 + cow.phase) * 0.4;
        cow.mesh.rotation.y += dt * 2.2;
        const ud = cow.mesh.userData;
        const fl = 0.7 + 0.3 * Math.abs(Math.sin(this._t * 14 + cow.phase));
        if (ud.flame) { ud.flame.scale.setScalar(1 + fl * 0.25); ud.flame.material.opacity = 0.4 + fl * 0.3; }
        if (ud.outer) { ud.outer.scale.setScalar(1 + fl * 0.15); }
      } else if (this.theme === 'snowball') {
        // 굴러가는 눈덩이: 이동 방향으로 구르기
        const dir = moving >= 0 ? 1 : -1;
        const b = cow.mesh.userData.ball;
        if (b) b.rotation.z -= dir * dt * 3.2;
        cow.mesh.rotation.z -= dir * dt * 3.2;
      } else {
        // 이동방향(±lat)으로 몸을 향하게
        _md.copy(lat).multiplyScalar(moving >= 0 ? 1 : -1);
        _rt.copy(_up).cross(_md).normalize();
        _m.makeBasis(_rt, _up, _md);
        cow.mesh.quaternion.setFromRotationMatrix(_m);
        // 걷는 흔들림(높이만)
        cow.mesh.position.y += Math.abs(Math.sin(this._t * 6)) * 0.06;
      }

      // 충돌: 스치면 잠깐 스핀 (공중이면 회피)
      for (const k of karts) {
        if (k.airborne || k.bulletTimer > 0 || k.invincTimer > 0) continue;
        if (k.pos.distanceToSquared(cow.mesh.position) < 26) k.spinOut(0.9);
      }
    }
  }
}
