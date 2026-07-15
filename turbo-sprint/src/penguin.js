// penguin.js — 얼음 왕국 방해꾼: 큰 펭귄이 옆에서 배로 미끄러지며 튀어나온다
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _kxz = new THREE.Vector3();

// 큰 펭귄(배쓸매 슬라이드 자세, 오리지널 카툰)
function buildPenguin() {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.55 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff9a2e, roughness: 0.5 });
  const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const eyeB = new THREE.MeshBasicMaterial({ color: 0x101018 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xffb0c0, roughness: 0.6 });

  // 몸통(엎드린 자세: +Z가 슬라이드 진행방향, 배가 바닥) — 앞으로 길쭉하게
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 14), black);
  body.scale.set(1.05, 0.9, 1.5); body.position.set(0, 0.9, -0.2); g.add(body);
  // 흰 배(아래 앞쪽)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), white);
  belly.scale.set(0.9, 0.7, 1.35); belly.position.set(0, 0.62, 0.15); g.add(belly);
  // 머리(앞으로 든)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 14), black);
  head.position.set(0, 1.5, 1.15); g.add(head);
  const faceW = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 12), white);
  faceW.scale.set(0.9, 0.9, 0.6); faceW.position.set(0, 1.4, 1.55); g.add(faceW);
  // 부리
  const beakU = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8), orange);
  beakU.rotation.x = Math.PI / 2; beakU.position.set(0, 1.42, 1.95); g.add(beakU);
  const beakL = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), orange);
  beakL.rotation.x = Math.PI / 2; beakL.position.set(0, 1.24, 1.9); g.add(beakL);
  // 눈(놀란 큰 눈)
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), eyeW);
    w.position.set(sx * 0.3, 1.66, 1.62); g.add(w);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), eyeB);
    pupil.position.set(sx * 0.32, 1.64, 1.78); g.add(pupil);
    // 볼 홍조
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), pink);
    ch.scale.set(1, 0.7, 0.4); ch.position.set(sx * 0.5, 1.34, 1.66); g.add(ch);
  }
  // 날개(양옆으로 뻗어 슬라이드)
  for (const sx of [-1, 1]) {
    const flip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 1.5), black);
    flip.position.set(sx * 1.35, 0.75, -0.1); flip.rotation.z = sx * 0.5; flip.rotation.x = 0.3; g.add(flip);
  }
  // 발(뒤로 뻗음)
  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.8), orange);
    foot.position.set(sx * 0.5, 0.25, -1.5); g.add(foot);
  }
  g.scale.setScalar(1.7);
  return g;
}

export class Penguins {
  constructor(track, spots = [0.08, 0.5], sides = [1, -1]) {
    this.track = track;
    this.group = new THREE.Group();
    this._t = 0;
    this.penguins = [];
    const N = track.samplePos.length;
    spots.forEach((t, k) => {
      const i0 = Math.floor(((t % 1) + 1) % 1 * N) % N;
      const side = sides[k % sides.length];
      const hw = track.sampleHalf ? track.sampleHalf[i0] : track.halfWidth;
      const model = buildPenguin();
      this.group.add(model);
      this.penguins.push({ i0, side, model, hw, phase: (k * 0.5) % 1, P: 3.8, hit: false });
    });
  }

  update(dt, karts) {
    this._t += dt;
    const t = this.track;
    for (const d of this.penguins) {
      const p = t.samplePos[d.i0], lat = t.sampleLat[d.i0], up = t.sampleUp[d.i0], tan = t.sampleTan[d.i0];
      // 사이클: 대기(옆) → 슬라이드 인(도로 가로질러) → 복귀
      const cyc = ((this._t / d.P) + d.phase) % 1;
      // out: 0(옆 대기) ~ 1(도로 중앙 넘어감)
      let out;
      if (cyc < 0.5) out = 0.5 * (1 - Math.cos((cyc / 0.5) * Math.PI));   // 0→1 미끄러져 나옴
      else out = 0.5 * (1 + Math.cos(((cyc - 0.5) / 0.5) * Math.PI));      // 1→0 복귀
      const restLat = d.side * (d.hw + 6);       // 도로 밖 대기 위치
      const crossLat = -d.side * (d.hw * 0.5);   // 도로 중앙 살짝 넘어까지
      const curLat = restLat + (crossLat - restLat) * out;
      _pos.copy(p).addScaledVector(lat, curLat).addScaledVector(up, 0.05);
      d.model.position.copy(_pos);
      // 슬라이드 방향(-side*lat)을 바라보게 + 미끄러지는 좌우 흔들림
      const slideDir = _kxz.copy(lat).multiplyScalar(-d.side).addScaledVector(tan, 0.15).normalize();
      const right = new THREE.Vector3().copy(up).cross(slideDir).normalize();
      _m.makeBasis(right, up, slideDir);
      d.model.quaternion.setFromRotationMatrix(_m);
      d.model.rotation.z += Math.sin(this._t * 12 + d.phase) * 0.04;
      // 살짝 통통 튀는 슬라이드
      d.model.position.addScaledVector(up, Math.abs(Math.sin(this._t * 9)) * 0.15 * out);

      // 충돌: 도로에 나와 있을 때(out>0.25) 스치면 스핀아웃
      if (out > 0.25) {
        for (const k of karts) {
          if (k.airborne || k.bulletTimer > 0 || k.invincTimer > 0) continue;
          _kxz.copy(k.pos); _kxz.y = _pos.y;
          if (_kxz.distanceToSquared(_pos) < 20) k.spinOut(1.0);
        }
      }
    }
  }
}
