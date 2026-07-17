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
  kart:   { name: 'FUTURE EV', speed: 1.00, strength: 1.00, turn: 1.00 }, // 올라운더(기준) — 매끈한 전기 컨셉카
  bike:   { name: 'BIKE',   speed: 1.10, strength: 0.42, turn: 1.55 }, // 최고 민첩·최약 내구(유리대포)
  sports: { name: 'SPORTS', speed: 1.32, strength: 0.70, turn: 0.52 }, // 최고속·조향 매우 둔함
  truck:  { name: 'TRUCK',  speed: 0.86, strength: 3.30, turn: 0.84 }, // 가장 느림·내구 압도적(탱크)
};
export const VEHICLE_ORDER = ['kart', 'bike', 'sports', 'truck'];

// 선택 가능한 드라이버 캐릭터 (오리지널 카툰 — 특정 IP 아님)
export const CHARACTERS = {
  hulk:    { name: 'SMASHER', skin: 0x63b84a, outfit: 0x2e2350 },  // 초록 근육맨
  princess:{ name: 'PRINCESS', skin: 0xffd8b8, outfit: 0xff6fae }, // 왕관 공주
  cool:    { name: 'COOL GUY', skin: 0xf0c096, outfit: 0x24242c }, // 썬글라스 미남
  bearded: { name: 'BIG BOSS', skin: 0xeab98c, outfit: 0x7a4a24 }, // 빡빡머리 털보
};
export const CHARACTER_ORDER = ['hulk', 'princess', 'cool', 'bearded'];

// 드라이버(캐릭터) 모델 — 큰 머리 카툰 스타일, 캐릭터별 헤어/액세서리
export function buildDriver(character, teamColor) {
  const C = CHARACTERS[character] || CHARACTERS.cool;
  const M = (c, em = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.0, emissive: em, emissiveIntensity: ei });
  const driver = new THREE.Group();
  const skin = C.skin, outfit = C.outfit;
  const big = character === 'hulk';

  // 몸통 (헐크는 넓고 우람하게)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(big ? 0.34 : 0.25, 0.16, 4, 10), M(outfit));
  torso.position.set(0, 0.3, 0); driver.add(torso);
  // 팀 컬러 목도리(팀 식별용)
  const collar = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.33 : 0.24, 12, 10), M(teamColor));
  collar.scale.set(1, 0.5, 0.95); collar.position.set(0, 0.46, 0); driver.add(collar);
  // 팔 + 핸들 잡은 손
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(big ? 0.11 : 0.08, 0.24, 4, 8), M(outfit));
    arm.position.set(sx * (big ? 0.3 : 0.24), 0.32, 0.28); arm.rotation.x = 0.9; driver.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.12 : 0.1, 10, 8), M(skin));
    hand.position.set(sx * 0.19, 0.2, 0.52); driver.add(hand);
  }
  // 스티어링 휠
  const steer = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 16), M(0x222230));
  steer.position.set(0, 0.2, 0.55); steer.rotation.x = 1.1; driver.add(steer);

  // 머리 그룹 (기울임 카운터용) — 얼굴은 +Z를 향함
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.03);
  driver.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), M(skin));
  if (big) skull.scale.set(1.08, 0.98, 1.0);
  head.add(skull);

  // --- 공통 눈 헬퍼 ---
  const addEyes = (pupilY = 0.04) => {
    for (const sx of [-0.15, 0.15]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), M(0xffffff));
      w.scale.set(0.85, 1.05, 0.55); w.position.set(sx, 0.04, 0.27); head.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), M(0x201828));
      p.position.set(sx, pupilY - 0.01, 0.34); head.add(p);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), M(0xffffff, 0xffffff, 1.2));
      g.position.set(sx + 0.02, 0.07, 0.39); head.add(g);
    }
  };
  const addBrows = (col, angry) => {
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.05), M(col));
      b.position.set(sx * 0.15, 0.19, 0.36); b.rotation.z = sx * (angry ? 0.5 : 0.12); head.add(b);
    }
  };
  const addNose = () => {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), M(skin === 0x63b84a ? 0x4e9c39 : 0xe0a878));
    n.position.set(0, -0.04, 0.4); head.add(n);
  };

  if (character === 'hulk') {
    addEyes(0.02); addBrows(0x223018, true); addNose();
    // 성난 이빨 문 입 (그르렁)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.05), M(0x2a1414)); mouth.position.set(0, -0.17, 0.38); head.add(mouth);
    for (let x = -0.08; x <= 0.08; x += 0.08) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.04), M(0xffffff)); t.position.set(x, -0.15, 0.4); head.add(t); }
    // 귀
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), M(skin)); ear.position.set(sx * 0.4, 0, 0.02); head.add(ear); }
  } else if (character === 'princess') {
    // 긴 금발 (뒤통수 + 양갈래 + 앞머리)
    const gold = 0xffe07a;
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 14), M(gold)); back.scale.set(1, 1.05, 0.9); back.position.set(0, 0.02, -0.12); head.add(back);
    for (const sx of [-1, 1]) { const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), M(gold)); lock.position.set(sx * 0.34, -0.12, -0.02); head.add(lock); }
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M(gold)); bang.position.set(0, 0.12, 0.06); head.add(bang);
    addEyes(0.03); addNose();
    // 속눈썹
    for (const sx of [-0.15, 0.15]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.04), M(0x201018)); l.position.set(sx, 0.11, 0.35); l.rotation.z = sx > 0 ? -0.2 : 0.2; head.add(l); }
    // 볼 홍조
    for (const sx of [-0.26, 0.26]) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M(0xffa9c7)); ch.scale.set(1, 0.7, 0.4); ch.position.set(sx, -0.1, 0.28); head.add(ch); }
    // 미소
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 14, Math.PI), M(0xd05a72)); smile.position.set(0, -0.14, 0.38); smile.rotation.z = Math.PI; head.add(smile);
    // 금관 (티아라)
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 20, Math.PI), M(0xffd23c, 0xffb000, 0.4)); band.position.set(0, 0.3, 0.05); band.rotation.x = 0.3; head.add(band);
    for (const dx of [-0.16, 0, 0.16]) { const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), M(0xffd23c, 0xffb000, 0.4)); spike.position.set(dx, 0.42 - Math.abs(dx) * 0.3, 0.02); head.add(spike); const gem = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), M(0xff4f7f, 0xff2f5f, 0.6)); gem.position.set(dx, 0.48 - Math.abs(dx) * 0.3, 0.02); head.add(gem); }
  } else if (character === 'cool') {
    // 갈색 스웹트 헤어
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M(0x4a3320)); hair.position.set(0, 0.1, -0.02); hair.rotation.x = -0.15; head.add(hair);
    const bang = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.16), M(0x4a3320)); bang.position.set(0.08, 0.22, 0.3); bang.rotation.z = 0.25; head.add(bang);
    addNose();
    // 썬글라스 (검정 렌즈 2 + 브릿지 + 다리)
    for (const sx of [-0.15, 0.15]) { const lens = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.05), M(0x0a0a10, 0x101018, 0.4)); lens.position.set(sx, 0.05, 0.37); head.add(lens); }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.04), M(0x1a1a22)); bridge.position.set(0, 0.06, 0.38); head.add(bridge);
    for (const sx of [-1, 1]) { const temple = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), M(0x1a1a22)); temple.position.set(sx * 0.28, 0.07, 0.28); head.add(temple); }
    // 여유로운 미소
    const smirk = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 14, Math.PI), M(0xc86a58)); smirk.position.set(0, -0.16, 0.37); smirk.rotation.z = Math.PI - 0.3; head.add(smirk);
  } else { // bearded — 빡빡머리 털보
    addEyes(0.03); addBrows(0x3a2a1a, false); addNose();
    // 큰 수염 (턱·볼 감싸기)
    const beardCol = 0x5a3d24;
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 14), M(beardCol)); beard.scale.set(1.02, 0.85, 0.7); beard.position.set(0, -0.24, 0.16); head.add(beard);
    for (const sx of [-1, 1]) { const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.24, 4, 8), M(beardCol)); side.position.set(sx * 0.34, -0.08, 0.14); head.add(side); }
    // 콧수염
    const mus = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), M(beardCol)); mus.position.set(0, -0.1, 0.38); head.add(mus);
    // 살짝 보이는 입
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.04), M(0x7a2a2a)); mouth.position.set(0, -0.16, 0.37); head.add(mouth);
    // 반짝이는 대머리 하이라이트
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M(0xffffff, 0xffffff, 0.25)); shine.scale.set(1, 0.5, 0.4); shine.position.set(-0.1, 0.28, 0.18); head.add(shine);
  }

  driver.userData.head = head;
  return driver;
}

// 프로시저럴 차량 모델 (종류별 바디 + 공용 드라이버/휠)
export function buildKartModel(color, gradientMap, type = 'kart', character = 'cool') {
  const g = new THREE.Group();
  // 사실적 PBR(도장 금속 느낌) — 차량은 셀셰이딩 대신 표준 재질
  const toon = (c, emissive = 0x000000, emIntensity = 0) =>
    new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.35, emissive, emissiveIntensity: emIntensity });
  // 자동차 도장: 클리어코트(광택 상도) — 하늘/노을이 은은하게 비침 (Step 2)
  const carPaint = (c) => new THREE.MeshPhysicalMaterial({
    color: c, metalness: 0.45, roughness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.15,
  });
  const chromeMat = () => new THREE.MeshStandardMaterial({ color: 0xd2d8de, metalness: 0.95, roughness: 0.22 });
  const glassMat = () => new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.4, roughness: 0.1 });
  const dark = 0x14141c;
  let wheelSpec, driverY = 0.5, driverScale = 1, driverZ = -0.05;

  if (type === 'bike') {
    // 풀페어링 슈퍼스포츠 (CBR 계열 스타일 — 로고 없음)
    const paintM = carPaint(color);
    const white = toon(0xeef2f8);
    const accent = toon(0x1a4fd0);                 // 블루 그래픽
    const blackTrim = toon(0x0c0c12);
    const engineM = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.6 });
    const chrome = chromeMat();
    const headL = toon(0x111118, 0xdff0ff, 1.5);
    // 엔진 블록(가운데 낮게)
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.95), engineM); engine.position.set(0, 0.5, 0.05); g.add(engine);
    for (const sz of [-0.2, 0.15, 0.4]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.08), chrome); fin.position.set(0, 0.55, sz); g.add(fin); }
    // 벨리팬(하부 카울, 팀컬러)
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 1.15), paintM); belly.position.set(0, 0.32, 0.45); g.add(belly);
    // 연료탱크
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), paintM); tank.scale.set(1.05, 0.7, 1.6); tank.position.set(0, 0.94, 0.42); g.add(tank);
    // 프론트 페어링(뾰족) + 그래픽
    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.95), paintM); fairing.position.set(0, 0.76, 1.05); g.add(fairing);
    const fairNose = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.55), paintM); fairNose.position.set(0, 0.64, 1.58); g.add(fairNose);
    const graphic = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5), accent); graphic.position.set(0, 0.7, 1.3); g.add(graphic);
    for (const sx of [-1, 1]) { const gw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.66), sx < 0 ? white : accent); gw.position.set(sx * 0.3, 0.76, 1.12); g.add(gw); }
    // 사이드 카울 벤트(각진 슬릿) — 평평한 페어링 면 디테일
    for (const sx of [-1, 1]) for (const dz of [0, 0.16, 0.32]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.1), blackTrim);
      vent.position.set(sx * 0.31, 0.62, 0.98 - dz); vent.rotation.x = 0.5; g.add(vent);
    }
    // 윈드스크린(작은 버블) + 듀얼 헤드라이트
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.04), glassMat()); screen.position.set(0, 1.02, 1.32); screen.rotation.x = -0.62; g.add(screen);
    for (const sx of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.1), headL); hl.position.set(sx * 0.15, 0.66, 1.7); hl.rotation.z = sx * 0.35; g.add(hl); }
    // 시트 + 치켜올린 리어 카울 + 테일라이트
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.7), blackTrim); seat.position.set(0, 0.92, -0.25); g.add(seat);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.66), paintM); tail.position.set(0, 1.03, -0.66); tail.rotation.x = 0.4; g.add(tail);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.06), toon(0x220000, 0xff2222, 1.6)); tl.position.set(0, 1.06, -0.96); g.add(tl);
    // 클립온 핸들바 + 미러
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.66, 8), blackTrim); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.98, 0.82); g.add(bar);
    for (const sx of [-1, 1]) { const mir = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.05), blackTrim); mir.position.set(sx * 0.33, 1.02, 0.98); g.add(mir); }
    // USD 포크(2) + 프론트 펜더
    for (const sx of [-1, 1]) { const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), chrome); fork.position.set(sx * 0.13, 0.52, 1.32); fork.rotation.x = 0.26; g.add(fork); }
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.5), blackTrim); fender.position.set(0, 0.56, 1.34); g.add(fender);
    // 스윙암 + 크롬 배기(우측)
    const swing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), engineM); swing.position.set(0.16, 0.42, -0.6); g.add(swing);
    const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.85, 12), chrome); exh.rotation.x = Math.PI / 2 + 0.05; exh.position.set(0.28, 0.42, -0.55); g.add(exh);
    wheelSpec = [[0, 0.46, 1.18, true, 0.48, 0.17], [0, 0.48, -1.1, false, 0.5, 0.18]];
    driverY = 0.82; driverScale = 0.92; driverZ = 0.1;
  } else if (type === 'sports') {
    // 미드십 슈퍼카 (오렌지 GR 컨셉 스타일 — 로고 없음)
    const paintM = carPaint(color);
    const carbon = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.4 });
    const blackTrim = toon(0x0c0c12);
    const headL = toon(0x0e1420, 0xbfe4ff, 1.5);   // 시안 LED
    const tailL = toon(0x220000, 0xff2222, 1.7);
    // 로워 바디(낮고 넓은 플로어)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.3, 3.05), paintM); floor.position.y = 0.34; g.add(floor);
    // 프론트 후드(웨지) + 노즈 + 센터 캐릭터 라인
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.24, 1.5), paintM); hood.position.set(0, 0.52, 1.0); g.add(hood);
    const noseTip = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.2, 0.7), paintM); noseTip.position.set(0, 0.4, 1.85); g.add(noseTip);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.4), paintM); ridge.position.set(0, 0.64, 1.05); g.add(ridge);
    // 프론트 스플리터(카본) + 허니컴 인테이크
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.5), carbon); splitter.position.set(0, 0.2, 1.95); g.add(splitter);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.26, 0.12), blackTrim); grille.position.set(0, 0.33, 2.02); g.add(grille);
    for (const sx of [-0.62, 0.62]) { const intake = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.12), blackTrim); intake.position.set(sx, 0.32, 1.98); g.add(intake); }
    // 얇은 각진 헤드라이트
    for (const sx of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.14), headL); hl.position.set(sx * 0.62, 0.55, 1.72); hl.rotation.z = sx * 0.14; g.add(hl); }
    // 사이드 포드 + 사이드 인테이크
    for (const sx of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 1.4), paintM); pod.position.set(sx * 0.86, 0.5, -0.3); g.add(pod);
      const sideIntake = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.7), blackTrim); sideIntake.position.set(sx * 1.0, 0.5, -0.35); g.add(sideIntake);
    }
    // 리어 하운치(넓은 뒤태)
    const haunch = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.42, 1.2), paintM); haunch.position.set(0, 0.5, -0.9); g.add(haunch);
    // 오픈 콕핏: 앞유리 + 롤후프(아기 드라이버 노출)
    const windsh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.45), glassMat()); windsh.position.set(0, 0.74, 0.5); windsh.rotation.x = -0.4; g.add(windsh);
    const hoop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.12), blackTrim); hoop.position.set(0, 0.86, -0.55); g.add(hoop);
    // 리어 엔진 슬랫
    for (let i = 0; i < 4; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.1), blackTrim); slat.position.set(0, 0.72 - i * 0.015, -0.75 - i * 0.16); g.add(slat); }
    // 테일라이트 스트립 + 디퓨저 + 듀얼 배기 + 덕테일
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.1), tailL); tail.position.set(0, 0.6, -1.55); g.add(tail);
    const diff = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 0.4), carbon); diff.position.set(0, 0.3, -1.6); g.add(diff);
    for (const sx of [-0.3, 0.3]) { const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10), chromeMat()); exh.rotation.x = Math.PI / 2; exh.position.set(sx, 0.36, -1.72); g.add(exh); }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.3), carbon); wing.position.set(0, 0.74, -1.5); g.add(wing);
    // 사이드 미러
    for (const sx of [-1, 1]) { const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08), blackTrim); mir.position.set(sx * 0.78, 0.78, 0.68); g.add(mir); }
    wheelSpec = [[-0.9, 0.38, 1.2, true, 0.42, 0.36], [0.9, 0.38, 1.2, true, 0.42, 0.36], [-0.92, 0.4, -1.25, false, 0.44, 0.36], [0.92, 0.4, -1.25, false, 0.44, 0.36]];
    for (const [x, , z, , r] of wheelSpec) { const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 0.12, 0.12, 6, 14, Math.PI), blackTrim); arch.rotation.y = Math.PI / 2; arch.position.set(x, 0.42, z); g.add(arch); }
    driverY = 0.56; driverScale = 0.78; driverZ = 0.0;
  } else if (type === 'truck') {
    // 미국식 픽업트럭 (오픈 적재함 · 테일게이트 · 세로 테일라이트 · 범퍼)
    const bodyCol = carPaint(0xdd7a1f); // 앰버/오렌지 도장 (클리어코트)
    const clad = toon(dark);
    const redLite = toon(0x330000, 0xff2323, 1.6);
    const whiteLite = toon(0x222018, 0xfff2c8, 1.3);
    // 하부 섀시
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.55, 3.4), clad); chassis.position.set(0, 0.55, -0.05); g.add(chassis);
    // 오픈탑 운전실 — 천장을 뚫어 운전자가 보이는 컨버터블/버기 스타일
    // 낮은 도어/대시 라인까지만 벽을 세우고 위는 개방
    const cabBase = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.55), bodyCol); cabBase.position.set(0, 1.0, 0.75); g.add(cabBase);
    // 좌석 파묻힘 방지용 안쪽 어두운 실내(대비)
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.3), clad); inner.position.set(0, 1.12, 0.75); g.add(inner);
    // 앞유리 프레임 + 윈드실드(경사)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.5, 0.05), glassMat()); windshield.position.set(0, 1.5, 1.46); windshield.rotation.x = -0.32; g.add(windshield);
    for (const sx of [-0.84, 0.84]) { const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.09), clad); pillar.position.set(sx, 1.48, 1.42); pillar.rotation.x = -0.28; g.add(pillar); }
    // 뒤쪽 롤바(크롬 아치) — 천장 대신 안전바
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 8, 18, Math.PI), chromeMat()); roll.position.set(0, 1.02, 0.1); g.add(roll);
    for (const sx of [-0.62, 0.62]) { const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), chromeMat()); brace.position.set(sx, 1.2, 0.0); brace.rotation.x = 0.5; g.add(brace); }
    // 도어 상단 트림(팀 도색)
    for (const sx of [-0.95, 0.95]) { const trim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.5), chromeMat()); trim.position.set(sx, 1.26, 0.78); g.add(trim); }
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
    driverY = 1.0; driverScale = 0.82; driverZ = 0.7;
  } else {
    // FUTURE EV — 매끈한 전기 컨셉카 (오리지널 실루엣, 특정 브랜드 로고 없음)
    const paint = carPaint(color);                       // 팀 색 바디
    const sill = toon(0x101018);                          // 어두운 하부/트림
    const whiteTrim = carPaint(0xeef2f6);                 // 흰 로워 스커트
    // 시그니처: 크고 검은 글래스 캐노피 — 반투명이라 드라이버가 은은히 비침(틴티드 글래스)
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x080b12, metalness: 0.35, roughness: 0.05,
      clearcoat: 1.0, clearcoatRoughness: 0.04, transparent: true, opacity: 0.52,
    });
    const ledW = toon(0x0e1018, 0xe6f6ff, 1.7);           // 흰 LED
    const ledR = toon(0x220006, 0xff2a44, 1.7);           // 붉은 LED
    // 하부 플랫폼(스케이트보드 EV) — 낮고 넓게
    const platform = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), sill);
    platform.scale.set(0.84, 0.24, 1.4); platform.position.y = 0.34; g.add(platform);
    // 흰 로워 스커트(사진의 흰 하부)
    const skirt = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), whiteTrim);
    skirt.scale.set(0.9, 0.22, 1.46); skirt.position.set(0, 0.42, -0.02); g.add(skirt);
    // 매끈한 물방울 바디(팀색) — 앞이 낮고 뒤로 흐름
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), paint);
    shell.scale.set(0.9, 0.44, 1.5); shell.position.set(0, 0.56, -0.02); g.add(shell);
    // 로우 노즈(앞으로 둥글게)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), paint);
    nose.scale.set(0.8, 0.32, 0.72); nose.position.set(0, 0.47, 1.06); g.add(nose);
    // 큰 검은 글래스 캐노피(앞유리~루프 일체형 버블)
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), canopyMat);
    canopy.scale.set(0.75, 0.58, 1.24); canopy.position.set(0, 0.82, 0.08); g.add(canopy);
    // 프론트/리어 얇은 LED 스트립
    const fLed = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.045, 0.05), ledW); fLed.position.set(0, 0.55, 1.6); g.add(fLed);
    const rLed = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.05, 0.05), ledR); rLed.position.set(0, 0.62, -1.42); g.add(rLed);
    // 얇은 캐논형 사이드 미러
    for (const sx of [-1, 1]) { const mir = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.14), sill); mir.position.set(sx * 0.86, 0.76, 0.5); g.add(mir); }
    wheelSpec = [[-0.87, 0.4, 1.03, true, 0.4, 0.34], [0.87, 0.4, 1.03, true, 0.4, 0.34], [-0.87, 0.4, -1.05, false, 0.4, 0.34], [0.87, 0.4, -1.05, false, 0.4, 0.34]];
    // 매끈한 휠아치(바디색)
    for (const [x, , z] of wheelSpec) { const arch = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 6, 16, Math.PI), paint); arch.rotation.y = Math.PI / 2; arch.position.set(x, 0.44, z); g.add(arch); }
    driverY = 0.5; driverScale = 0.54; driverZ = 0.08;
  }

  // --- 드라이버(선택 캐릭터) ---
  const driver = buildDriver(character, color);
  driver.position.set(0, driverY, driverZ);
  driver.scale.setScalar(driverScale);
  g.add(driver);
  g.userData.driver = driver;
  g.userData.head = driver.userData.head;

  // 휠 (종류별 스펙) — 조향/서스펜션/회전 반영. 고무: 무광(roughness 0.95)
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111119, roughness: 0.95, metalness: 0.0 });
  const wheels = [];
  for (const [x, y, z, steer, r, tubeRatio] of wheelSpec) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(r, r * (tubeRatio ?? 0.47), 8, 16), wheelMat);
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

  // 스타(무적) 반짝임 아우라 — 카트를 감싸는 별빛들 (기본 숨김)
  const aura = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
    const a = (i / 16) * Math.PI * 2;
    const r = 1.15 + (i % 2) * 0.45;
    s.position.set(Math.cos(a) * r, 0.35 + (i % 4) * 0.45, Math.sin(a) * r);
    aura.add(s);
  }
  aura.visible = false;
  g.add(aura);
  g.userData.aura = aura;

  // 스타 발광 라이트 (무적 중 카트가 통째로 번쩍이도록)
  const starLight = new THREE.PointLight(0xffffff, 0, 16, 2);
  starLight.position.set(0, 1.3, 0);
  starLight.castShadow = false;
  starLight.visible = false;
  g.add(starLight);
  g.userData.starLight = starLight;

  // 스타 무적 시 통째로 무지개 발광시킬 도장 재질 목록 (원본 emissive 보관)
  const paint = [];
  g.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial) {
      paint.push({ m: o.material, e: o.material.emissive.getHex(), i: o.material.emissiveIntensity });
    }
  });
  g.userData.paint = paint;

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
  constructor(track, color, gradientMap, type = 'kart', character = 'cool') {
    this.track = track;
    this.color = color;
    this._gm = gradientMap;
    this.type = type;
    this.character = character;
    this.stats = VEHICLES[type] || VEHICLES.kart;

    this.model = buildKartModel(color, gradientMap, type, character);
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
    this.lavaTimer = 0;      // >0 이면 용암 추락 복구 중(페널티)
    this.stunTimer = 0;      // >0 이면 스턴(용의 불/충돌로 정지 후 재출발)
    this.iceTimer = 0;       // >0 이면 미끄러운 얼음 위(조향 저하·미끄러짐)

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
    this.leapTimer = 0;
    this.fallTimer = 0;
    this.lavaTimer = 0;
    this.stunTimer = 0;
    this.idx = 0;
    this._syncMesh();
  }

  // 추락 시작 (좁은 다리 이탈 · 용암/바다 · 정상 못넘은 점프 단절) — 가라앉은 뒤 복구
  // toClimbBase=true 이면 맵 지정 복귀 지점(성 아래 재등반)으로 이동
  _startLavaFall(toClimbBase = false) {
    if (this.lavaTimer > 0) return;
    this.lavaTimer = 2.6;                              // 복구까지 페널티 시간
    if (toClimbBase && this.track.fallRespawnIdx != null) {
      this._lavaIdx = this.track.fallRespawnIdx;       // 성 아래(재등반 시작점)로 복귀
    } else {
      this._lavaIdx = this._safeIdx != null ? this._safeIdx : this.idx; // 마지막 안전 지점
    }
    this._sinkY = this.pos.y - 8;
    this.speed = 0; this.boostTimer = 0; this.invincTimer = 0;
    this.drifting = false; this.driftYaw = 0; this.airborne = false;
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
  setIce(t = 0.22) { this.iceTimer = Math.max(this.iceTimer, t); }  // 미끄러운 빙판

  // 스턴: 용의 불/몸통에 맞으면 제자리에 멈췄다가 다시 출발 (용암 낙하와 유사하나 가라앉지 않음)
  // recover={pos,forward,idx} 를 주면 스턴 종료 시 그 위치로 복귀(용 몸통에 낀 경우 뒤로 빼줌)
  stun(t = 1.8, recover = null) {
    if (this.invincTimer > 0 || this.bulletTimer > 0 || this.stunTimer > 0 || this.lavaTimer > 0) return false;
    this.stunTimer = t;
    this.speed = 0; this.boostTimer = 0;
    this.drifting = false; this.driftYaw = 0; this.driftCharge = 0; this.driftStage = 0;
    this._stunRecover = recover;
    return true;
  }

  // 차량 종류 변경(모델 재생성). 이전 모델을 반환 → 호출자가 씬에서 교체.
  setType(type) {
    const old = this.model;
    this.type = type;
    this.stats = VEHICLES[type] || VEHICLES.kart;
    this.model = buildKartModel(this.color, this._gm, type, this.character);
    this._bmShown = undefined;
    this._syncMesh();
    return old;
  }

  // 캐릭터 변경(모델 재생성). 이전 모델을 반환 → 호출자가 씬에서 교체.
  setCharacter(character) {
    const old = this.model;
    this.character = character;
    this.model = buildKartModel(this.color, this._gm, this.type, character);
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

  // 성 정상 점프대: 스크립트 도약(강제 이동) — 무조건 크게 날아 안전 착지시킴
  castleLeap(toIdx, height = 30, dur = 1.35) {
    if (this.leapTimer > 0 || this.lavaTimer > 0 || this.stunTimer > 0 || this.bulletTimer > 0) return;
    const tr = this.track;
    this._leapFrom = this.pos.clone();
    this._leapTo = tr.samplePos[toIdx].clone();
    this._leapToIdx = toIdx;
    this._leapDur = dur; this.leapTimer = dur; this._leapHeight = height;
    this.airborne = true; this.drifting = false; this.driftStage = 0; this.driftCharge = 0;
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

    // --- 용암 추락 복구 중: 조작 불가, 가라앉았다가 복귀 ---
    if (this.lavaTimer > 0) {
      this.lavaTimer -= dt;
      this.speed = 0; this.vertVel = 0; this.spinAngle = 0;
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, this._sinkY, 0.12);
      if (this.lavaTimer <= 0) {
        // 다리 중앙(마지막 안전 지점)으로 복귀
        const i = this._lavaIdx != null ? this._lavaIdx : this.idx;
        const sp = this.track.samplePos[i], tan = this.track.sampleTan[i], up = this.track.sampleUp[i];
        this.pos.copy(sp).addScaledVector(up, 0.1);
        this.forward.copy(tan);
        this.idx = i; this.airborne = false;
      }
      this._syncMesh();
      return;
    }

    // --- 성 정상 도약 중: 조작 무시, 정해진 아치를 따라 크게 날아 착지 ---
    if (this.leapTimer > 0) {
      this.leapTimer -= dt;
      const u = THREE.MathUtils.clamp(1 - this.leapTimer / this._leapDur, 0, 1);
      this.pos.x = THREE.MathUtils.lerp(this._leapFrom.x, this._leapTo.x, u);
      this.pos.z = THREE.MathUtils.lerp(this._leapFrom.z, this._leapTo.z, u);
      const baseY = THREE.MathUtils.lerp(this._leapFrom.y, this._leapTo.y, u);
      this.pos.y = baseY + this._leapHeight * Math.sin(u * Math.PI) + 0.1;
      _tmp.set(this._leapTo.x - this._leapFrom.x, 0, this._leapTo.z - this._leapFrom.z);
      if (_tmp.lengthSq() > 1e-6) this.forward.copy(_tmp).normalize();
      this.wheelSpin += dt * 6;
      if (this.leapTimer <= 0) {
        this.pos.copy(this._leapTo); this.pos.y += 0.1;
        this.idx = this._leapToIdx; this._safeIdx = this._leapToIdx;
        this.forward.copy(this.track.sampleTan[this._leapToIdx]);
        this.airborne = false; this.leapTimer = 0;
        this.speed = Math.max(this.speed, 30);   // 착지 탄력
        this.giveBoost(0.6);
      }
      this._syncMesh();
      return;
    }

    // --- 스턴 중: 조작 불가, 제자리에 멈춤(약한 떨림) 후 재출발 ---
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.speed = 0; this.vertVel = 0;
      // 스턴 종료: 복귀 위치가 있으면 그쪽(용 뒤/열린 차선)으로 빼내 재출발
      if (this.stunTimer <= 0 && this._stunRecover) {
        const r = this._stunRecover; this._stunRecover = null;
        this.pos.copy(r.pos);
        this.forward.copy(r.forward);
        if (r.idx != null) this.idx = r.idx;
        this.airborne = false; this.spinAngle = 0;
        this._syncMesh();
        return;
      }
      const gS = this.track.ground(this.pos, this.idx, _ground);
      this.idx = gS.idx;
      if (gS.onRoad) this.pos.y = THREE.MathUtils.lerp(this.pos.y, gS.height + 0.1, 0.4);
      this.spinAngle = Math.sin(this.stunTimer * 40) * 0.12; // 부르르 떨림
      this._syncMesh(gS);
      return;
    }

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

    // 미끄러운 빙판: 타이머 감소
    if (this.iceTimer > 0) this.iceTimer -= dt;
    // 통상 조향 (드리프트 아닐 때)
    if (!this.drifting && steer !== 0) {
      const speedFrac = Math.min(1, Math.abs(this.speed) / PHYS.maxSpeed);
      const iceGrip = this.iceTimer > 0 ? 0.32 : 1;   // 빙판에선 조향력 크게 저하(확 미끄러짐)
      const turnRate = THREE.MathUtils.lerp(PHYS.turnRateLow, PHYS.turnRateHigh, speedFrac) * this.stats.turn * iceGrip;
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
    // 미끄러운 빙판: 실제 이동방향(관성)이 헤딩을 천천히 따라감 → 확 미끄러짐(꺾어도 밀림)
    if (!this._moveDir) this._moveDir = _fwd.clone();
    if (this.iceTimer > 0) {
      if (this._moveDir.lengthSq() < 1e-6) this._moveDir.copy(_fwd);
      this._moveDir.lerp(_fwd, 0.018).normalize();     // 낮은 접지 → 이동방향 전환이 매우 느림(확 미끄러짐/밀림)
    } else {
      this._moveDir.copy(_fwd);                          // 평소엔 헤딩과 동일(주행 영향 없음)
    }
    this.pos.addScaledVector(this._moveDir, this.speed * dt);
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
        if (g.gap) {
          // 단절 위로 착지 → 추락 (점프대를 정확히 못 넘긴 것) → 성 아래 재등반 지점으로
          this._startLavaFall(true);
        } else {
          this.pos.y = g.height + 0.1;
          this.airborne = false; this.vertVel = 0;
          if (this._landBoost) { this.giveBoost(this._landBoost); this._landBoost = 0; }
        }
      }
      this.onGrass = false;
    } else if (g.gap) {
      // 도로 단절에 지면으로 진입 → 추락. 점프대로만 통과 (얼음 정상=성 아래 재등반)
      this._startLavaFall(true);
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
      const over = Math.abs(g.lateral) - g.half;
      // 공중 도로(성 등반) 옆으로 확실히 이탈 → 낭떠러지 추락 → 성 아래(재등반 지점)로 복귀.
      // 여유를 둬서(over>5) 코너에서 살짝 밀려도 곧장 추락하진 않게(난이도 완화).
      if (g.elevated && over > 5) {
        this._startLavaFall(true);
        this.onGrass = false;
      } else if (g.bridge && over > 0.2) {
        // 좁은 다리 이탈 → 용암 추락(페널티)
        this._startLavaFall();
        this.onGrass = false;
      } else if (g.sea && over > 9 && (g.sea === 2 || Math.sign(g.lateral) === Math.sign(g.sea))) {
        // 바다 쪽 도로 이탈 → 바다 추락(딜레이 후 마지막 안전지점 복귀).
        // sea===2: 둑길(양쪽 다 바다) — 어느 쪽으로 이탈해도 추락. 여유(해변)로 급커브 살짝 밀림은 허용.
        this._startLavaFall();
        this.onGrass = false;
      } else {
        // 도로 밖(잔디/노반): 최고속 제한 + 소프트 월 (추락 없음)
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
        // 안전 지점 기록(도로 중앙 근처, 단절/다리이탈 아님) → 추락 복귀 지점
        if (g.onRoad && !g.gap && Math.abs(g.lateral) < g.half - 1.5) this._safeIdx = g.idx;
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
    // 스타(무적): 카트 통째로 번쩍번쩍 무지개 발광 + 별빛 아우라 + 발광 라이트
    const aura = this.model.userData.aura;
    const on = this.invincTimer > 0 && !bm;
    const hue = (this.invincTimer * 3) % 1;
    const flash = 0.5 + 0.5 * Math.abs(Math.sin(this.invincTimer * 26)); // 0~1 빠른 점멸
    if (aura) {
      aura.visible = on;
      if (on) {
        aura.rotation.y += 0.5;
        const n = aura.children.length;
        for (let i = 0; i < n; i++) {
          const s = aura.children[i];
          s.material.color.setHSL((hue + i / n) % 1, 1, 0.7);
          s.material.opacity = 0.55 + flash * 0.45;
          s.scale.setScalar(0.7 + flash * 1.1);
        }
      }
    }
    // 차체 전체 무지개 발광 (원본 emissive 복원 관리)
    const paint = this.model.userData.paint;
    if (paint) {
      if (on) {
        for (let i = 0; i < paint.length; i++) {
          const pm = paint[i];
          pm.m.emissive.setHSL((hue + i * 0.02) % 1, 1, 0.5);
          pm.m.emissiveIntensity = 0.45 + flash * 0.95;
        }
        this._starPaint = true;
      } else if (this._starPaint) {
        for (const pm of paint) { pm.m.emissive.setHex(pm.e); pm.m.emissiveIntensity = pm.i; }
        this._starPaint = false;
      }
    }
    // 발광 라이트 펄스
    const sl = this.model.userData.starLight;
    if (sl) {
      sl.visible = on;
      if (on) { sl.intensity = 3 + flash * 4; sl.color.setHSL(hue, 1, 0.6); }
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
