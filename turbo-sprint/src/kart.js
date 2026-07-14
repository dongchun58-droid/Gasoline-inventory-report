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

  // --- 귀여운 카툰 아기 드라이버 (큰 머리·볼·눈 / 오리지널) ---
  const driver = new THREE.Group();
  driver.position.set(0, 0.5, -0.05);
  const skin = 0xffd8b8;      // 아기 피부톤
  const romper = color;       // 팀 컬러 우주복
  const shirt = 0xfff4e6;     // 크림색

  // 몸통 (작고 통통한 우주복)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.14, 4, 10), toon(romper));
  torso.position.set(0, 0.3, 0);
  driver.add(torso);
  const collar = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), toon(shirt));
  collar.scale.set(1, 0.5, 0.95);
  collar.position.set(0, 0.46, 0);
  driver.add(collar);

  // 큰 머리
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), toon(skin));
  head.position.set(0, 0.86, 0.03);
  driver.add(head);
  // 배냇머리 한 가닥 (곱슬 컬)
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 14, Math.PI * 1.6), toon(0x6b4a2a));
  curl.position.set(0, 1.22, 0.05);
  curl.rotation.z = 0.4;
  driver.add(curl);
  // 큰 눈 (흰자 + 큰 눈동자 + 반짝 하이라이트)
  for (const sx of [-0.15, 0.15]) {
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), toon(0xffffff));
    eyeW.scale.set(0.85, 1.05, 0.55);
    eyeW.position.set(sx, 0.9, 0.3);
    driver.add(eyeW);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), toon(0x201828));
    pupil.position.set(sx, 0.89, 0.37);
    driver.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), toon(0xffffff, 0xffffff, 1.2));
    glint.position.set(sx + 0.02, 0.93, 0.42);
    driver.add(glint);
  }
  // 통통 볼
  for (const sx of [-0.26, 0.26]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon(0xffa9c7));
    cheek.scale.set(1, 0.8, 0.5);
    cheek.position.set(sx, 0.76, 0.26);
    driver.add(cheek);
  }
  // 작은 코
  const noseFace = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), toon(0xffc59e));
  noseFace.position.set(0, 0.82, 0.4);
  driver.add(noseFace);
  // 쪽쪽이(공갈젖꼭지)
  const paci = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 8, 14), toon(0xff8fb0, 0xff8fb0, 0.2));
  paci.position.set(0, 0.7, 0.4);
  driver.add(paci);
  const paciNub = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), toon(0xffe08a));
  paciNub.position.set(0, 0.7, 0.36);
  driver.add(paciNub);
  // 팀 컬러 보닛(작은 모자, 뒤통수쪽)
  const bonnet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), toon(color));
  bonnet.position.set(0, 0.92, -0.02);
  driver.add(bonnet);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(0xffffff));
  pom.position.set(0, 1.24, -0.05);
  driver.add(pom);

  // 팔 + 핸들 잡은 손 (통통)
  for (const sx of [-0.24, 0.24]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.24, 4, 8), toon(romper));
    arm.position.set(sx, 0.32, 0.28);
    arm.rotation.x = 0.9;
    driver.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon(skin));
    hand.position.set(sx * 0.75, 0.2, 0.52);
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

  // 통상 카트 파츠(불릿 변신 시 숨김 대상)
  g.userData.bodyParts = [...g.children];

  // --- 대형 미사일(불릿) 메시 (기본 숨김) ---
  const bullet = new THREE.Group();
  const bMat = toon(0x2a2a33, gradientMap, 0.15);
  const bodyB = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.6, 16), bMat);
  bodyB.rotation.x = Math.PI / 2; // 축을 +Z(전방)로
  bodyB.position.z = -0.1;
  bullet.add(bodyB);
  const noseB = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.3, 16), bMat);
  noseB.rotation.x = Math.PI / 2;
  noseB.position.z = 1.85;
  bullet.add(noseB);
  const tailB = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.7, 0.5, 16), bMat);
  tailB.rotation.x = Math.PI / 2; tailB.position.z = -1.5;
  bullet.add(tailB);
  // 핀 4개
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.7), toon(0xff3b3b, gradientMap, 0.2));
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, -1.3);
    fin.rotation.z = a;
    bullet.add(fin);
  }
  // 눈 (불릿빌 느낌, 오리지널)
  for (const sx of [-0.42, 0.42]) {
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), toon(0xffffff, gradientMap, 0.2));
    eyeW.position.set(sx, 0.15, 1.15); bullet.add(eyeW);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toon(0x101018, gradientMap));
    pupil.position.set(sx, 0.15, 1.42); bullet.add(pupil);
  }
  bullet.position.y = 0.7;
  bullet.visible = false;
  g.add(bullet);
  g.userData.bulletMesh = bullet;

  // 드리프트 스파크 (좌우 후미, 기본 숨김)
  const sparks = [];
  for (const sx of [-0.7, 0.7]) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, toneMapped: false, transparent: true, opacity: 0.9 }));
    sp.position.set(sx, 0.3, -1.3);
    sp.visible = false;
    g.add(sp);
    sparks.push(sp);
  }
  g.userData.sparks = sparks;

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
    this.bulletTimer = 0;  // >0 이면 대형 불릿(미사일) 변신
    this.onGrass = false;
    this.wheelspinTimer = 0; // 로켓스타트 실패(너무 일찍) 페널티

    // 드리프트/미니터보
    this.hopTimer = 0;
    this.drifting = false;
    this.driftDir = 0;      // -1 좌 / +1 우
    this.driftCharge = 0;   // 누적 차지(초)
    this.driftStage = 0;    // 0~3
    this._prevDrift = false;
    this.driftYaw = 0;      // 시각 슬립 각

    // 아이템 보유
    this.heldItem = null;  // 'mushroom' | 'star' | 'bullet' | 'banana' | 'shell' | null
    this.aiUseTimer = 0;   // AI 아이템 사용 딜레이
    this.frozen = false;   // 카운트다운 중 정지

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
  get boosting() { return this.boostTimer > 0 || this.bulletTimer > 0; }

  // 점프 램프: 수직 속도 부여 + 착지 시 부스트
  jump(vel, landBoost = 0) {
    if (this.airborne || this.bulletTimer > 0) return;
    this.airborne = true;
    this.vertVel = vel;
    this._landBoost = landBoost;
  }

  // 대형 불릿 변신: 자동으로 트랙을 따라 고속 돌진
  startBullet(t) {
    this.bulletTimer = t;
    this.spinTimer = 0;
    this.invincTimer = Math.max(this.invincTimer, t + 0.3);
    const tan = this.track.sampleTan[this.idx];
    if (tan) this.forward.copy(tan);
  }

  // 트랙 룩어헤드를 향해 forward를 강하게 회전 (불릿 자동주행)
  _autoSteer(dt) {
    const N = this.track.samplePos.length;
    const li = (this.idx + Math.max(6, Math.round(N * 0.02))) % N;
    const tp = this.track.samplePos[li];
    _tmp.set(tp.x - this.pos.x, 0, tp.z - this.pos.z);
    if (_tmp.lengthSq() < 1e-6) return;
    _tmp.normalize();
    _fwd.copy(this.forward); _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) return;
    _fwd.normalize();
    const crossY = _fwd.x * _tmp.z - _fwd.z * _tmp.x;
    const dot = THREE.MathUtils.clamp(_fwd.dot(_tmp), -1, 1);
    const ang = Math.atan2(crossY, dot);
    // 목표로 수렴하려면 forward 를 -ang 만큼 회전 (rot 규칙과 동일 부호)
    _q.setFromAxisAngle(_up, THREE.MathUtils.clamp(-ang, -5 * dt, 5 * dt));
    this.forward.applyQuaternion(_q);
  }

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

    // --- 대형 불릿 변신: 조작 무시, 자동 고속 돌진 ---
    if (this.bulletTimer > 0) {
      this.bulletTimer -= dt;
      this.invincTimer = Math.max(this.invincTimer, 0.15);
      this._autoSteer(dt);
      const bmax = PHYS.maxSpeed * 1.85;
      this.speed += (bmax - this.speed) * Math.min(1, dt * 4);
      _fwd.copy(this.forward); _fwd.y = 0;
      if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
      this.pos.addScaledVector(_fwd, this.speed * dt);
      const gB = this.track.ground(this.pos, this.idx, _ground);
      this.idx = gB.idx;
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, gB.height + 0.1, 0.5);
      _tmp.copy(this.forward).addScaledVector(gB.up, -this.forward.dot(gB.up));
      if (_tmp.lengthSq() > 1e-6) this.forward.copy(_tmp).normalize();
      this.wheelSpin += (this.speed / 0.34) * dt;
      this._bulletMode = true;
      this._syncMesh(gB);
      return;
    }
    this._bulletMode = false;

    // --- 휠스핀(로켓스타트 실패): 잠깐 출발 불가 ---
    if (this.wheelspinTimer > 0) {
      this.wheelspinTimer -= dt;
      this.speed = 0;
      this._prevDrift = input.drift;
      this.wheelSpin += 22 * dt;
      const gW = this.track.ground(this.pos, this.idx, _ground);
      this.idx = gW.idx;
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, gW.height + 0.1, 0.5);
      this._syncMesh(gW);
      return;
    }

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

    // --- 호핑 / 드리프트 / 미니터보 ---
    const driftHeld = input.drift;
    const driftEdge = driftHeld && !this._prevDrift;
    this._prevDrift = driftHeld;
    const steer = input.steer;

    if (this.hopTimer > 0) {
      this.hopTimer -= dt;
      if (this.hopTimer <= 0 && driftHeld && steer !== 0 && Math.abs(this.speed) > 5) {
        this.drifting = true;
        this.driftDir = Math.sign(steer);
        this.driftCharge = 0; this.driftStage = 0;
      }
    } else if (driftEdge && !this.drifting && Math.abs(this.speed) > 6) {
      this.hopTimer = 0.15; // 호핑 시작
    }

    if (this.drifting) {
      if (!driftHeld || Math.abs(this.speed) < 3) {
        // 드리프트 해제 → 미니터보 발동
        const dur = this.driftStage === 3 ? 1.5 : this.driftStage === 2 ? 1.0 : this.driftStage === 1 ? 0.5 : 0;
        if (dur > 0) this.giveBoost(dur);
        this.drifting = false; this.driftDir = 0; this.driftStage = 0; this.driftCharge = 0;
      } else {
        const inside = steer === this.driftDir;
        const outside = steer === -this.driftDir;
        const rate = inside ? 1.9 : outside ? 0.9 : 1.4;
        _q.setFromAxisAngle(_up, -this.driftDir * rate * dt);
        this.forward.applyQuaternion(_q);
        this.driftCharge += dt * (inside ? 1.3 : 1.0);
        this.driftStage = this.driftCharge >= 2.4 ? 3 : this.driftCharge >= 1.5 ? 2 : this.driftCharge >= 0.7 ? 1 : 0;
        // 드리프트는 속도 유지(최고속의 ~90%)
        const dmin = PHYS.maxSpeed * 0.9;
        if (this.speed < dmin && !this.onGrass) this.speed = THREE.MathUtils.lerp(this.speed, dmin, 0.1);
      }
    }

    // 통상 조향 (드리프트 아닐 때)
    if (!this.drifting && steer !== 0) {
      const speedFrac = Math.min(1, Math.abs(this.speed) / PHYS.maxSpeed);
      const turnRate = THREE.MathUtils.lerp(PHYS.turnRateLow, PHYS.turnRateHigh, speedFrac);
      const steerAuthority = Math.min(1, Math.abs(this.speed) / 3);
      const dir = this.speed >= 0 ? 1 : -1;
      const ang = -steer * turnRate * steerAuthority * dir * dt;
      _q.setFromAxisAngle(_up, ang);
      this.forward.applyQuaternion(_q);
    }
    // 시각 값
    this.steerVis = THREE.MathUtils.lerp(this.steerVis, this.drifting ? this.driftDir : steer, 0.25);
    this.driftYaw = THREE.MathUtils.lerp(this.driftYaw, this.drifting ? this.driftDir * 0.32 : 0, 0.2);

    // --- 이동 ---
    _fwd.copy(this.forward);
    _fwd.y = 0;
    if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
    this.pos.addScaledVector(_fwd, this.speed * dt);

    // --- 접지 ---
    const g = this.track.ground(this.pos, this.idx, _ground);
    this.idx = g.idx;
    if (this.airborne) {
      // 점프 램프로 뜬 상태: 중력 적용, 도로면 도달 시 착지(+착지 부스트)
      this.vertVel -= PHYS.gravity * dt;
      this.pos.y += this.vertVel * dt;
      if (this.pos.y <= g.height + 0.1 && this.vertVel <= 0) {
        this.pos.y = g.height + 0.1;
        this.airborne = false; this.vertVel = 0;
        if (this._landBoost) { this.giveBoost(this._landBoost); this._landBoost = 0; }
      }
      this.onGrass = false;
    } else {
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, g.height + 0.1, 0.5);
      // 도로 밖(잔디): 최고속 제한 + 소프트 월 (추락 없음)
      const over = Math.abs(g.lateral) - this.track.halfWidth;
      this.onGrass = over > 0.2;
      if (this.onGrass) {
        const grassMax = PHYS.maxSpeed * 0.42;
        if (this.speed > grassMax) this.speed -= PHYS.brake * 0.9 * dt;
        const maxOff = this.track.halfWidth + 9;
        if (Math.abs(g.lateral) > maxOff) {
          const push = Math.abs(g.lateral) - maxOff;
          this.pos.addScaledVector(g.lat, -Math.sign(g.lateral) * push);
        }
      }
    }
    // forward를 도로 접선 평면에 재투영 (경사 대응)
    _tmp.copy(this.forward).addScaledVector(g.up, -this.forward.dot(g.up));
    if (_tmp.lengthSq() > 1e-6) this.forward.copy(_tmp).normalize();

    // --- 휠 회전 누적 ---
    this.wheelSpin += (this.speed / 0.34) * dt; // v / r

    this._syncMesh(g);
  }

  _syncMesh(g) {
    // 위치 (+ 호핑 높이)
    this.model.position.copy(this.pos);
    if (this.hopTimer > 0) {
      this.model.position.y += Math.sin((0.15 - this.hopTimer) / 0.15 * Math.PI) * 0.4;
    }

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
    // 드리프트 슬립(시각 요)
    if (this.driftYaw !== 0) {
      _q.setFromAxisAngle(_tmp, this.driftYaw);
      this.model.quaternion.premultiply(_q);
    }

    // 불릿(미사일) 변신: 카트 파츠 숨기고 미사일 메시 표시
    const bm = this._bulletMode;
    const parts = this.model.userData.bodyParts;
    const bmesh = this.model.userData.bulletMesh;
    if (parts && bmesh && bm !== this._bmShown) {
      for (const p of parts) p.visible = !bm;
      bmesh.visible = bm;
      this._bmShown = bm;
    }
    // 스케일: 무적(반짝 펄스)만
    const sc = (!bm && this.invincTimer > 0) ? 1 + Math.sin(this.invincTimer * 30) * 0.08 : 1;
    this.model.scale.setScalar(sc);

    // 드리프트 스파크
    const sparks = this.model.userData.sparks;
    if (sparks) {
      const show = this.drifting && this.driftStage >= 1;
      const col = this.driftStage >= 3 ? 0xff5ecb : this.driftStage >= 2 ? 0xffa53d : 0x66ccff;
      for (const s of sparks) {
        s.visible = show;
        if (show) { s.material.color.setHex(col); s.scale.setScalar(0.7 + Math.sin(this.wheelSpin * 3 + s.position.x) * 0.35); }
      }
    }

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
