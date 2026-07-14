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

    this._buildLava();
    this._buildCauseway();
    this._buildBattlements();
    this._buildTowers();
    this._buildStatues();
    this._buildTorches();
    this._buildGate();
    this._buildInterior();
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
      const a = i * 2, b = i * 2 + 1, nxt = (i + 1) % N, c = nxt * 2, d = nxt * 2 + 1;
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

  update(dt) {
    this._t += dt;
    const t = this._t;
    // 용암 흐름 + 맥동 발광 (긴장감)
    if (this._lavaTex) this._lavaTex.offset.y = (this._lavaTex.offset.y - dt * 0.02) % 1;
    if (this._lavaMat) this._lavaMat.emissiveIntensity = 1.35 + 0.5 * Math.sin(t * 1.3);
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
