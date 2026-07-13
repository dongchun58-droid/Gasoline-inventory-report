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

  // --- 귀여운 오리지널 마스코트 드라이버 (그룹으로 묶어 코너에서 기울임) ---
  const driver = new THREE.Group();
  driver.position.set(0, 0.55, -0.05);
  const skin = 0xffcba4;      // 살구색 피부
  const overalls = 0xff4d4d;  // 밝은 빨강 멜빵바지
  const shirt = 0x36d1ff;     // 하늘색 셔츠

  // 몸통 (멜빵바지)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.22, 4, 10), toon(overalls));
  torso.position.set(0, 0.32, 0);
  driver.add(torso);
  // 셔츠 어깨(위쪽 살짝)
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), toon(shirt));
  shoulders.scale.set(1, 0.55, 0.9);
  shoulders.position.set(0, 0.5, 0);
  driver.add(shoulders);

  // 머리
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 18, 14), toon(skin));
  head.position.set(0, 0.86, 0.02);
  driver.add(head);
  // 큰 코
  const noseFace = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), toon(0xffb98f));
  noseFace.position.set(0, 0.84, 0.30);
  driver.add(noseFace);
  // 눈 (흰자 + 눈동자)
  for (const sx of [-0.12, 0.12]) {
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), toon(0xffffff));
    eyeW.scale.set(0.8, 1.1, 0.6);
    eyeW.position.set(sx, 0.92, 0.24);
    driver.add(eyeW);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), toon(0x1a1030));
    pupil.position.set(sx, 0.92, 0.30);
    driver.add(pupil);
  }
  // 발그레한 볼
  for (const sx of [-0.20, 0.20]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), toon(0xff8fb0));
    cheek.scale.set(1, 0.7, 0.5);
    cheek.position.set(sx, 0.80, 0.22);
    driver.add(cheek);
  }
  // 모자 (팀 컬러) — 크라운 + 챙
  const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(color));
  capCrown.position.set(0, 1.02, 0.02);
  driver.add(capCrown);
  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.06, 16), toon(0xffffff));
  capBand.position.set(0, 1.0, 0.02);
  driver.add(capBand);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 12, 1, false, 0, Math.PI), toon(color));
  brim.rotation.y = Math.PI; // 앞쪽 반원
  brim.position.set(0, 1.0, 0.28);
  driver.add(brim);
  // 모자 엠블럼(에미시브 별 느낌 원)
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), toon(0xffffff, 0xffd166, 1.6));
  emblem.position.set(0, 1.06, 0.30);
  driver.add(emblem);

  // 팔 + 핸들 잡은 손
  for (const sx of [-0.24, 0.24]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 8), toon(shirt));
    arm.position.set(sx, 0.34, 0.28);
    arm.rotation.x = 0.9; // 앞으로 뻗음
    driver.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toon(0xfff0d0));
    hand.position.set(sx * 0.75, 0.22, 0.52);
    driver.add(hand);
  }
  // 스티어링 휠
  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 16), toon(0x222230));
  steerWheel.position.set(0, 0.2, 0.55);
  steerWheel.rotation.x = 1.1;
  driver.add(steerWheel);

  g.add(driver);
  g.userData.driver = driver;
  g.userData.head = head;

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

    // 아이템/부스트 상태
    this.boostTimer = 0;   // >0 이면 부스트 중
    this.spinTimer = 0;    // >0 이면 스핀아웃(조작 불가)
    this.spinAngle = 0;    // 스핀 시각 회전 누적
    this.invincTimer = 0;  // >0 이면 무적(별)

    // 아이템 보유
    this.heldItem = null;  // 'mushroom' | 'star' | 'rocket' | null
    this.aiUseTimer = 0;   // AI 아이템 사용 딜레이

    // 레이스 진행
    this.lap = 0;
    this.progress = 0;     // lap + t (순위 계산용)
    this.finished = false;
    this.finishTime = 0;

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

  // 부스트/스핀/무적 트리거
  giveBoost(t) { this.boostTimer = Math.max(this.boostTimer, t); }
  spinOut(t) {
    if (this.invincTimer > 0 || this.spinTimer > 0) return false;
    this.spinTimer = t;
    this.speed *= 0.4;
    this.boostTimer = 0;
    return true;
  }
  setInvincible(t) { this.invincTimer = Math.max(this.invincTimer, t); this.giveBoost(t); }
  get boosting() { return this.boostTimer > 0; }

  // 고정 dt 물리 스텝
  step(dt, input) {
    // 타이머 감소
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.invincTimer > 0) this.invincTimer -= dt;

    // --- 스핀아웃 중: 조작 불가, 제자리 회전 연출 ---
    if (this.spinTimer > 0) {
      this.spinTimer -= dt;
      this.spinAngle += 12 * dt;
      // 감속(드래그)
      this.speed -= PHYS.drag * 1.5 * dt;
      if (this.speed < 0) this.speed = 0;
      _fwd.copy(this.forward); _fwd.y = 0;
      if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
      this.pos.addScaledVector(_fwd, this.speed * dt);
      const gS = this.track.ground(this.pos, this.idx, _ground);
      this.idx = gS.idx;
      if (gS.onRoad) this.pos.y = THREE.MathUtils.lerp(this.pos.y, gS.height + 0.1, 0.5);
      this.wheelSpin += (this.speed / 0.34) * dt;
      this._syncMesh(gS);
      return;
    }
    this.spinAngle = 0;

    const boosting = this.boostTimer > 0;
    const effMax = boosting ? PHYS.maxSpeed * PHYS.boostMultiplier : PHYS.maxSpeed;

    // --- 종방향 (가속/브레이크/드래그) ---
    const throttle = input.accel || boosting;
    const braking = input.brake && !boosting;

    if (throttle) {
      // v가 max에 가까울수록 지수 감쇠 (부스트 중엔 강하게 밀어붙임)
      const room = Math.max(0, 1 - this.speed / effMax);
      const push = boosting ? Math.max(room, 0.4) * 2.2 : room;
      this.speed += PHYS.accel * push * dt;
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
    if (this.speed > effMax) this.speed = effMax;

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
    // 오른손 좌표계: right = up × forward, up = forward × right
    // (이전엔 forward × up 이라 반사행렬이 되어 카트가 옆으로 향했음)
    _right.copy(up).cross(_fwd).normalize();
    _tmp.copy(_fwd).cross(_right).normalize(); // 재직교 up
    // 모델의 +Z가 전방이 되도록 기저 배치
    _m.makeBasis(_right, _tmp, _fwd);
    this.model.quaternion.setFromRotationMatrix(_m);
    // 스핀아웃 시각 회전
    if (this.spinAngle > 0) {
      _q.setFromAxisAngle(_tmp, this.spinAngle);
      this.model.quaternion.premultiply(_q);
    }
    // 무적(별): 반짝 스케일 펄스
    const pulse = this.invincTimer > 0 ? 1 + Math.sin(this.invincTimer * 30) * 0.08 : 1;
    this.model.scale.setScalar(pulse);

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

    // 드라이버 그룹을 조향 방향으로 기울임 + 머리 살짝 반대 카운터
    if (this.model.userData.driver) {
      const lean = -this.steerVis * 0.22;
      this.model.userData.driver.rotation.z = lean;
      if (this.model.userData.head) {
        this.model.userData.head.rotation.z = -lean * 0.4;
      }
    }
  }

  // §5: maxSpeed 28 m/s ≈ 체감 100km/h
  get kmh() { return Math.round(Math.abs(this.speed) * (100 / PHYS.maxSpeed)); }
}
