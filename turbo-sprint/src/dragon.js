// dragon.js — 도로 위 보스 악당: 불을 뿜는 이족보행 용(카이주 실루엣에서 영감, 오리지널)
// 큰 몸집이지만 도로 한쪽에 서서 카트가 반대편으로 피해갈 수 있고,
// 불(브레스)이나 몸통에 닿으면 카트가 잠깐 멈췄다가 다시 출발한다(스턴).
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _mouth = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _samp = new THREE.Vector3();
const _kxz = new THREE.Vector3();
const _splash = new THREE.Vector3();

// 매우 디테일한 용 모델 (+Z = 정면/브레스 방향, 발끝 y=0)
function buildDragon() {
  const g = new THREE.Group();
  const std = (c, r = 0.85, m = 0.08) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const hide = std(0x2c3138);            // 검회색 비늘 가죽
  const hideDk = std(0x1d2126);          // 음영부
  const belly = std(0x555f66, 0.7);      // 밝은 배/목 비늘판
  const claw = std(0x141418, 0.5, 0.2);
  const teeth = std(0xece4d2, 0.5);
  const spineMat = new THREE.MeshBasicMaterial({ color: 0xff3aa8, toneMapped: false });      // 발광 등지느러미(마젠타)
  const spineCore = new THREE.MeshBasicMaterial({ color: 0xffa8e6, toneMapped: false });
  const mawGlow = new THREE.MeshBasicMaterial({ color: 0xff59c8, transparent: true, opacity: 0.9, toneMapped: false });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe14a, toneMapped: false });

  // ---- 다리(허벅지+정강이+발+발톱) ----
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.9, 6, 12), hide);
    thigh.position.set(sx * 0.95, 2.1, -0.25); thigh.rotation.x = 0.35; g.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 6, 12), hide);
    shin.position.set(sx * 1.05, 1.05, 0.15); shin.rotation.x = -0.28; g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 1.3), hideDk);
    foot.position.set(sx * 1.05, 0.17, 0.55); g.add(foot);
    for (const cz of [-0.28, 0, 0.28]) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 6), claw);
      cl.rotation.x = Math.PI / 2 + 0.25; cl.position.set(sx * 1.05 + cz * 0.55, 0.14, 1.2); g.add(cl);
    }
    // 뒤꿈치 발톱
    const heel = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), claw);
    heel.rotation.x = -Math.PI / 2; heel.position.set(sx * 1.05, 0.16, -0.05); g.add(heel);
  }

  // ---- 몸통(엉덩이→가슴, 앞으로 기운 자세) ----
  const hip = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 16), hide);
  hip.scale.set(1.0, 1.05, 1.15); hip.position.set(0, 3.0, -0.3); g.add(hip);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1.55, 20, 16), hide);
  torso.scale.set(1.05, 1.25, 1.0); torso.position.set(0, 4.2, 0.25); g.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 16), hide);
  chest.scale.set(1.0, 1.05, 0.95); chest.position.set(0, 5.15, 0.55); g.add(chest);
  // 배 비늘판(밝은 세그먼트)
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(1.1 - i * 0.08, 0.34, 0.22), belly);
    seg.position.set(0, 3.4 + i * 0.52, 1.05 + i * 0.12); seg.rotation.x = -0.25; g.add(seg);
  }

  // ---- 팔(상완+전완+손+발톱) ----
  for (const sx of [-1, 1]) {
    const up1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 6, 10), hide);
    up1.position.set(sx * 1.35, 4.7, 0.6); up1.rotation.z = sx * 0.5; up1.rotation.x = 0.5; g.add(up1);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 6, 10), hide);
    fore.position.set(sx * 1.5, 3.95, 1.15); fore.rotation.x = 0.9; g.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), hideDk);
    hand.position.set(sx * 1.55, 3.4, 1.5); g.add(hand);
    for (const cz of [-0.2, 0, 0.2]) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 6), claw);
      cl.rotation.x = Math.PI / 2 + 0.4; cl.position.set(sx * 1.55 + cz, 3.28, 1.72); g.add(cl);
    }
  }

  // ---- 목 + 머리 ----
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.7, 6, 12), hide);
  neck.position.set(0, 5.7, 0.9); neck.rotation.x = 0.6; g.add(neck);
  const headG = new THREE.Group();
  headG.position.set(0, 6.15, 1.55);
  g.add(headG);
  // 두개골 베이스
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), hide);
  skull.scale.set(0.95, 0.9, 1.15); skull.position.set(0, 0, 0); headG.add(skull);
  // 윗주둥이(코끝으로 길게)
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 1.15), hide);
  snout.position.set(0, 0.02, 0.85); headG.add(snout);
  const snoutTip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), hide);
  snoutTip.position.set(0, 0.06, 1.45); headG.add(snoutTip);
  // 눈두덩(브라우 릿지) + 발광 눈
  for (const sx of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.5), hideDk);
    brow.position.set(sx * 0.42, 0.34, 0.42); brow.rotation.z = sx * -0.3; headG.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), eyeMat);
    eye.position.set(sx * 0.44, 0.2, 0.6); headG.add(eye);
    // 뿔(뒤로)
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 8), teeth);
    horn.position.set(sx * 0.45, 0.55, -0.35); horn.rotation.x = -0.7; headG.add(horn);
  }
  // 콧구멍
  for (const sx of [-1, 1]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hideDk); n.position.set(sx * 0.16, 0.12, 1.62); headG.add(n); }
  // 입 안쪽 발광
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mawGlow);
  maw.scale.set(0.8, 0.5, 1.0); maw.position.set(0, -0.28, 0.95); headG.add(maw);
  // 아래턱(여닫이)
  const jawG = new THREE.Group();
  jawG.position.set(0, -0.35, 0.35);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.28, 1.2), hide);
  jaw.position.set(0, 0, 0.55); jawG.add(jaw);
  // 이빨(위/아래)
  const addTeeth = (parent, y, z, dir) => {
    for (let i = -2; i <= 2; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 6), teeth);
      t.position.set(i * 0.16, y, z); t.rotation.x = dir; parent.add(t);
    }
  };
  addTeeth(headG, -0.14, 1.1, Math.PI);   // 윗니(아래로)
  addTeeth(jawG, 0.16, 0.95, 0);          // 아랫니(위로)
  headG.add(jawG);

  // ---- 등지느러미(발광 마젠타 플레이트): 목→등→꼬리 ----
  const spinePts = [
    [0, 5.9, 0.4, 0.5], [0, 5.6, -0.1, 0.7], [0, 5.15, -0.55, 0.95], [0, 4.6, -0.85, 1.15],
    [0, 4.0, -1.0, 1.25], [0, 3.4, -1.05, 1.15], [0, 2.9, -1.1, 1.0],
  ];
  const spines = [];
  for (const [x, y, z, s] of spinePts) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(s * 0.7, s * 1.5, 3), spineMat);
    fin.position.set(x, y + s * 0.5, z); fin.rotation.y = Math.PI / 2; g.add(fin);
    const core = new THREE.Mesh(new THREE.ConeGeometry(s * 0.32, s * 1.2, 3), spineCore);
    core.position.set(x, y + s * 0.5, z + 0.01); core.rotation.y = Math.PI / 2; g.add(core);
    spines.push(fin, core);
  }

  // ---- 꼬리(엉덩이에서 뒤로 길게, 지느러미 포함) ----
  let tx = 0, ty = 2.7, tz = -1.4, tr = 0.85;
  const tailSteps = 8;
  for (let i = 0; i < tailSteps; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(tr, 12, 10), hide);
    seg.position.set(tx, ty, tz); g.add(seg);
    // 꼬리 지느러미
    if (i < 6) {
      const fs = tr * 1.3;
      const fin = new THREE.Mesh(new THREE.ConeGeometry(fs * 0.55, fs, 3), spineMat);
      fin.position.set(tx, ty + tr * 0.7, tz); fin.rotation.y = Math.PI / 2; g.add(fin);
      spines.push(fin);
    }
    // 뒤로 가며 낮아졌다 다시 살짝 올라가는 곡선
    tz -= tr * 1.5;
    ty += (i < 3 ? -0.28 : 0.18);
    tx += 0.0;
    tr *= 0.82;
  }

  g.userData.jaw = jawG;
  g.userData.maw = maw;
  g.userData.spines = spines;
  g.userData.eyes = [eyeMat];
  g.userData.mawMat = mawGlow;
  return g;
}

// 브레스 화염 — 입에서 "아래 도로로" 내리쬐는 스트림 + 도로에 번지는 화염 웅덩이
const FIRE_LAND_Z = 8.3;                 // 착지 지점(로컬, +Z=face 방향)
function buildFire() {
  const g = new THREE.Group();
  const cone = (c, r, h, op) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = Math.PI / 2;       // +Z로 분사
    mesh.position.z = h / 2;
    return mesh;
  };
  // ① 입 → 도로로 기울어진 스트림 (아래-앞으로)
  const stream = new THREE.Group();
  stream.position.set(0, 6.15, 1.6);     // 입 위치(로컬)
  stream.rotation.x = 0.72;              // 아래로 기울여 도로에 닿게
  const s1 = cone(0xff2a08, 1.7, 9.0, 0.30);
  const s2 = cone(0xff6a1e, 1.15, 8.4, 0.5);
  const s3 = cone(0xffd54a, 0.6, 7.8, 0.85);
  stream.add(s1, s2, s3);
  g.add(stream);
  // ② 도로에 번지는 화염 웅덩이(평평) + 낮게 솟는 불길
  const ground = new THREE.Group();
  ground.position.set(0, 0.12, FIRE_LAND_Z);
  const disc = (c, r, op) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 22),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, toneMapped: false, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;         // 바닥에 눕힘
    return m;
  };
  const d1 = disc(0xff3a12, 3.6, 0.34);
  const d2 = disc(0xff7a1e, 2.4, 0.5);
  const d3 = disc(0xffd24a, 1.3, 0.85);
  const tongues = [];
  for (const [dx, dz] of [[-1.6, 0], [1.6, 0], [0, -1.7], [0, 1.7], [0, 0]]) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }));
    fl.position.set(dx, 1.1, dz); ground.add(fl); tongues.push(fl);
  }
  ground.add(d1, d2, d3);
  g.add(ground);
  g.userData.streamLayers = [s1, s2, s3];
  g.userData.groundLayers = [d1, d2, d3];
  g.userData.tongues = tongues;
  g.visible = false;
  return g;
}

export class Dragons {
  // spots: 배치할 트랙 파라미터(0~1) 배열, sides: 좌/우(+1/-1)
  constructor(track, spots = [0.10, 0.70], sides = [1, -1]) {
    this.track = track;
    this.group = new THREE.Group();
    this._t = 0;
    this.dragons = [];
    const N = track.samplePos.length;
    // 용 몸통에 부딪힌 카트를 뒤로 빼낼 거리(약 16m 뒤)
    this._backSamples = Math.max(6, Math.round(16 / ((track.totalDist || N) / N)));
    const P = 4.6;                                   // 브레스 주기(초)
    spots.forEach((t, k) => {
      const i0 = Math.floor(((t % 1) + 1) % 1 * N) % N;
      const side = sides[k % sides.length];
      const hw = track.sampleHalf ? track.sampleHalf[i0] : track.halfWidth;
      const model = buildDragon();
      const S = Math.max(1.05, hw * 0.135);          // 도로폭에 맞춘 크기(적당히 큰, 반대편 차선은 열어둠)
      model.scale.setScalar(S);
      const fire = buildFire();       // model의 자식 → model 스케일(S) 상속(이중 스케일 금지)
      model.add(fire);
      this.group.add(model);
      this.dragons.push({
        i0, side, model, fire, S, hw,
        phase: (k * 0.5) % 1,                        // 두 마리 브레스 타이밍 어긋나게
        P,
      });
    });
  }

  update(dt, karts) {
    this._t += dt;
    const t = this.track;
    for (const d of this.dragons) {
      const p = t.samplePos[d.i0], lat = t.sampleLat[d.i0], up = t.sampleUp[d.i0], tan = t.sampleTan[d.i0];
      const sideOff = d.hw * 0.66 * d.side;          // 도로 한쪽으로 치우쳐 배치(반대 차선 개방)
      d.model.position.copy(p).addScaledVector(lat, sideOff).addScaledVector(up, 0.05);
      // 정면(+Z=머리/브레스)이 다가오는 카트(-tan)를 향하되 도로 중앙쪽으로 비스듬히
      const face = _samp.copy(tan).multiplyScalar(-0.8).addScaledVector(lat, -d.side * 0.62).normalize();
      const right = _kxz.copy(up).cross(face).normalize();
      _m.makeBasis(right, up, face);
      d.model.quaternion.setFromRotationMatrix(_m);

      // 브레스 사이클
      const cyc = ((this._t / d.P) + d.phase) % 1;
      const windup = cyc > 0.58 && cyc <= 0.72;
      const breathOn = cyc > 0.72;
      const bt = breathOn ? (cyc - 0.72) / 0.28 : 0;  // 0..1 진행
      // 턱 벌림 + 입 발광
      const jawOpen = windup ? (cyc - 0.58) / 0.14 * 0.5 : (breathOn ? 0.7 : 0.0);
      if (d.model.userData.jaw) d.model.userData.jaw.rotation.x = jawOpen * 0.9;
      const mawI = windup ? 0.4 + (cyc - 0.58) / 0.14 * 0.6 : (breathOn ? 1.0 : 0.25);
      if (d.model.userData.mawMat) d.model.userData.mawMat.opacity = 0.3 + mawI * 0.7;
      // 등지느러미 맥동(브레스 직전 강해짐)
      const pulse = 0.75 + 0.25 * Math.sin(this._t * 3 + d.phase * 6) + (windup ? 0.5 : 0) + (breathOn ? 0.7 : 0);
      // 화염 표시/크기 (도로로 내리쬐는 스트림 + 웅덩이)
      const fire = d.fire;
      if (breathOn) {
        fire.visible = true;
        const grow = Math.min(1, bt * 3) * (1 - Math.max(0, bt - 0.85) / 0.15);  // 확장 후 수축
        const flick = 0.92 + 0.08 * Math.sin(this._t * 40);
        fire.scale.setScalar((0.72 + grow * 0.34) * flick);   // model 스케일에 곱해짐(≈S)
        const ud = fire.userData;
        for (const L of ud.streamLayers) L.material.opacity = (L === ud.streamLayers[2] ? 0.85 : 0.4) * (0.55 + grow * 0.45);
        for (const L of ud.groundLayers) L.material.opacity = (L === ud.groundLayers[2] ? 0.85 : 0.4) * (0.55 + grow * 0.45);
        for (const fl of ud.tongues) { fl.material.opacity = 0.5 * grow; fl.scale.y = 0.6 + grow * (0.9 + 0.3 * Math.sin(this._t * 22 + fl.position.x)); }
      } else {
        fire.visible = false;
      }
      // 살짝 숨쉬기(상하) — 위협적으로 천천히
      d.model.position.addScaledVector(up, Math.sin(this._t * 1.3 + d.phase * 5) * 0.12 * d.S);

      // ---- 충돌 판정 (지면 xz 기준) ----
      // 몸통: 발밑 중심 원기둥
      _origin.copy(p).addScaledVector(lat, sideOff);
      const bodyR = d.S * 2.2;
      // 불 웅덩이: 도로 위 착지 지점(FIRE_LAND_Z*S) 중심의 원 — 시각과 일치, 브레스 중에만
      const splash = _splash.copy(_origin).addScaledVector(face, FIRE_LAND_Z * d.S); splash.y = _origin.y;
      const splashR = d.S * 3.8;
      const N = t.samplePos.length;
      const backIdx = ((d.i0 - this._backSamples) % N + N) % N;
      for (const k of karts) {
        if (k.airborne || k.bulletTimer > 0 || k.invincTimer > 0 || k.stunTimer > 0) continue;
        _kxz.copy(k.pos); _kxz.y = _origin.y;
        // 몸통 충돌: 잠깐 멈췄다가 용 뒤(열린 차선)로 빼내 재출발 → 낀 채 반복 스턴 방지
        if (_kxz.distanceToSquared(_origin) < bodyR * bodyR) {
          const rp = t.samplePos[backIdx], rlat = t.sampleLat[backIdx], rtan = t.sampleTan[backIdx], rup = t.sampleUp[backIdx];
          const recPos = rp.clone().addScaledVector(rlat, -d.side * d.hw * 0.42).addScaledVector(rup, 0.1);
          k.stun(1.6, { pos: recPos, forward: rtan.clone(), idx: backIdx });
          continue;
        }
        // 불(도로 웅덩이) 충돌
        if (breathOn && bt > 0.12 && _kxz.distanceToSquared(splash) < splashR * splashR) { k.stun(1.6); }
      }
    }
  }
}
