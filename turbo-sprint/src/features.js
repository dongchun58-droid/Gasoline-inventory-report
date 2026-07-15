// features.js — 네온 부스트 발판(에스컬레이터) + 점프 램프
// 마리오카트의 대시패널/부스트램프 느낌을 오리지널 네온으로.
import * as THREE from 'three';

const _g = {};
const _m = new THREE.Matrix4();

function chevronTex(hex) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = hex; g.lineWidth = 14; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 2; i++) {
    const y = 20 + i * 28;
    g.beginPath(); g.moveTo(8, y + 14); g.lineTo(32, y - 10); g.lineTo(56, y + 14); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class Features {
  constructor(track, gm, pad = {}) {
    this.track = track;
    this.gm = gm;
    this.pad = { boost: 0x18d6ff, chevron: '#eaffff', jump: '#ff9a2e', jumpHex: 0xff9a2e, jumpEdge: 0xffd23f, ...pad };
    this.group = new THREE.Group();
    this.boostPads = [];
    this.jumpPads = [];
    this._t = 0;
    const N = track.samplePos.length;
    const perSample = track.totalDist / N;

    // 네온 부스트 발판 (지속 가속)
    for (const t of [0.30, 0.58, 0.88]) {
      this._addBoostPad(Math.floor(t * N) % N, 28, perSample);
    }
    // 점프 램프 — 중앙 분리대가 없는 구간(t≈0.90)에 설치해야 점프 가능
    let ji = Math.floor(0.90 * N) % N;
    // 만약을 대비해 분리대가 없는 가장 가까운 샘플로 스냅
    if (track.sampleMedian && track.sampleMedian[ji]) {
      for (let d = 1; d < N; d++) { const c = (ji + d) % N; if (!track.sampleMedian[c]) { ji = c; break; } }
    }
    this._addJumpPad(ji, perSample);
  }

  _orient(mesh, i0, lift) {
    const t = this.track;
    _m.makeBasis(t.sampleLat[i0], t.sampleTan[i0], t.sampleUp[i0]); // 법선=up
    mesh.quaternion.setFromRotationMatrix(_m);
    mesh.position.copy(t.samplePos[i0]).addScaledVector(t.sampleUp[i0], lift);
  }

  _addBoostPad(i0, lengthM, perSample) {
    const t = this.track;
    const width = t.halfWidth * 0.9;
    const tex = chevronTex(this.pad.chevron);    // 셰브론 색
    tex.repeat.set(1, lengthM / 4.2);            // 큼직한 셰브론
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, lengthM), mat);
    this._orient(mesh, i0, 0.06);
    // 바닥 발광 패널 (도로와 구분되는 밝은 네온 스트립)
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(width, lengthM),
      new THREE.MeshBasicMaterial({ color: this.pad.boost, transparent: true, opacity: 0.72, toneMapped: false, depthWrite: false }));
    this._orient(glow, i0, 0.04);
    this.group.add(glow, mesh);
    this.boostPads.push({ i0, half: Math.round((lengthM / 2) / perSample), width: width / 2, tex });
  }

  _addJumpPad(i0, perSample) {
    const t = this.track;
    const width = t.halfWidth * 0.8;
    // 발광 발판
    const tex = chevronTex(this.pad.jump);
    tex.repeat.set(1, 3);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(width, 9),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
    this._orient(pad, i0, 0.06);
    this.group.add(pad);
    // 실제 램프(경사판): 이전보다 2배 길고 높게
    const lat = t.sampleLat[i0], up = t.sampleUp[i0], tan = t.sampleTan[i0];
    const lipMat = new THREE.MeshToonMaterial({ color: this.pad.jumpHex, gradientMap: this.gm, emissive: this.pad.jumpHex, emissiveIntensity: 0.55 });
    const rampLen = 7.5, tilt = 0.42;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(width * 1.05, 0.5, rampLen), lipMat);
    _m.makeBasis(lat, up, tan);
    lip.quaternion.setFromRotationMatrix(_m);
    lip.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(lat, tilt)); // 진행방향 앞이 높아지게(방향 수정)
    // 램프가 도로에서 솟아오르도록 배치(중심을 앞·위로)
    lip.position.copy(t.samplePos[i0]).addScaledVector(tan, 1.8).addScaledVector(up, 1.0);
    this.group.add(lip);
    // 옆 네온 스트립(발광 테두리)
    for (const sx of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, rampLen),
        new THREE.MeshBasicMaterial({ color: this.pad.jumpEdge, toneMapped: false }));
      edge.quaternion.copy(lip.quaternion);
      edge.position.copy(lip.position).addScaledVector(lat, sx * width * 0.53).addScaledVector(up, 0.28);
      this.group.add(edge);
    }
    this.jumpPads.push({ i0, half: Math.round(6 / perSample), width: width / 2, tex });
  }

  _within(idx, center, half, N) {
    let d = Math.abs(idx - center);
    d = Math.min(d, N - d);
    return d <= half;
  }

  update(dt, karts) {
    this._t += dt;
    const N = this.track.samplePos.length;
    // 셰브론 스크롤(밀어주는 느낌)
    for (const p of this.boostPads) p.tex.offset.y = (p.tex.offset.y - dt * 1.6) % 1;
    for (const p of this.jumpPads) p.tex.offset.y = (p.tex.offset.y - dt * 2.2) % 1;

    for (const k of karts) {
      const lateral = this.track.ground(k.pos, k.idx, _g).lateral;
      // 부스트 발판: 위에 있으면 지속 부스트
      for (const p of this.boostPads) {
        if (Math.abs(lateral) < p.width && this._within(k.idx, p.i0, p.half, N)) {
          k.giveBoost(0.3);
        }
      }
      // 점프 램프
      if (!k.airborne && k.speed > 9) {
        for (const p of this.jumpPads) {
          if (Math.abs(lateral) < p.width && this._within(k.idx, p.i0, p.half, N)) {
            k.jump(19, 1.0); // 더 높고 길게 (느린 차도 용암 강을 넘도록) + 착지 부스트
            if (k.speed < 24) k.speed = 24; // 램프 런치: 최소 도약 속도 보장
          }
        }
      }
    }
  }
}
