// kart.js — 차량 물리 + 프로시저럴 카트 모델
// Phase 1: §5 주행 물리(가속/브레이크/드래그/조향/접지정렬/중력낙하/리스폰)
import * as THREE from 'three';

// §5 물리 상수 (스펙 그대로)
export const PHYS = {
  maxSpeed: 28,
  boostMultiplier: 1.35,
  accel: 18,
  brake: 30,
  drag: 8,
  reverseMax: 8,
  turnRateLow: 2.4,
  turnRateHigh: 1.3,
  gravity: 22,
};

// 임시 벡터 (모듈 스코프 재사용 — 매 프레임 GC 금지)
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _ground = {};

// 프로시저럴 카트 모델 (~primitive 조합)
function buildKartModel(color, gradientMap) {
  const g = new THREE.Group();
  const toon = (c, emissive = 0x000000, emIntensity = 0) =>
    new THREE.MeshToonMaterial({ color: c, gradientMap, emissive, emissiveIntensity: emIntensity });

  // 바디 (라운드박스 대용: 살짝 눌린 박스)
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), toon(color));
  body.position.y = 0.45;
  g.add(body);

  // 노즈콘
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 6), toon(color));
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.42, 1.4);
  g.add(nose);

  // 리어윙 (박스 + 기둥 2)
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.5), toon(0x1a1a2a));
  wing.position.set(0, 0.95, -1.1);
  g.add(wing);
  for (const sx of [-0.6, 0.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), toon(0x1a1a2a));
    post.position.set(sx, 0.72, -1.1);
    g.add(post);
  }

  // 드라이버: 캡슐 몸통 + 구 헬멧
  const bodyDriver = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.35, 4, 8), toon(0x22243a));
  bodyDriver.position.set(0, 0.85, -0.1);
  g.add(bodyDriver);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), toon(color));
  helmet.position.set(0, 1.15, -0.05);
  g.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.12),
    toon(0x001018, 0x00e5ff, 1.4)
  );
  visor.position.set(0, 1.16, 0.18);
  g.add(visor);
  g.userData.driver = bodyDriver;
  g.userData.helmet = helmet;

  // 배기관 2 (부스트 화염 방출구 — Phase 2+)
  for (const sx of [-0.35, 0.35]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.4, 8), toon(0x555566));
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(sx, 0.5, -1.25);
    g.add(pipe);
  }

  // 휠 4 (토러스) — 조향/서스펜션/회전 반영
  const wheelGeo = new THREE.TorusGeometry(0.34, 0.16, 8, 14);
  const wheelMat = toon(0x111119);
  const wheels = [];
  const wpos = [
    [-0.82, 0.34, 1.0, true],   // FL (조향)
    [0.82, 0.34, 1.0, true],    // FR
    [-0.82, 0.34, -0.95, false],// RL
    [0.82, 0.34, -0.95, false], // RR
  ];
  for (const [x, y, z, steer] of wpos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.y = Math.PI / 2; // 토러스 면을 옆으로
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.add(w);
    pivot.userData.steer = steer;
    pivot.userData.spin = w; // 회전은 자식 메시에
    g.add(pivot);
    wheels.push(pivot);
  }
  g.userData.wheels = wheels;

  return g;
}

// 블롭 섀도 스프라이트
function makeBlobShadow() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export class Kart {
  constructor(track, color, gradientMap) {
    this.track = track;
    this.color = color;

    this.model = buildKartModel(color, gradientMap);
    this.shadow = makeBlobShadow();

    // 상태
    this.pos = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1); // 진행 방향(도로 평면 투영)
    this.speed = 0;
    this.vertVel = 0;      // 수직 속도(낙하/점프)
    this.airborne = false;
    this.idx = 0;          // 최근 도로 샘플 인덱스
    this.steerVis = 0;     // 시각용 조향각 (스무딩)
    this.wheelSpin = 0;    // 휠 회전 누적
    this.fallTimer = 0;

    this.resetToStart();
  }

  resetToStart(offsetLat = 0, offsetBack = 0) {
    const s = this.track.startInfo();
    this.pos.copy(s.pos)
      .addScaledVector(s.lat, offsetLat)
      .addScaledVector(s.tan, -offsetBack)
      .addScaledVector(s.up, 0.1);
    this.forward.copy(s.tan);
    this.speed = 0;
    this.vertVel = 0;
    this.airborne = false;
    this.fallTimer = 0;
    this.idx = 0;
    this._syncMesh();
  }

  respawn() {
    // 최근 샘플 지점으로 속도 0 리스폰 (Phase 3에서 체크포인트로 교체)
    const i = this.idx;
    const sp = this.track.samplePos[i];
    const tan = this.track.sampleTan[i];
    const up = this.track.sampleUp[i];
    this.pos.copy(sp).addScaledVector(up, 0.1);
    this.forward.copy(tan);
    this.speed = 0;
    this.vertVel = 0;
    this.airborne = false;
    this.fallTimer = 0;
  }

  // 고정 dt 물리 스텝
  step(dt, input) {
    // --- 종방향 (가속/브레이크/드래그) ---
    const throttle = input.accel;
    const braking = input.brake;

    if (throttle) {
      // v가 max에 가까울수록 지수 감쇠
      const room = Math.max(0, 1 - this.speed / PHYS.maxSpeed);
      this.speed += PHYS.accel * room * dt;
    } else if (braking) {
      if (this.speed > 0) {
        this.speed -= PHYS.brake * dt;
        if (this.speed < 0) this.speed = 0;
      } else {
        // 후진
        this.speed -= PHYS.accel * 0.6 * dt;
        if (this.speed < -PHYS.reverseMax) this.speed = -PHYS.reverseMax;
      }
    } else {
      // 드래그
      if (this.speed > 0) {
        this.speed -= PHYS.drag * dt;
        if (this.speed < 0) this.speed = 0;
      } else if (this.speed < 0) {
        this.speed += PHYS.drag * dt;
        if (this.speed > 0) this.speed = 0;
      }
    }
    if (this.speed > PHYS.maxSpeed) this.speed = PHYS.maxSpeed;

    // --- 조향 (속도 비례 선회율) ---
    const steer = input.steer;
    const speedFrac = Math.min(1, Math.abs(this.speed) / PHYS.maxSpeed);
    const turnRate = THREE.MathUtils.lerp(PHYS.turnRateLow, PHYS.turnRateHigh, speedFrac);
    // 저속에선 조향 효과 감소(정지 시 제자리 회전 방지)
    const steerAuthority = Math.min(1, Math.abs(this.speed) / 3);
    if (steer !== 0) {
      const dir = this.speed >= 0 ? 1 : -1;
      const ang = -steer * turnRate * steerAuthority * dir * dt;
      _q.setFromAxisAngle(_up, ang); // 수평 회전(도로 정렬은 아래에서)
      this.forward.applyQuaternion(_q);
    }
    // 시각 조향각 스무딩
    this.steerVis = THREE.MathUtils.lerp(this.steerVis, steer, 0.25);

    // --- 이동 ---
    _fwd.copy(this.forward);
    _fwd.y = 0;
    if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
    this.pos.addScaledVector(_fwd, this.speed * dt);

    // --- 접지/낙하 ---
    const g = this.track.ground(this.pos, this.idx, _ground);
    this.idx = g.idx;

    if (this.airborne) {
      this.vertVel -= PHYS.gravity * dt;
      this.pos.y += this.vertVel * dt;
      // 도로면에 도달하면 착지
      if (g.onRoad && this.pos.y <= g.height + 0.1 && this.vertVel <= 0) {
        this.pos.y = g.height + 0.1;
        this.vertVel = 0;
        this.airborne = false;
      }
      // 너무 아래로 떨어지면 리스폰
      if (this.pos.y < g.height - 12) {
        this.fallTimer += dt;
        this.respawn();
      }
    } else {
      if (g.onRoad) {
        // 도로 위: 표면에 부드럽게 스냅
        this.pos.y = THREE.MathUtils.lerp(this.pos.y, g.height + 0.1, 0.5);
        // forward를 도로 접선 평면에 재투영 (경사 대응)
        _tmp.copy(this.forward).addScaledVector(g.up, -this.forward.dot(g.up));
        if (_tmp.lengthSq() > 1e-6) this.forward.copy(_tmp).normalize();
      } else {
        // 도로 밖 → 낙하 시작
        this.airborne = true;
        this.vertVel = 0;
      }
    }

    // --- 휠 회전 누적 ---
    this.wheelSpin += (this.speed / 0.34) * dt; // v / r

    this._syncMesh(g);
  }

  _syncMesh(g) {
    // 위치
    this.model.position.copy(this.pos);

    // 방향: forward + 도로 up으로 기저 구성
    _fwd.copy(this.forward);
    const up = (g && g.onRoad) ? g.up : _up;
    _fwd.addScaledVector(up, -_fwd.dot(up));
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();
    _right.copy(_fwd).cross(up).normalize();
    _tmp.copy(_right).cross(_fwd).normalize(); // 재직교 up
    // 모델의 +Z가 전방이 되도록 기저 배치
    _m.makeBasis(_right, _tmp, _fwd);
    this.model.quaternion.setFromRotationMatrix(_m);

    // 그림자: 도로면 바로 위
    if (g) {
      this.shadow.position.set(this.pos.x, g.height + 0.03, this.pos.z);
    } else {
      this.shadow.position.set(this.pos.x, this.pos.y - 0.35, this.pos.z);
    }
    const airFade = this.airborne ? Math.max(0.15, 1 - Math.abs(this.pos.y - this.shadow.position.y) / 4) : 1;
    this.shadow.material.opacity = 0.55 * airFade;

    // 휠: 조향 + 서스펜션 바운스 + 회전
    const wheels = this.model.userData.wheels;
    const bounce = Math.sin(this.wheelSpin * 2) * 0.02 * Math.min(1, Math.abs(this.speed) / 10);
    for (const pivot of wheels) {
      if (pivot.userData.steer) {
        pivot.rotation.y = this.steerVis * 0.5;
      }
      pivot.position.y = 0.34 + bounce;
      pivot.userData.spin.rotation.x = this.wheelSpin;
    }

    // 드라이버 살짝 기울임 (조향 방향)
    if (this.model.userData.driver) {
      const lean = -this.steerVis * 0.18;
      this.model.userData.driver.rotation.z = lean;
      this.model.userData.helmet.rotation.z = lean;
    }
  }

  // §5: maxSpeed 28 m/s ≈ 체감 100km/h
  get kmh() { return Math.round(Math.abs(this.speed) * (100 / PHYS.maxSpeed)); }
}
