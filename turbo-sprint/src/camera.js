// camera.js — 체이스캠 + 속도비례 FOV
// §8: 뒤 5.5m / 높이 2.4m / 주시점 앞 4m, 스프링 추적, FOV 60→72(→부스트 80)
import * as THREE from 'three';
import { PHYS } from './kart.js';

const BACK = 5.5;
const HEIGHT = 2.4;
const LOOK_AHEAD = 4;
const SPRING = 0.12; // 0.10~0.14

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    this._lookTarget = new THREE.Vector3();
    this._inited = false;
  }

  // kart: Kart 인스턴스, dt: 렌더 dt
  update(kart, dt, boosting = false) {
    _fwd.copy(kart.forward); _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();

    // 목표 카메라 위치: 카트 뒤 + 위
    _desired.copy(kart.pos)
      .addScaledVector(_fwd, -BACK)
      .addScaledVector(_up, HEIGHT);

    // 주시점: 카트 앞 4m
    _look.copy(kart.pos).addScaledVector(_fwd, LOOK_AHEAD).addScaledVector(_up, 0.6);

    if (!this._inited) {
      this.camera.position.copy(_desired);
      this._lookTarget.copy(_look);
      this._inited = true;
    } else {
      // 프레임레이트 독립 스프링
      const a = 1 - Math.pow(1 - SPRING, dt * 60);
      this.camera.position.lerp(_desired, a);
      this._lookTarget.lerp(_look, Math.min(1, a * 1.4));
    }
    this.camera.lookAt(this._lookTarget);

    // FOV: 속도 비례 60→72, 부스트 80
    const speedFrac = Math.min(1, Math.abs(kart.speed) / PHYS.maxSpeed);
    let targetFov = 60 + speedFrac * 12;
    if (boosting) targetFov = 80;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
    this.camera.updateProjectionMatrix();
  }

  snap(kart) { this._inited = false; this.update(kart, 1 / 60); }
}
