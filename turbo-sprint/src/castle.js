// castle.js — 마왕 성 맵 배경 (용암·석벽·쇠사슬·마왕 석상·횃불, 오리지널)
// 마리오카트 '쿠파 성' 계열의 분위기에서 영감을 받되 완전 오리지널 에셋으로 구성.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

const APRON = 9;          // 도로 밖 석조 노반(코즈웨이) 폭
const LAVA_Y = -1.4;      // 용암 바다 높이
const ROCK_Y = -0.4;      // 석조 노반 높이

function stoneTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#3a3540'; g.fillRect(0, 0, 128, 128);
  // 벽돌 결
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 6; x++) {
      const ox = (y % 2) * 10;
      const v = 40 + ((x * 7 + y * 13) % 22);
      g.fillStyle = `rgb(${v},${v - 6},${v + 4})`;
      g.fillRect(ox + x * 22 + 1, y * 16 + 1, 20, 14);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lavaTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#ff7a1e'; g.fillRect(0, 0, 128, 128);
  // 어두운 굳은 껍질 균열
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 12.9) * 43758.5) % 1, y = (Math.sin(i * 78.2) * 43758.5) % 1;
    g.strokeStyle = 'rgba(30,8,4,0.75)'; g.lineWidth = 2 + (i % 3);
    g.beginPath();
    g.moveTo(Math.abs(x) * 128, Math.abs(y) * 128);
    g.lineTo(Math.abs(x) * 128 + (i % 9) - 4, Math.abs(y) * 128 + (i % 11) - 5);
    g.stroke();
  }
  // 밝은 균열 (발광 라인)
  for (let i = 0; i < 40; i++) {
    const x = (Math.sin(i * 5.3) * 12345.6) % 1, y = (Math.sin(i * 9.1) * 12345.6) % 1;
    g.strokeStyle = 'rgba(255,240,150,0.9)'; g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(Math.abs(x) * 128, Math.abs(y) * 128);
    g.lineTo(Math.abs(x) * 128 + (i % 7) - 3, Math.abs(y) * 128 + (i % 5) - 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CastleScenery {
  constructor(track, gradientMap) {
    this.track = track;
    this.gm = gradientMap;
    this.group = new THREE.Group();
    this._flames = [];
    this._eyes = [];
    this._t = 0;

    this._stoneTex = stoneTexture();
    this.stoneMat = new THREE.MeshStandardMaterial({ map: this._stoneTex, color: 0x8a8494, roughness: 0.95, metalness: 0.05, emissive: 0x1a0d0a, emissiveIntensity: 0.35 });
    this.darkStone = new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.95, metalness: 0.05, emissive: 0x140806, emissiveIntensity: 0.3 });
    this.metalMat = new THREE.MeshStandardMaterial({ color: 0x44444c, roughness: 0.5, metalness: 0.85 });
    this.boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e1d0, roughness: 0.72, metalness: 0.0, emissive: 0x241c14, emissiveIntensity: 0.28 });

    this._buildLava();
    this._buildCauseway();
    this._buildBattlements();
    this._buildTowers();
    this._buildStatues();
    this._buildTorches();
    this._buildInterior();
    this._buildLavaRiver();
    this._buildSkullGate();
    this._buildKnights();
    this._buildMeteors();
    this._buildBats();
    this._buildPteros();
    this._buildBoneFish();
    this._buildLavaSkeletons();
    this._buildEmbers();
    this._buildMountains();
  }

  // ---- 용암 바다 ----
  _buildLava() {
    const track = this.track;
    const size = 2 * (track.radius + 420);
    const tex = lavaTexture();
    tex.repeat.set(size / 24, size / 24);
    this._lavaMat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xff5a12, emissiveIntensity: 1.5,
      color: 0x1a0804, roughness: 0.55, metalness: 0.0,
    });
    this._lavaTex = tex;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const lava = new THREE.Mesh(geo, this._lavaMat);
    lava.position.set(track.center.x, LAVA_Y, track.center.z);
    lava.userData.noShadow = true;
    this.group.add(lava);
  }

  // ---- 석조 노반(코즈웨이): 도로가 용암 위 다리처럼 지나가도록 ----
  _buildCauseway() {
    const track = this.track;
    const N = track.samplePos.length;
    const positions = new Float32Array(N * 2 * 3);
    const uvs = new Float32Array(N * 2 * 2);
    for (let i = 0; i < N; i++) {
      const p = track.samplePos[i], lat = track.sampleLat[i];
      const base = (track.sampleHalf ? track.sampleHalf[i] : track.halfWidth);
      // 좁은 다리 구간: 노반(apron) 없이 얇은 다리 → 이탈 시 용암 추락
      const hw = track.sampleBridge && track.sampleBridge[i] ? base + 0.6 : base + APRON;
      const li = i * 6;
      positions[li + 0] = p.x - lat.x * hw; positions[li + 1] = ROCK_Y; positions[li + 2] = p.z - lat.z * hw;
      positions[li + 3] = p.x + lat.x * hw; positions[li + 4] = ROCK_Y; positions[li + 5] = p.z + lat.z * hw;
      const v = track.sampleDist[i] / 10;
      const ui = i * 4;
      uvs[ui + 0] = 0; uvs[ui + 1] = v; uvs[ui + 2] = 2.4; uvs[ui + 3] = v;
    }
    const indices = [];
    for (let i = 0; i < N; i++) {
      const nxt = (i + 1) % N;
      if (track.sampleGap && (track.sampleGap[i] || track.sampleGap[nxt])) continue; // 용암 강 단절
      const a = i * 2, b = i * 2 + 1, c = nxt * 2, d = nxt * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const tex = this._stoneTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, 1);
    // 노반 바닥: 은은한 자체발광으로 어두운 내부에서도 주행면이 보이게
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0x565060, roughness: 0.98, metalness: 0.03, emissive: 0x241514, emissiveIntensity: 0.5 });
    const rock = new THREE.Mesh(geo, mat);
    rock.receiveShadow = true;
    this.group.add(rock);
  }

  // ---- 노반 가장자리 성벽/총안(battlements) ----
  _buildBattlements() {
    const track = this.track;
    const N = track.samplePos.length;
    const step = 5;
    const merlons = [];
    for (let i = 0; i < N - 1; i += step) {
      if (track.sampleBridge && track.sampleBridge[i]) continue; // 다리 구간은 난간 없음(추락 가능)
      if (track.sampleGap && track.sampleGap[i]) continue;       // 용암 강 구간도 개방
      const p = track.samplePos[i], lat = track.sampleLat[i];
      const hw = (track.sampleHalf ? track.sampleHalf[i] : track.halfWidth) + APRON - 0.4;
      for (const side of [-1, 1]) {
        merlons.push({ x: p.x + lat.x * hw * side, z: p.z + lat.z * hw * side });
      }
    }
    // 벽 몸통 + 그 위 톱니(merlon)
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.4, 1.1), this.stoneMat, merlons.length);
    const tooth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), this.darkStone, merlons.length);
    merlons.forEach((mo, k) => {
      _q.identity();
      _m.compose(_p.set(mo.x, ROCK_Y + 0.7, mo.z), _q, _s.set(1, 1, 1));
      wall.setMatrixAt(k, _m);
      _m.compose(_p.set(mo.x, ROCK_Y + 1.8, mo.z), _q, _s.set(1, (k % 2) ? 1 : 0.01, 1)); // 한 칸 걸러 톱니
      tooth.setMatrixAt(k, _m);
    });
    wall.instanceMatrix.needsUpdate = true;
    tooth.instanceMatrix.needsUpdate = true;
    this.group.add(wall, tooth);
  }

  // ---- 외곽 성탑 ----
  _buildTowers() {
    const track = this.track;
    const CX = track.center.x, CZ = track.center.z, RAD = track.radius;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a1420, roughness: 0.8, metalness: 0.05 });
    const TC = 11;
    for (let i = 0; i < TC; i++) {
      const a = (i / TC) * Math.PI * 2;
      const r = RAD + 60 + (i % 3) * 40;
      const tx = CX + Math.cos(a) * r, tz = CZ + Math.sin(a) * r;
      const h = 34 + (i % 4) * 14, rad = 7 + (i % 3) * 2;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.15, h, 10), this.stoneMat);
      body.position.set(tx, h / 2 - 2, tz); this.group.add(body);
      // 총안 링
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.2, rad * 1.2, 2.4, 10, 1, true), this.darkStone);
      ring.position.set(tx, h - 2, tz); this.group.add(ring);
      // 뾰족 지붕
      const roof = new THREE.Mesh(new THREE.ConeGeometry(rad * 1.35, h * 0.5, 10), roofMat);
      roof.position.set(tx, h + h * 0.25 - 2, tz); this.group.add(roof);
    }
  }

  // ---- 마왕 석상 (뿔 달린 마왕, 오리지널) ----
  _buildStatues() {
    const track = this.track;
    const N = track.samplePos.length;
    // 트랙 안쪽으로 밀어넣어 우뚝 서 있게
    for (const [ti, sideIn] of [[Math.floor(N * 0.5), 1], [Math.floor(N * 0.0), -1]]) {
      const p = track.samplePos[ti], lat = track.sampleLat[ti];
      const off = (track.halfWidth + APRON + 22) * sideIn;
      const bx = p.x + lat.x * off, bz = p.z + lat.z * off;
      const statue = this._makeDemonStatue();
      statue.position.set(bx, ROCK_Y, bz);
      // 트랙(코즈웨이 중심)을 바라보게
      _dir.set(p.x - bx, 0, p.z - bz);
      statue.rotation.y = Math.atan2(_dir.x, _dir.z);
      this.group.add(statue);
    }
  }

  _makeDemonStatue() {
    const g = new THREE.Group();
    const st = new THREE.MeshStandardMaterial({ color: 0x545060, roughness: 0.9, metalness: 0.1 });
    // 받침대
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 2.2, 8), this.darkStone);
    base.position.y = 1.1; g.add(base);
    // 몸통
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 2.4), st);
    body.position.y = 4.4; g.add(body);
    // 어깨(등껍질 느낌)
    const shell = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), st);
    shell.scale.set(1, 0.8, 1.1); shell.position.set(0, 5.4, -0.7); g.add(shell);
    // 팔
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.0, 1.1), st);
      arm.position.set(sx * 2.3, 4.2, 0.4); arm.rotation.z = sx * 0.18; g.add(arm);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), st);
      fist.position.set(sx * 2.6, 2.7, 0.5); g.add(fist);
    }
    // 머리
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.0), st);
    head.position.y = 7.3; g.add(head);
    // 주둥이
    const snout = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.9), st);
    snout.position.set(0, 7.0, 1.2); g.add(snout);
    // 뿔 2쌍
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 6), st);
      horn.position.set(sx * 0.8, 8.7, -0.1); horn.rotation.z = sx * 0.5; g.add(horn);
      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.3, 6), st);
      horn2.position.set(sx * 1.3, 6.6, 0.7); horn2.rotation.z = sx * 1.1; g.add(horn2);
    }
    // 발광하는 눈 (긴장감)
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a10, emissiveIntensity: 2.4, toneMapped: true }));
      eye.position.set(sx * 0.55, 7.5, 1.0); g.add(eye);
      this._eyes.push(eye.material);
    }
    g.scale.setScalar(2.4); // 우뚝 솟은 위압적 크기
    return g;
  }

  // ---- 트랙변 횃불 ----
  _buildTorches() {
    const track = this.track;
    const N = track.samplePos.length;
    const step = 42;
    for (let i = 0; i < N - 1; i += step) {
      if (track.sampleBridge && track.sampleBridge[i]) continue; // 다리엔 기둥 없음
      if (track.sampleGap && track.sampleGap[i]) continue;
      const p = track.samplePos[i], lat = track.sampleLat[i], up = track.sampleUp[i];
      const hw = (track.sampleHalf ? track.sampleHalf[i] : track.halfWidth) + APRON - 0.6;
      for (const side of [-1, 1]) {
        const bx = p.x + lat.x * hw * side, bz = p.z + lat.z * hw * side;
        // 기둥
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.4, 6), this.metalMat);
        pole.position.set(bx, ROCK_Y + 1.7, bz); this.group.add(pole);
        // 화염 (발광, 애니메이션)
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8),
          new THREE.MeshBasicMaterial({ color: 0xffb52a, toneMapped: false, transparent: true, opacity: 0.95 }));
        flame.position.set(bx, ROCK_Y + 3.8, bz);
        this.group.add(flame);
        this._flames.push(flame);
      }
    }
  }

  // ---- 스타트 성문(아치) + 쇠사슬 ----
  _buildGate() {
    const s = this.track.startInfo();
    const gate = new THREE.Group();
    const hw = this.track.halfWidth;
    // 좌우 문기둥
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(3, 16, 3), this.stoneMat);
      post.position.copy(s.pos).addScaledVector(s.lat, (hw + 3.5) * side).addScaledVector(s.up, 7.5);
      gate.add(post);
      // 기둥 위 톱니
      for (let t = -1; t <= 1; t++) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), this.darkStone);
        merlon.position.copy(post.position).addScaledVector(s.lat, t * 1.0).addScaledVector(s.up, 8.5);
        gate.add(merlon);
      }
    }
    // 상단 크로스바
    const bar = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 8, 3, 3.2), this.stoneMat);
    bar.position.copy(s.pos).addScaledVector(s.up, 15);
    _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), s.lat);
    bar.quaternion.copy(_q);
    gate.add(bar);
    // 문장(마왕 상징) — 발광 원반
    const crest = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20),
      new THREE.MeshStandardMaterial({ color: 0x200404, emissive: 0xff3a12, emissiveIntensity: 1.6, side: THREE.DoubleSide }));
    crest.position.copy(s.pos).addScaledVector(s.up, 15).addScaledVector(s.tan, -1.7);
    crest.quaternion.copy(_q);
    crest.rotateY(Math.PI / 2);
    gate.add(crest);
    this._eyes.push(crest.material);
    // 쇠사슬 2줄 (크로스바에서 늘어짐)
    for (const side of [-0.5, 0.5]) {
      const anchor = _p.copy(s.pos).addScaledVector(s.lat, hw * side).addScaledVector(s.up, 13.5);
      this._makeChain(gate, anchor, 9);
    }
    this.group.add(gate);
  }

  // ---- 성 내부 구간: 둘러싼 높은 벽 + 진입/탈출 아치 + 천장 리브 + 내부 횃불/조명 ----
  _buildInterior() {
    const track = this.track;
    if (!track.interior) return;
    const N = track.samplePos.length;
    const i0 = Math.floor(track.interior[0] * N);
    const i1 = Math.floor(track.interior[1] * N);
    const perSample = track.totalDist / N;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a2028, roughness: 0.9, metalness: 0.05 });
    const WALL_H = 17;

    // 벽 + 천장 리브
    for (let i = i0; i < i1; i += 6) {
      const ii = i % N;
      if (track.sampleBridge && track.sampleBridge[ii]) continue; // 다리 구간은 벽 없음(개방 → 추락)
      const p = track.samplePos[ii], lat = track.sampleLat[ii], up = track.sampleUp[ii], tan = track.sampleTan[ii];
      const hw = (track.sampleHalf ? track.sampleHalf[ii] : track.halfWidth) + 1.6;
      const segLen = perSample * 6.4;
      const basis = new THREE.Matrix4().makeBasis(lat, up, tan);
      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2.0, WALL_H, segLen), this.stoneMat);
        wall.quaternion.setFromRotationMatrix(basis);
        wall.position.copy(p).addScaledVector(lat, hw * side).addScaledVector(up, ROCK_Y + WALL_H / 2);
        this.group.add(wall);
        // 벽 상단 톱니
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, segLen * 0.5), this.darkStone);
        tooth.quaternion.copy(wall.quaternion);
        tooth.position.copy(p).addScaledVector(lat, hw * side).addScaledVector(up, ROCK_Y + WALL_H + 0.7);
        this.group.add(tooth);
      }
      // 천장 리브(부분 천장) — 몇 칸 걸러
      if ((Math.floor(i / 6) % 2) === 0) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 4, 1.2, 1.6), roofMat);
        rib.quaternion.setFromRotationMatrix(basis);
        rib.position.copy(p).addScaledVector(up, ROCK_Y + WALL_H + 0.6);
        this.group.add(rib);
      }
      // 내부 벽 횃불 + 조명(가끔)
      if ((Math.floor(i / 6) % 3) === 0) {
        for (const side of [-1, 1]) {
          const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8),
            new THREE.MeshBasicMaterial({ color: 0xffb52a, toneMapped: false, transparent: true, opacity: 0.95 }));
          flame.position.copy(p).addScaledVector(lat, (hw - 0.8) * side).addScaledVector(up, ROCK_Y + 6);
          this.group.add(flame);
          this._flames.push(flame);
        }
        // 실제 조명(내부 포인트 라이트) — 과하지 않게(전역 필은 hemi/ambient가 담당)
        if ((Math.floor(i / 6) % 8) === 0) {
          const lamp = new THREE.PointLight(0xffa048, 20, 58, 2);
          lamp.castShadow = false;
          lamp.position.copy(p).addScaledVector(up, ROCK_Y + 9);
          this.group.add(lamp);
        }
      }
    }

    // 진입/탈출 아치 성문
    for (const gi of [i0, i1 % N]) {
      const p = track.samplePos[gi], lat = track.sampleLat[gi], up = track.sampleUp[gi], tan = track.sampleTan[gi];
      const hw = (track.sampleHalf ? track.sampleHalf[gi] : track.halfWidth) + 1.6;
      const basis = new THREE.Matrix4().makeBasis(lat, up, tan);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(3.4, WALL_H + 6, 3.4), this.stoneMat);
        post.quaternion.setFromRotationMatrix(basis);
        post.position.copy(p).addScaledVector(lat, (hw + 0.4) * side).addScaledVector(up, ROCK_Y + (WALL_H + 6) / 2);
        this.group.add(post);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 6, 3.2, 3.4), this.stoneMat);
      bar.quaternion.setFromRotationMatrix(basis);
      bar.position.copy(p).addScaledVector(up, ROCK_Y + WALL_H + 5);
      this.group.add(bar);
      // 문장(발광 원반)
      const crest = new THREE.Mesh(new THREE.CircleGeometry(2.0, 18),
        new THREE.MeshStandardMaterial({ color: 0x200404, emissive: 0xff3a12, emissiveIntensity: 1.6, side: THREE.DoubleSide }));
      crest.quaternion.setFromRotationMatrix(basis);
      crest.position.copy(p).addScaledVector(up, ROCK_Y + WALL_H + 5).addScaledVector(tan, 0.1);
      crest.rotateX(Math.PI / 2);
      this.group.add(crest);
      this._eyes.push(crest.material);
    }
  }

  _makeChain(parent, top, links) {
    const linkGeo = new THREE.TorusGeometry(0.32, 0.11, 6, 10);
    const chain = new THREE.InstancedMesh(linkGeo, this.metalMat, links);
    for (let i = 0; i < links; i++) {
      _q.setFromAxisAngle(_up, (i % 2) * Math.PI / 2);
      _q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
      _m.compose(_p.set(top.x, top.y - i * 0.58, top.z), _q, _s.set(1, 1, 1));
      chain.setMatrixAt(i, _m);
    }
    chain.instanceMatrix.needsUpdate = true;
    chain.userData.noShadow = true;
    parent.add(chain);
  }

  // ---- 점프대 앞 용암 강 (도로 단절 gap을 흐르는 용암으로 시각화) ----
  _buildLavaRiver() {
    const track = this.track;
    if (!track.gaps || !track.gaps.length) return;
    const N = track.samplePos.length;
    const tex = lavaTexture(); tex.repeat.set(2, 4);
    this._riverTex = tex;
    this._riverMat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xff6a1e, emissiveIntensity: 2.3,
      color: 0x2a0c04, roughness: 0.4, metalness: 0.0,
    });
    for (const [t0, t1] of track.gaps) {
      const i0 = Math.floor(t0 * N) - 2, i1 = Math.floor(t1 * N) + 2;
      const cnt = i1 - i0 + 1;
      const positions = new Float32Array(cnt * 2 * 3);
      const uvs = new Float32Array(cnt * 2 * 2);
      for (let k = 0; k < cnt; k++) {
        const i = ((i0 + k) % N + N) % N;
        const p = track.samplePos[i], lat = track.sampleLat[i];
        const hw = (track.sampleHalf ? track.sampleHalf[i] : track.halfWidth) + 6;
        const li = k * 6;
        positions[li] = p.x - lat.x * hw; positions[li + 1] = -0.5; positions[li + 2] = p.z - lat.z * hw;
        positions[li + 3] = p.x + lat.x * hw; positions[li + 4] = -0.5; positions[li + 5] = p.z + lat.z * hw;
        const ui = k * 4; uvs[ui] = 0; uvs[ui + 1] = k * 0.5; uvs[ui + 2] = 2; uvs[ui + 3] = k * 0.5;
      }
      const idx = [];
      for (let k = 0; k < cnt - 1; k++) { const a = k * 2, b = k * 2 + 1, c = (k + 1) * 2, d = (k + 1) * 2 + 1; idx.push(a, b, c, b, d, c); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const river = new THREE.Mesh(geo, this._riverMat);
      river.userData.noShadow = true;
      this.group.add(river);
    }
  }

  // ---- 스타트: 도로를 물어뜯는 해골 머리 (입 사이로 도로가 들어감) ----
  _buildSkullGate() {
    const s = this.track.startInfo();
    const hw = this.track.halfWidth;
    const bone = this.boneMat;
    const socket = new THREE.MeshStandardMaterial({ color: 0x120a0c, roughness: 0.9, metalness: 0 });
    const skull = new THREE.Group();
    // 두개골(넓적, 도로 위로 낮게 덮음)
    const cran = new THREE.Mesh(new THREE.SphereGeometry(8.5, 20, 16), bone);
    cran.scale.set(1.5, 1.15, 1.25); cran.position.set(0, 10.5, -2.5); skull.add(cran);
    // 윗턱(입천장)
    const palate = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 6, 2.6, 8), bone);
    palate.position.set(0, 5.9, 3.5); skull.add(palate);
    // 윗니(입천장 앞에서 아래로) — 차 위로 지나가게 팁 높이 유지
    for (let x = -hw + 1; x <= hw - 1; x += 2.6) {
      const th = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.0, 6), bone);
      th.position.set(x, 4.4, 7.2); th.rotation.x = Math.PI; skull.add(th);
    }
    // 좌우 하악 + 광대(턱경첩) + 아랫니(가장자리에서 위로) — 도로를 무는 형상
    for (const sx of [-1, 1]) {
      const mand = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.4, 12), bone);
      mand.position.set(sx * (hw + 1.6), 1.5, 3); mand.rotation.z = sx * 0.12; skull.add(mand);
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6, 4), bone);
      cheek.position.set(sx * (hw + 2.6), 6.5, -1); skull.add(cheek);
      for (const zz of [7, 4, 1]) {
        const th = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.6, 6), bone);
        th.position.set(sx * (hw + 0.1), 2.9, zz); skull.add(th);
      }
    }
    // 앞 턱끝(낮게, 도로 문턱)
    const chin = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 1.0, 2.4), bone);
    chin.position.set(0, 0.1, 9); skull.add(chin);
    // 눈(발광)
    for (const sx of [-1, 1]) {
      const sock = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 12), socket);
      sock.scale.set(1, 1.1, 0.7); sock.position.set(sx * 5.2, 11, 5); skull.add(sock);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x220200, emissive: 0xff2a08, emissiveIntensity: 2.8 }));
      pupil.position.set(sx * 5.2, 11, 6.8); skull.add(pupil); this._eyes.push(pupil.material);
    }
    // 코(역삼각 어둠)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 3), socket);
    nose.position.set(0, 8, 6.4); nose.rotation.x = Math.PI; skull.add(nose);
    // 뿔 2쌍
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(1.6, 10, 8), bone);
      horn.position.set(sx * 8.5, 18, -2.5); horn.rotation.z = sx * 0.7; skull.add(horn);
      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5, 8), bone);
      horn2.position.set(sx * 11, 22, -2.5); horn2.rotation.z = sx * 1.15; skull.add(horn2);
    }
    // 배치: 입이 진입 카트(그리드 쪽)를 향하도록
    const basis = new THREE.Matrix4().makeBasis(s.lat, s.up, s.tan);
    skull.quaternion.setFromRotationMatrix(basis);
    skull.rotateY(Math.PI); // 정면을 -tan(그리드)로
    skull.position.copy(s.pos).addScaledVector(s.up, -0.3);
    this.group.add(skull);
    // 윗턱에서 늘어진 쇠사슬
    for (const sx of [-0.55, 0.55]) {
      const anchor = new THREE.Vector3().copy(s.pos).addScaledVector(s.lat, hw * sx).addScaledVector(s.up, 4.6);
      this._makeChain(this.group, anchor, 4);
    }
  }

  // ---- 성 내부 도로변 해골 기사 ----
  _makeKnight() {
    const g = new THREE.Group();
    const bone = this.boneMat;
    const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.5, metalness: 0.7 });
    // 다리
    for (const sx of [-0.35, 0.35]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 2.2, 6), bone);
      leg.position.set(sx, 1.1, 0); g.add(leg);
    }
    // 골반 + 척추
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), bone); pelvis.position.y = 2.3; g.add(pelvis);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), bone); spine.position.y = 3.1; g.add(spine);
    // 갈비뼈
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.4 + r * 0.02, 0.05, 6, 12, Math.PI), bone);
      rib.position.set(0, 2.9 + r * 0.28, 0); rib.rotation.x = Math.PI / 2; g.add(rib);
    }
    // 어깨 + 팔
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.4), bone); shoulders.position.y = 3.8; g.add(shoulders);
    // 오른팔: 검을 든 형태
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), bone); rArm.position.set(0.7, 3.2, 0.2); rArm.rotation.x = 0.5; g.add(rArm);
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.28), iron); blade.position.y = 1.6; sword.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.14), iron); sword.add(guard);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), bone); grip.position.y = -0.3; sword.add(grip);
    sword.position.set(0.85, 3.9, 0.5); sword.rotation.x = -0.2; g.add(sword);
    // 왼팔 + 방패
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), bone); lArm.position.set(-0.7, 3.2, 0.3); lArm.rotation.x = 0.7; g.add(lArm);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.15, 6), iron); shield.rotation.x = Math.PI / 2; shield.position.set(-0.85, 3.0, 0.7); g.add(shield);
    // 두개골 + 투구(뿔)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), bone); skull.position.y = 4.35; g.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.35), bone); jaw.position.set(0, 4.05, 0.15); g.add(jaw);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3010, emissiveIntensity: 2.2 }));
      eye.position.set(sx * 0.15, 4.4, 0.34); g.add(eye); this._eyes.push(eye.material);
      const chorn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), iron); chorn.position.set(sx * 0.3, 4.9, 0); chorn.rotation.z = sx * 0.6; g.add(chorn);
    }
    g.userData.noShadow = true;
    return g;
  }
  _buildKnights() {
    const track = this.track;
    if (!track.interior) return;
    const N = track.samplePos.length;
    const ts = [0.60, 0.65, 0.71, 0.78, 0.83, 0.87];
    ts.forEach((tt, k) => {
      const i = Math.floor(tt * N) % N;
      if (track.sampleBridge[i] || track.sampleGap[i]) return;
      const side = (k % 2) ? 1 : -1;
      const p = track.samplePos[i], lat = track.sampleLat[i], up = track.sampleUp[i], tan = track.sampleTan[i];
      const off = (track.sampleHalf ? track.sampleHalf[i] : track.halfWidth) + 0.9;
      const kn = this._makeKnight();
      kn.position.copy(p).addScaledVector(lat, off * side).addScaledVector(up, ROCK_Y);
      // 도로를 향해 서게
      _dir.copy(lat).multiplyScalar(-side);
      kn.rotation.y = Math.atan2(_dir.x, _dir.z);
      kn.scale.setScalar(1.5);
      this.group.add(kn);
    });
  }

  // ---- 익룡 해골 ----
  _makePtero() {
    const g = new THREE.Group();
    const bone = this.boneMat;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 4, 6), bone); body.rotation.x = Math.PI / 2; g.add(body);
    // 머리(긴 부리 + 볏)
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8), bone); head.add(skull);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 6), bone); beak.rotation.x = Math.PI / 2; beak.position.z = 0.9; head.add(beak);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), bone); crest.rotation.x = -Math.PI / 2; crest.position.z = -0.5; crest.scale.set(0.3, 1, 1); head.add(crest);
    head.position.z = 1.3; g.add(head);
    // 긴 꼬리
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 2.4, 6), bone); tail.rotation.x = -Math.PI / 2; tail.position.z = -1.7; g.add(tail);
    // 큰 뼈 날개(팔뼈 + 긴 손가락뼈 + 막대살)
    const wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); g.add(pivot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), bone); arm.position.x = side * 0.7; pivot.add(arm);
      const finger = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.08), bone); finger.position.set(side * 2.4, 0, -0.4); finger.rotation.y = side * 0.4; pivot.add(finger);
      for (let m = 0; m < 3; m++) { const strut = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.04), bone); strut.position.set(side * 1.9, 0, -0.9 - m * 0.5); strut.rotation.y = side * 0.5; pivot.add(strut); }
      wings.push(pivot);
    }
    g.userData.noShadow = true; g.scale.setScalar(3.2);
    return { group: g, wings };
  }
  _buildPteros() {
    this._pteros = [];
    const CX = this.track.center.x, CZ = this.track.center.z, RAD = this.track.radius;
    for (let k = 0; k < 3; k++) {
      const pt = this._makePtero();
      this.group.add(pt.group);
      this._pteros.push({ group: pt.group, wings: pt.wings, cx: CX, cz: CZ, radius: RAD * (0.55 + (k % 2) * 0.28), y: 55 + k * 12, ang0: k * 2.1, speed: 0.12 + (k % 2) * 0.04, phase: k });
    }
  }

  // ---- 용암 웅덩이에서 솟는 해골(장애물) — 부딪히면 박살+감속 ----
  _makeLavaSkeleton() {
    const g = new THREE.Group();
    const bone = this.boneMat;
    const skel = new THREE.Group();
    // 골반~가슴만 (전신 X)
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.6), bone); pelvis.position.y = 0.4; skel.add(pelvis);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 6), bone); spine.position.y = 1.5; skel.add(spine);
    for (let r = 0; r < 4; r++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55 - r * 0.03, 0.07, 6, 12, Math.PI), bone); rib.position.y = 1.1 + r * 0.32; rib.rotation.x = Math.PI / 2; skel.add(rib); }
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.5), bone); shoulders.position.y = 2.5; skel.add(shoulders);
    // 위로 뻗은 두 팔 (위협적으로)
    for (const sx of [-1, 1]) {
      const up1 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 6), bone); up1.position.set(sx * 0.9, 3.0, 0); up1.rotation.z = sx * 0.4; skel.add(up1);
      const up2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.2, 6), bone); up2.position.set(sx * 1.5, 3.9, 0); up2.rotation.z = sx * 0.15; skel.add(up2);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), bone); claw.position.set(sx * 1.65, 4.6, 0); skel.add(claw);
    }
    // 두개골
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), bone); skull.position.y = 3.1; skel.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.5), bone); jaw.position.set(0, 2.7, 0.2); skel.add(jaw);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3a10, emissiveIntensity: 2.6 }));
      eye.position.set(sx * 0.2, 3.2, 0.45); skel.add(eye); this._eyes.push(eye.material);
    }
    skel.scale.setScalar(1.4);
    g.add(skel);
    g.userData.skel = skel;
    // 용암 웅덩이(발광 원반)
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a0c04, emissive: 0xff5a12, emissiveIntensity: 2.4, transparent: true, opacity: 0, toneMapped: true }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; g.add(pool);
    g.userData.pool = pool;
    g.userData.noShadow = true;
    return g;
  }
  _buildLavaSkeletons() {
    this._lavaSkels = [];
    const track = this.track, N = track.samplePos.length;
    const specs = [[0.10, -4], [0.24, 5], [0.40, 0], [0.55, -5], [0.80, 4]];
    specs.forEach(([tt, latoff], k) => {
      const i = Math.floor(tt * N) % N;
      if (track.sampleBridge[i] || track.sampleGap[i]) return;
      const p = track.samplePos[i], lat = track.sampleLat[i], up = track.sampleUp[i];
      const base = new THREE.Vector3().copy(p).addScaledVector(lat, latoff).addScaledVector(up, 0.05);
      const g = this._makeLavaSkeleton();
      g.position.copy(base);
      g.rotation.y = Math.atan2(lat.x, lat.z);
      this.group.add(g);
      this._lavaSkels.push({ group: g, skel: g.userData.skel, pool: g.userData.pool, base, idx: i, period: 7, phase: k * 1.4, riseDur: 0.8, upDur: 2.2, broken: false });
    });
  }

  // ---- 하늘에서 떨어지는 불덩이(운석) 2곳 ----
  _buildMeteors() {
    const track = this.track;
    const N = track.samplePos.length;
    this._meteors = [];
    const targetsT = [0.15, 0.46];
    targetsT.forEach((tt, k) => {
      const i = Math.floor(tt * N) % N;
      const target = track.samplePos[i].clone(); target.y = 0.4;
      const up = new THREE.Vector3(0, 1, 0);
      // 훨씬 멀리·높이서 시작 (천천히 오래 떨어짐)
      const start = target.clone()
        .addScaledVector(up, 300)
        .addScaledVector(track.sampleTan[i], -150 + k * 80)
        .addScaledVector(track.sampleLat[i], (k ? 1 : -1) * 90);
      const m = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffe79a, toneMapped: false }));
      const flame = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 12), new THREE.MeshBasicMaterial({ color: 0xff5a12, transparent: true, opacity: 0.6, toneMapped: false }));
      const trail = new THREE.Mesh(new THREE.ConeGeometry(2.0, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.5, toneMapped: false }));
      trail.position.set(0, 6, 0);
      m.add(trail, flame, core);
      m.userData.noShadow = true; m.visible = false;
      this.group.add(m);
      const light = new THREE.PointLight(0xff7a2a, 0, 60, 2); light.castShadow = false; this.group.add(light);
      // 착탄 충격파(고리) + 섬광
      const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: 0, toneMapped: false }));
      flash.position.copy(target); flash.userData.noShadow = true; this.group.add(flash);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.5, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff6a1e, transparent: true, opacity: 0, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(target); ring.position.y = 0.3; ring.userData.noShadow = true; this.group.add(ring);
      // 훨씬 느리게: travel 6초, 주기 9초
      this._meteors.push({ m, light, flash, ring, start, target, period: 9, phase: k * 4.5, travel: 6.0, maxScale: 3.6 });
    });
  }

  // ---- 하늘의 뼈 박쥐 ----
  _makeBat() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.9, 4, 6), this.boneMat); body.rotation.x = Math.PI / 2; g.add(body);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), this.boneMat); skull.position.z = 0.8; g.add(skull);
    for (const sx of [-0.2, 0.2]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), this.boneMat); ear.position.set(sx, 0.35, 0.8); g.add(ear); }
    const wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.2, 0, 0); g.add(pivot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), this.boneMat); arm.position.set(side * 0.9, 0, 0); pivot.add(arm);
      for (let f = 0; f < 3; f++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), this.boneMat); fin.position.set(side * 1.5, 0, (f - 1) * 0.4); fin.rotation.y = side * (f - 1) * 0.5; pivot.add(fin); }
      wings.push(pivot);
    }
    g.userData.noShadow = true; g.scale.setScalar(2.2);
    return { group: g, wings };
  }
  _buildBats() {
    this._bats = [];
    const CX = this.track.center.x, CZ = this.track.center.z, RAD = this.track.radius;
    for (let k = 0; k < 6; k++) {
      const bat = this._makeBat();
      this.group.add(bat.group);
      this._bats.push({ group: bat.group, wings: bat.wings, cx: CX, cz: CZ, radius: RAD * (0.4 + (k % 3) * 0.22), y: 32 + (k % 4) * 9, ang0: k * 1.05, speed: 0.22 + (k % 3) * 0.07, phase: k });
    }
  }

  // ---- 도로 양옆 뼈 물고기(용암에서 점프) ----
  _makeBoneFish() {
    const g = new THREE.Group();
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 5, 6), this.boneMat); spine.rotation.z = Math.PI / 2; g.add(spine);
    for (let r = 0; r < 6; r++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.9 - r * 0.1, 0.08, 6, 10, Math.PI), this.boneMat); rib.position.x = 2 - r * 0.7; rib.rotation.y = Math.PI / 2; g.add(rib); }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.7, 7), this.boneMat); head.rotation.z = -Math.PI / 2; head.position.x = 3.0; g.add(head);
    for (const sz of [-0.35, 0.35]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3010, emissiveIntensity: 1.8 }));
      eye.position.set(2.9, 0.18, sz); g.add(eye); this._eyes.push(eye.material);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.7, 4), this.boneMat); tail.rotation.z = Math.PI / 2; tail.position.x = -3.0; tail.scale.set(1, 1, 0.3); g.add(tail);
    g.userData.noShadow = true; g.scale.setScalar(2.4);
    return { group: g };
  }
  _buildBoneFish() {
    this._fish = [];
    const track = this.track, N = track.samplePos.length;
    const spotsT = [0.05, 0.30, 0.52, 0.83];
    spotsT.forEach((tt, k) => {
      const i = Math.floor(tt * N) % N;
      if (track.sampleBridge[i] || track.sampleGap[i]) return;
      const side = (k % 2) ? 1 : -1;
      const p = track.samplePos[i], lat = track.sampleLat[i], tan = track.sampleTan[i];
      const off = (track.sampleHalf ? track.sampleHalf[i] : track.halfWidth) + APRON + 10;
      const base = new THREE.Vector3(p.x + lat.x * off * side, LAVA_Y, p.z + lat.z * off * side);
      const fish = this._makeBoneFish();
      fish.group.position.copy(base); fish.group.visible = false;
      this.group.add(fish.group);
      this._fish.push({ group: fish.group, base, yaw: Math.atan2(tan.x, tan.z), period: 6, phase: k * 1.5, arc: 17 });
    });
  }

  // ---- 상승하는 불티(ember) 파티클 ----
  _buildEmbers() {
    const track = this.track;
    const CX = track.center.x, CZ = track.center.z, RAD = track.radius;
    const COUNT = 360;
    const pos = new Float32Array(COUNT * 3);
    this._emberBase = new Float32Array(COUNT); // y 시작
    this._emberSpd = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const a = (Math.sin(i * 12.9) * 43758.5) % 1, rr = (Math.sin(i * 78.2) * 43758.5) % 1;
      const rad = (0.3 + Math.abs(rr) * 0.9) * RAD;
      const ang = Math.abs(a) * Math.PI * 2;
      pos[i * 3] = CX + Math.cos(ang) * rad;
      pos[i * 3 + 1] = LAVA_Y + Math.abs((Math.sin(i * 3.1) * 999) % 1) * 40;
      pos[i * 3 + 2] = CZ + Math.sin(ang) * rad;
      this._emberSpd[i] = 4 + Math.abs((Math.sin(i * 5.7) * 999) % 1) * 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff8a2a, size: 1.4, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this._embers = new THREE.Points(geo, mat);
    this._embers.userData.noShadow = true;
    this.group.add(this._embers);
  }

  // ---- 먼 화산/암봉 실루엣 ----
  _buildMountains() {
    const track = this.track;
    const CX = track.center.x, CZ = track.center.z;
    const R = track.radius + 260, MC = 16;
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 1.0, metalness: 0 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x2a0c06, emissive: 0xff4a12, emissiveIntensity: 0.8, roughness: 0.8 });
    for (let i = 0; i < MC; i++) {
      const a = (i / MC) * Math.PI * 2;
      const mx = CX + Math.cos(a) * R, mz = CZ + Math.sin(a) * R;
      const hgt = 120 + (i % 4) * 40, rad = 70 + (i % 3) * 20;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, hgt, 5), mat);
      m.position.set(mx, hgt / 2 - 6, mz); m.userData.noShadow = true; this.group.add(m);
      if (i % 3 === 0) { // 몇 개는 분화구 발광
        const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.3, hgt * 0.16, 5), glow);
        cap.position.set(mx, hgt - hgt * 0.08 - 6, mz); cap.userData.noShadow = true; this.group.add(cap);
      }
    }
  }

  update(dt, karts, raceState) {
    this._t += dt;
    const t = this._t;
    // 용암 흐름 + 맥동 발광 (긴장감)
    if (this._lavaTex) this._lavaTex.offset.y = (this._lavaTex.offset.y - dt * 0.02) % 1;
    if (this._lavaMat) this._lavaMat.emissiveIntensity = 1.35 + 0.5 * Math.sin(t * 1.3);
    if (this._riverTex) this._riverTex.offset.y = (this._riverTex.offset.y - dt * 0.28) % 1;
    if (this._riverMat) this._riverMat.emissiveIntensity = 2.0 + 0.6 * Math.sin(t * 3.1);

    // 하늘에서 떨어지는 불덩이(운석) — 멀리서 천천히, 착탄 파괴력 큼
    if (this._meteors) {
      for (const me of this._meteors) {
        const local = (t + me.phase) % me.period;
        if (local < me.travel) {
          me.m.visible = true;
          const pr = local / me.travel;
          const e = pr * pr * pr;                  // 초반 완만 → 막판 가속
          me.m.position.lerpVectors(me.start, me.target, e);
          me.m.scale.setScalar(0.25 + e * me.maxScale);
          _p.copy(me.start).sub(me.target).normalize();
          me.m.quaternion.setFromUnitVectors(_up, _p); // 꼬리를 하늘쪽으로
          me.light.position.copy(me.m.position); me.light.intensity = 4 + e * 30;
          me.flash.material.opacity = 0;
          // 착탄 지점 경고 표식(반경 8) — 다가올수록 뚜렷
          me.ring.material.opacity = (0.22 + 0.35 * Math.abs(Math.sin(t * 6))) * Math.min(1, pr * 1.4);
          me.ring.scale.setScalar(8);
          me._hit = false;
        } else {
          me.m.visible = false; me.light.intensity = 0;
          const since = local - me.travel;
          // 착탄 순간: 넓은 반경 스핀 + 강한 넉백 + 급감속
          if (since < 0.06 && !me._hit && raceState === 'racing' && karts) {
            me._hit = true;
            for (const kt of karts) {
              if (kt.invincTimer > 0 || kt.bulletTimer > 0 || kt.lavaTimer > 0) continue;
              if (kt.pos.distanceToSquared(me.target) < 64) { // 반경 8
                kt.spinOut(2.0);
                _p.set(kt.pos.x - me.target.x, 0, kt.pos.z - me.target.z);
                if (_p.lengthSq() > 1e-3) _p.normalize(); else _p.set(1, 0, 0);
                kt.applyShove(_p.multiplyScalar(26));
                kt.speed *= 0.25;
              }
            }
          }
          if (since < 0.6) {                        // 섬광 + 충격파 고리
            me.flash.material.opacity = 0.9 * (1 - since / 0.6); me.flash.scale.setScalar(1 + since * 26);
            me.ring.material.opacity = 0.85 * (1 - since / 0.6); me.ring.scale.setScalar(1 + since * 55);
          } else { me.flash.material.opacity = 0; me.ring.material.opacity = 0; }
        }
      }
    }
    // 뼈 박쥐 비행 + 날갯짓
    if (this._bats) {
      for (const b of this._bats) {
        const ang = b.ang0 + t * b.speed;
        b.group.position.set(b.cx + Math.cos(ang) * b.radius, b.y + Math.sin(t * 1.4 + b.phase) * 4, b.cz + Math.sin(ang) * b.radius);
        b.group.rotation.y = -ang + Math.PI / 2;
        const flap = Math.sin(t * 8 + b.phase) * 0.7;
        b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
      }
    }
    // 익룡 해골 활공(크게, 느리게)
    if (this._pteros) {
      for (const b of this._pteros) {
        const ang = b.ang0 + t * b.speed;
        b.group.position.set(b.cx + Math.cos(ang) * b.radius, b.y + Math.sin(t * 0.7 + b.phase) * 6, b.cz + Math.sin(ang) * b.radius);
        b.group.rotation.y = -ang + Math.PI / 2;
        const flap = Math.sin(t * 3 + b.phase) * 0.5;
        b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
      }
    }
    // 용암 웅덩이 해골(장애물): 솟아오름 → 유지 → 가라앉음, 부딪히면 박살+감속
    if (this._lavaSkels) {
      for (const ls of this._lavaSkels) {
        const local = (t + ls.phase) % ls.period;
        const total = ls.riseDur + ls.upDur + 0.6;
        if (local >= total) { ls.group.visible = false; ls.broken = false; continue; }
        ls.group.visible = true;
        let poolO, skelY;
        if (local < ls.riseDur) { const p = local / ls.riseDur; poolO = p; skelY = -6 + p * 4.8; }
        else if (local < ls.riseDur + ls.upDur) { poolO = 1; skelY = -1.2; }
        else { const p = (local - ls.riseDur - ls.upDur) / 0.6; poolO = 1 - p; skelY = -1.2 - p * 5; }
        ls.pool.material.opacity = poolO * 0.9;
        ls.pool.material.emissiveIntensity = 2.0 + 0.6 * Math.sin(t * 5 + ls.phase);
        ls.skel.position.y = skelY;
        ls.skel.visible = !ls.broken;
        if (!ls.broken && poolO > 0.6 && skelY > -3 && raceState === 'racing' && karts) {
          for (const kt of karts) {
            if (kt.lavaTimer > 0 || kt.invincTimer > 0) continue;
            if (kt.pos.distanceToSquared(ls.group.position) < 9) { ls.broken = true; kt.speed *= 0.45; break; }
          }
        }
      }
    }
    // 뼈 물고기 점프(아치)
    if (this._fish) {
      const jumpDur = 1.8;
      for (const f of this._fish) {
        const local = (t + f.phase) % f.period;
        if (local < jumpDur) {
          f.group.visible = true;
          const pr = local / jumpDur;
          const h = Math.sin(pr * Math.PI) * f.arc;
          f.group.position.set(f.base.x, LAVA_Y + h, f.base.z);
          f.group.rotation.set(0, f.yaw, Math.cos(pr * Math.PI) * 1.1); // 상승 머리↑ 하강 머리↓
        } else {
          f.group.visible = false;
        }
      }
    }
    // 횃불 점멸
    for (let i = 0; i < this._flames.length; i++) {
      const f = this._flames[i];
      const fl = 0.75 + 0.25 * Math.sin(t * 13 + i * 1.7) + 0.1 * Math.sin(t * 31 + i);
      f.scale.set(0.8 + fl * 0.5, 0.7 + fl * 0.7, 0.8 + fl * 0.5);
      f.material.opacity = 0.8 + 0.2 * fl;
    }
    // 마왕 눈/문장 발광 맥동
    for (const m of this._eyes) m.emissiveIntensity = 1.8 + 1.2 * Math.abs(Math.sin(t * 2.2));
    // 불티 상승
    if (this._embers) {
      const arr = this._embers.geometry.attributes.position.array;
      for (let i = 0; i < this._emberSpd.length; i++) {
        arr[i * 3 + 1] += this._emberSpd[i] * dt;
        if (arr[i * 3 + 1] > 44) arr[i * 3 + 1] = LAVA_Y; // 위로 사라지면 재활용
      }
      this._embers.geometry.attributes.position.needsUpdate = true;
    }
  }
}
