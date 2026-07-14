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

// 차량 종류별 스탯 (speed=최고속·strength=충돌강도/내구·turn=회전력)
export const VEHICLES = {
  kart:   { name: 'KART',   speed: 1.00, strength: 1.00, turn: 1.00 },
  bike:   { name: 'BIKE',   speed: 1.07, strength: 0.55, turn: 1.30 },
  sports: { name: 'SPORTS', speed: 1.18, strength: 0.80, turn: 0.62 }, // 최고속·조향 어려움
  truck:  { name: 'TRUCK',  speed: 0.95, strength: 3.00, turn: 0.72 }, // 조금 빠르게·내구 압도적
};
export const VEHICLE_ORDER = ['kart', 'bike', 'sports', 'truck'];

// 프로시저럴 차량 모델 (종류별 바디 + 공용 드라이버/휠)
function buildKartModel(color, gradientMap, type = 'kart') {
  const g = new THREE.Group();
  // 사실적 PBR(도장 금속 느낌) — 차량은 셀셰이딩 대신 표준 재질
  const toon = (c, emissive = 0x000000, emIntensity = 0) =>
    new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.35, emissive, emissiveIntensity: emIntensity });
  const chromeMat = () => new THREE.MeshStandardMaterial({ color: 0xd2d8de, metalness: 0.95, roughness: 0.22 });
  const glassMat = () => new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.4, roughness: 0.1 });
  const dark = 0x14141c;
  let wheelSpec, driverY = 0.5, driverScale = 1, driverZ = -0.05;

  if (type === 'bike') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 2.0), toon(color)); body.position.y = 0.55; g.add(body);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), toon(color)); tank.scale.set(1, 0.75, 1.3); tank.position.set(0, 0.82, 0.35); g.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.8), toon(0x222230)); seat.position.set(0, 0.82, -0.45); g.add(seat);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), toon(0x333340)); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.98, 0.92); g.add(bar);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), toon(0xffffff, 0xfff2a0, 1.2)); hl.position.set(0, 0.72, 1.05); g.add(hl);
    wheelSpec = [[0, 0.42, 1.05, true, 0.42], [0, 0.44, -1.05, false, 0.44]];
    driverY = 0.62;
  } else if (type === 'sports') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 2.9), toon(color)); body.position.y = 0.4; g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 1.0), toon(color)); nose.position.set(0, 0.32, 1.55); g.add(nose);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 1.2), toon(0x101018)); cabin.position.set(0, 0.74, -0.15); g.add(cabin);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.4), toon(dark)); wing.position.set(0, 0.78, -1.55); g.add(wing);
    for (const sx of [-0.75, 0.75]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), toon(dark)); post.position.set(sx, 0.6, -1.55); g.add(post); }
    wheelSpec = [[-0.88, 0.36, 1.25, true, 0.4], [0.88, 0.36, 1.25, true, 0.4], [-0.88, 0.36, -1.3, false, 0.4], [0.88, 0.36, -1.3, false, 0.4]];
    driverY = 0.5; driverScale = 0.9;
  } else if (type === 'truck') {
    // 미국식 픽업트럭 (오픈 적재함 · 테일게이트 · 세로 테일라이트 · 범퍼)
    const bodyCol = toon(0xdd7a1f); // 앰버/오렌지 (사진 참고)
    const clad = toon(dark);
    const redLite = toon(0x330000, 0xff2323, 1.6);
    const whiteLite = toon(0x222018, 0xfff2c8, 1.3);
    // 하부 섀시
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.55, 3.4), clad); chassis.position.set(0, 0.55, -0.05); g.add(chassis);
    // 캡(운전실) + 지붕
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.55), bodyCol); cab.position.set(0, 1.2, 0.75); g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.14, 1.4), bodyCol); roof.position.set(0, 1.68, 0.75); g.add(roof);
    // 캡 유리 (뒷유리 + 옆유리)
    const rg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.06), glassMat()); rg.position.set(0, 1.42, 0.02); g.add(rg);
    for (const sx of [-0.97, 0.97]) { const sg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.15), glassMat()); sg.position.set(sx, 1.4, 0.8); g.add(sg); }
    // 루프 레일 (크롬)
    for (const sx of [-0.62, 0.62]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.35, 8), chromeMat()); rail.rotation.x = Math.PI / 2; rail.position.set(sx, 1.78, 0.75); g.add(rail); }
    // 오픈 적재함: 바닥 + 측벽2 + 앞벽 + 테일게이트
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 1.8), clad); bedFloor.position.set(0, 0.98, -0.9); g.add(bedFloor);
    for (const sx of [-0.88, 0.88]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 1.8), bodyCol); wall.position.set(sx, 1.25, -0.9); g.add(wall); }
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.52, 0.16), bodyCol); frontWall.position.set(0, 1.25, -0.02); g.add(frontWall);
    const tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.58, 0.16), bodyCol); tailgate.position.set(0, 1.22, -1.78); g.add(tailgate);
    // 베드 레일 (측벽 위 크롬)
    for (const sx of [-0.88, 0.88]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.8, 8), chromeMat()); br.rotation.x = Math.PI / 2; br.position.set(sx, 1.53, -0.9); g.add(br); }
    // 세로형 테일라이트 (사진처럼)
    for (const sx of [-0.82, 0.82]) { const tl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.56, 0.09), redLite); tl.position.set(sx, 1.22, -1.85); g.add(tl); }
    // 리어 범퍼 + 스텝
    const rbumper = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.3, 0.4), clad); rbumper.position.set(0, 0.55, -1.9); g.add(rbumper);
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.28), chromeMat()); step.position.set(0, 0.42, -1.96); g.add(step);
    // 프론트: 그릴 + 헤드라이트 + 앞범퍼
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 0.14), clad); grille.position.set(0, 0.85, 1.62); g.add(grille);
    for (const sx of [-0.66, 0.66]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.09), whiteLite); hl.position.set(sx, 0.98, 1.63); g.add(hl); }
    const fbumper = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.32, 0.4), clad); fbumper.position.set(0, 0.52, 1.68); g.add(fbumper);
    wheelSpec = [[-1.0, 0.55, 1.15, true, 0.58], [1.0, 0.55, 1.15, true, 0.58], [-1.0, 0.55, -1.05, false, 0.58], [1.0, 0.55, -1.05, false, 0.58]];
    // 휠아치(펜더)
    for (const [x, , z] of wheelSpec) { const arch = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.14, 6, 12, Math.PI), clad); arch.rotation.y = Math.PI / 2; arch.position.set(x, 0.62, z); g.add(arch); }
    driverY = 0.86; driverScale = 0.78; driverZ = 0.7;
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), toon(color)); body.position.y = 0.45; g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 6), toon(color)); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0.42, 1.4); g.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.5), toon(dark)); wing.position.set(0, 0.95, -1.1); g.add(wing);
    for (const sx of [-0.6, 0.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), toon(dark)); post.position.set(sx, 0.72, -1.1); g.add(post); }
    for (const sx of [-0.35, 0.35]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.4, 8), toon(0x555566)); pipe.rotation.x = Math.PI / 2; pipe.position.set(sx, 0.5, -1.25); g.add(pipe); }
    wheelSpec = [[-0.82, 0.34, 1.0, true, 0.34], [0.82, 0.34, 1.0, true, 0.34], [-0.82, 0.34, -0.95, false, 0.34], [0.82, 0.34, -0.95, false, 0.34]];
  }

  // --- 귀여운 카툰 아기 드라이버 (큰 머리·볼·눈 / 오리지널) ---
  const driver = new THREE.Group();
  driver.position.set(0, driverY, driverZ);
  driver.scale.setScalar(driverScale);
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

  // 휠 (종류별 스펙) — 조향/서스펜션/회전 반영
  const wheelMat = toon(0x111119);
  const wheels = [];
  for (const [x, y, z, steer, r] of wheelSpec) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.47, 8, 14), wheelMat);
    w.rotation.y = Math.PI / 2; // 토러스 면을 옆으로
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.add(w);
    pivot.userData.steer = steer;
    pivot.userData.spin = w;
    pivot.userData.baseY = y;
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

  // 스타(무적) 반짝임 아우라 — 카트 주위 작은 별빛들 (기본 숨김)
  const aura = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
    const a = (i / 7) * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.1, 0.6 + (i % 3) * 0.35, Math.sin(a) * 1.1);
    aura.add(s);
  }
  aura.visible = false;
  g.add(aura);
  g.userData.aura = aura;

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
  constructor(track, color, gradientMap, type = 'kart') {
    this.track = track;
    this.color = color;
    this._gm = gradientMap;
    this.type = type;
    this.stats = VEHICLES[type] || VEHICLES.kart;

    this.model = buildKartModel(color, gradientMap, type);
    this.shadow = makeBlobShadow();

    // 충돌 넉백
    this.shove = new THREE.Vector3();
    this._bumpCd = 0;

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

  // 차량 종류 변경(모델 재생성). 이전 모델을 반환 → 호출자가 씬에서 교체.
  setType(type) {
    const old = this.model;
    this.type = type;
    this.stats = VEHICLES[type] || VEHICLES.kart;
    this.model = buildKartModel(this.color, this._gm, type);
    this._bmShown = undefined;
    this._syncMesh();
    return old;
  }

  // 넉백 추가(충돌)
  applyShove(v) { this.shove.add(v); }

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
    if (this._bumpCd > 0) this._bumpCd -= dt;

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
    const base = PHYS.maxSpeed * this.stats.speed;
    const effMax = boosting ? base * PHYS.boostMultiplier : base;

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
        const rate = (inside ? 1.9 : outside ? 0.9 : 1.4) * this.stats.turn;
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
      const turnRate = THREE.MathUtils.lerp(PHYS.turnRateLow, PHYS.turnRateHigh, speedFrac) * this.stats.turn;
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
    // 충돌 넉백(감쇠)
    if (this.shove.lengthSq() > 1e-4) {
      this.pos.addScaledVector(this.shove, dt);
      this.shove.multiplyScalar(Math.max(0, 1 - 6 * dt));
    }

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
      // 중앙 분리대(4차선 구간): 넘지 못하게 밀어냄 + 감속
      if (g.median) {
        const mh = this.track.medianHalf() + 0.5;
        if (Math.abs(g.lateral) < mh) {
          const side = g.lateral >= 0 ? 1 : -1;
          this.pos.addScaledVector(g.lat, (mh - Math.abs(g.lateral)) * side);
          this.speed *= 0.9;
        }
      }
      // 도로 밖(잔디): 최고속 제한 + 소프트 월 (추락 없음)
      const over = Math.abs(g.lateral) - g.half;
      this.onGrass = over > 0.2;
      if (this.onGrass) {
        const grassMax = PHYS.maxSpeed * 0.42;
        if (this.speed > grassMax) this.speed -= PHYS.brake * 0.9 * dt;
        const maxOff = g.half + 9;
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
    this.model.scale.setScalar(1);
    // 스타(무적): 번쩍번쩍 반짝이는 별빛 아우라
    const aura = this.model.userData.aura;
    if (aura) {
      const on = this.invincTimer > 0 && !bm;
      aura.visible = on;
      if (on) {
        aura.rotation.y += 0.35;
        const hue = (this.invincTimer * 2) % 1;
        const flash = 0.45 + 0.55 * Math.abs(Math.sin(this.invincTimer * 22));
        const n = aura.children.length;
        for (let i = 0; i < n; i++) {
          const s = aura.children[i];
          s.material.color.setHSL((hue + i / n) % 1, 1, 0.65);
          s.material.opacity = flash;
          s.scale.setScalar(0.6 + flash * 0.7);
        }
      }
    }

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
      pivot.position.y = pivot.userData.baseY + bounce;
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
