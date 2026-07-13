// scenery.js — 알록달록·아기자기한 트랙 월드 (마리오 월드 감성, 오리지널)
// 네온 기둥/부유 링/풍선/버섯/회전 별·코인/피니시 아치/구름.
// 반복 소품은 InstancedMesh로 배치해 드로콜을 아낀다.
import * as THREE from 'three';

const PALETTE = [0xff4fa3, 0x37e0ff, 0xffd54a, 0x5ce06a, 0x9b5cff, 0xff8a3d];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function toon(color, gradientMap, emissiveI = 0) {
  return new THREE.MeshToonMaterial({
    color, gradientMap,
    emissive: color, emissiveIntensity: emissiveI,
  });
}

// 결정적(deterministic) 언덕 높이 — Math.random 미사용
function hills(x, z) {
  return (
    Math.sin(x * 0.035) * 6 +
    Math.cos(z * 0.03) * 5 +
    Math.sin((x + z) * 0.02) * 4 +
    Math.cos(x * 0.08 + z * 0.05) * 2
  );
}

export class Scenery {
  constructor(track, gradientMap) {
    this.track = track;
    this.gm = gradientMap;
    this.group = new THREE.Group();
    this.coins = [];   // 애니메이션되는 개별 메시
    this.balloons = null;
    this._t = 0;

    this._buildLandscape();  // 저 아래 초록 대지 (트랙 뒤 풍경)
    this._buildEdgeProps();
    this._buildRings();
    this._buildBalloons();
    this._buildCoins();
    this._buildFinishArch();
    this._buildClouds();
  }

  // 도로 가장자리 바깥에 네온 기둥 + 버섯을 번갈아 배치
  _buildEdgeProps() {
    const track = this.track;
    const N = track.samplePos.length;
    const step = 26;                    // 샘플 간격
    const gap = track.halfWidth + 2.2;  // 도로 밖으로

    const spots = [];
    for (let i = 0; i < N - 1; i += step) {
      for (const side of [-1, 1]) {
        const p = track.samplePos[i];
        const lat = track.sampleLat[i];
        const up = track.sampleUp[i];
        spots.push({
          x: p.x + lat.x * gap * side,
          y: p.y,
          z: p.z + lat.z * gap * side,
          up,
          idx: i,
        });
      }
    }

    // 네온 기둥 (플랫 비비드 색 → 블룸이 각자 색으로 먹음)
    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.45, 6, 8);
    const pillarMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, spots.length);
    pillars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spots.length * 3), 3);
    // 기둥 위 반짝 구
    const capGeo = new THREE.SphereGeometry(0.55, 12, 10);
    const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), spots.length);
    caps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spots.length * 3), 3);

    const col = new THREE.Color();
    spots.forEach((sp, k) => {
      const c = PALETTE[k % PALETTE.length];
      col.set(c);
      _q.setFromUnitVectors(_up, sp.up);
      _p.set(sp.x, sp.y + 3, sp.z);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      pillars.setMatrixAt(k, _m);
      pillars.setColorAt(k, col);
      _p.set(sp.x, sp.y + 6.2, sp.z);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      caps.setMatrixAt(k, _m);
      caps.setColorAt(k, col);
    });
    pillars.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    this.group.add(pillars, caps);
  }

  // 트랙 위를 지나는 공중 부유 링 (통과하는 느낌)
  _buildRings() {
    const track = this.track;
    const N = track.samplePos.length;
    const step = 90;
    const spots = [];
    for (let i = 40; i < N - 1; i += step) spots.push(i);

    const geo = new THREE.TorusGeometry(4.2, 0.35, 10, 24);
    const ring = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), spots.length);
    ring.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spots.length * 3), 3);
    const col = new THREE.Color();
    spots.forEach((i, k) => {
      const p = track.samplePos[i];
      const up = track.sampleUp[i];
      const tan = track.sampleTan[i];
      col.set(PALETTE[(k + 2) % PALETTE.length]);
      // 링 면이 진행방향을 향하도록 (통과)
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      _p.copy(p).addScaledVector(up, 4.2);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      ring.setMatrixAt(k, _m);
      ring.setColorAt(k, col);
    });
    ring.instanceMatrix.needsUpdate = true;
    this.group.add(ring);
  }

  // 응원 풍선 (도로 밖 상공, 살랑 바운스)
  _buildBalloons() {
    const track = this.track;
    const N = track.samplePos.length;
    const step = 40;
    const gap = track.halfWidth + 4;
    const spots = [];
    for (let i = 12; i < N - 1; i += step) {
      const side = (i % 80 === 12) ? -1 : 1;
      const p = track.samplePos[i];
      const lat = track.sampleLat[i];
      const up = track.sampleUp[i];
      spots.push({ x: p.x + lat.x * gap * side, y: p.y + 5.5 + (i % 3), z: p.z + lat.z * gap * side });
    }
    const geo = new THREE.SphereGeometry(0.9, 14, 12);
    geo.scale(1, 1.25, 1);
    const balloons = new THREE.InstancedMesh(geo, toon(0xffffff, this.gm, 0.0), spots.length);
    balloons.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spots.length * 3), 3);
    const col = new THREE.Color();
    this._balloonBase = spots;
    spots.forEach((sp, k) => {
      col.set(PALETTE[(k + 4) % PALETTE.length]);
      _p.set(sp.x, sp.y, sp.z);
      _m.compose(_p, _q.identity(), _s.set(1, 1, 1));
      balloons.setMatrixAt(k, _m);
      balloons.setColorAt(k, col);
    });
    balloons.instanceMatrix.needsUpdate = true;
    this.balloons = balloons;
    this.group.add(balloons);
  }

  // 회전하는 금빛 별 (도로 근처, 눈길 끌기)
  _buildCoins() {
    const track = this.track;
    const N = track.samplePos.length;
    const step = 60;
    const starGeo = this._starGeometry();
    const mat = toon(0xffd54a, this.gm, 1.4);
    for (let i = 24; i < N - 1; i += step) {
      const p = track.samplePos[i];
      const up = track.sampleUp[i];
      const lat = track.sampleLat[i];
      const star = new THREE.Mesh(starGeo, mat);
      const side = (i % 120 < 60) ? -1 : 1;
      star.position.copy(p)
        .addScaledVector(up, 2.4)
        .addScaledVector(lat, (track.halfWidth - 2) * side);
      star.userData.spin = 0.02 + Math.abs((i % 7) - 3) * 0.004;
      this.coins.push(star);
      this.group.add(star);
    }
  }

  _starGeometry() {
    const shape = new THREE.Shape();
    const spikes = 5, outer = 0.9, inner = 0.42;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
    geo.center();
    return geo;
  }

  // 피니시 아치 (스타트/피니시 상공)
  _buildFinishArch() {
    const s = this.track.startInfo();
    const arch = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.4, 0.5, 8, 10);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, toon(0xff4fa3, this.gm, 0.6));
      post.position.copy(s.pos)
        .addScaledVector(s.lat, (this.track.halfWidth + 0.6) * side)
        .addScaledVector(s.up, 4);
      arch.add(post);
    }
    // 상단 배너
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(this.track.halfWidth * 2 + 2, 1.6, 0.4),
      toon(0x37e0ff, this.gm, 0.7)
    );
    banner.position.copy(s.pos).addScaledVector(s.up, 8);
    // 배너를 트랙 가로로
    _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), s.lat);
    banner.quaternion.copy(_q);
    arch.add(banner);
    // FINISH 글자 텍스처
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#101030'; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#ffffff';
    g.font = 'bold 46px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★ FINISH ★', 256, 34);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(this.track.halfWidth * 2 + 1.5, 1.3),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    label.position.copy(banner.position).addScaledVector(s.tan, 0.3);
    label.quaternion.copy(_q);
    arch.add(label);
    this.group.add(arch);
  }

  // 폭신한 구름 (깊이감)
  _buildClouds() {
    const cloudMat = toon(0xfff2fb, this.gm, 0.0);
    const puff = new THREE.SphereGeometry(1, 10, 8);
    const positions = [
      [60, 20, -60], [-70, 26, -30], [10, 30, -120], [120, 18, -40],
      [-40, 22, 60], [40, 34, 30], [-100, 28, -90], [90, 24, -110],
      [0, 40, 0], [-20, 16, -10],
    ];
    for (const [x, y, z] of positions) {
      const cloud = new THREE.Group();
      const n = 4 + Math.floor((Math.abs(x) % 3));
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(puff, cloudMat);
        const r = 3 + (i % 3);
        b.position.set((i - n / 2) * 3.2, Math.sin(i) * 1.2, Math.cos(i) * 2);
        b.scale.setScalar(r);
        cloud.add(b);
      }
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(1.4);
      this.group.add(cloud);
    }
  }

  // 저 아래 떠 있는 알록달록 부유 섬 (깊이감)
  _buildIslands() {
    const islandPos = [
      [40, -30, -50, 0xff8a3d], [-60, -40, 20, 0x5ce06a],
      [20, -50, -100, 0x9b5cff], [-30, -34, -20, 0x37e0ff],
    ];
    for (const [x, y, z, c] of islandPos) {
      const island = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 2, 12), toon(0x5ce06a, this.gm, 0.1));
      island.add(top);
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(9, 12, 12), toon(0x7a5230, this.gm, 0));
      bottom.position.y = -6.8; bottom.rotation.x = Math.PI;
      island.add(bottom);
      // 위에 큰 버섯
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 4, 8), toon(0xfff0d0, this.gm, 0));
      stem.position.y = 3; island.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(c, this.gm, 0.5));
      cap.position.y = 5; cap.scale.set(1, 0.7, 1); island.add(cap);
      island.position.set(x, y, z);
      this.group.add(island);
    }
  }

  // 저 아래 초록 대지: 언덕 지형 + 산 + 호수 + 나무 (트랙은 그 위에 떠 있음)
  _buildLandscape() {
    const CX = 16, CZ = -30, GY = -30;
    const gm = this.gm;

    // --- 언덕 지형 ---
    const size = 760, seg = 60;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color(0x4fae4a);   // 초록
    const cHigh = new THREE.Color(0x8fe06a);  // 밝은 연두
    const cSand = new THREE.Color(0xe8d9a0);  // 낮은 곳 모래빛
    const tmpC = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + CX, wz = pos.getZ(i) + CZ;
      const h = hills(wx, wz);
      pos.setY(i, h);
      const t = THREE.MathUtils.clamp((h + 8) / 20, 0, 1);
      tmpC.copy(h < -4 ? cSand : cLow).lerp(cHigh, t);
      colors[i * 3] = tmpC.r; colors[i * 3 + 1] = tmpC.g; colors[i * 3 + 2] = tmpC.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gm })
    );
    ground.position.set(CX, GY, CZ);
    this.group.add(ground);

    // --- 호수 (파란 원반) ---
    const lakeMat = new THREE.MeshToonMaterial({ color: 0x3fb8ff, gradientMap: gm, transparent: true, opacity: 0.92 });
    const lakeSpots = [[-120, -60], [140, 40], [40, -180], [-40, 120]];
    for (const [lx, lz] of lakeSpots) {
      const lake = new THREE.Mesh(new THREE.CircleGeometry(34, 28), lakeMat);
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(CX + lx, GY - 3.5, CZ + lz);
      this.group.add(lake);
    }

    // --- 먼 산 (링 형태로 둘러쌈) ---
    const mtnMat = new THREE.MeshToonMaterial({ color: 0x5a7d8c, gradientMap: gm });
    const snowMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gm });
    const mtnCount = 14, R = 330;
    for (let i = 0; i < mtnCount; i++) {
      const a = (i / mtnCount) * Math.PI * 2;
      const mx = CX + Math.cos(a) * R;
      const mz = CZ + Math.sin(a) * R;
      const hgt = 70 + (i % 4) * 22;
      const rad = 44 + (i % 3) * 12;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, hgt, 6), mtnMat);
      m.position.set(mx, GY + hgt / 2 - 6, mz);
      this.group.add(m);
      const snow = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.42, hgt * 0.35, 6), snowMat);
      snow.position.set(mx, GY + hgt - hgt * 0.35 / 2 - 6, mz);
      this.group.add(snow);
    }

    // --- 나무 (인스턴스드) ---
    const spots = [];
    const step = 34;
    for (let gx = -size / 2 + 20; gx < size / 2 - 20; gx += step) {
      for (let gz = -size / 2 + 20; gz < size / 2 - 20; gz += step) {
        const idx = Math.round(gx + gz);
        if (Math.abs(idx) % 5 < 2) continue; // 듬성듬성
        const wx = CX + gx + (idx % 7), wz = CZ + gz + (idx % 5);
        const rr = Math.hypot(gx, gz);
        if (rr > 300) continue;            // 산보다 안쪽만
        spots.push({ x: wx, y: GY + hills(wx, wz), z: wz, s: 0.8 + (Math.abs(idx) % 5) * 0.18 });
      }
    }
    const trunkGeo = new THREE.CylinderGeometry(0.7, 0.95, 5, 6);
    const trunks = new THREE.InstancedMesh(trunkGeo, toon(0x7a5230, gm), spots.length);
    const foliageGeo = new THREE.ConeGeometry(3.6, 9, 8);
    const foliage = new THREE.InstancedMesh(foliageGeo, new THREE.MeshToonMaterial({ gradientMap: gm }), spots.length);
    foliage.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spots.length * 3), 3);
    const greens = [0x4fae4a, 0x6bc95a, 0x3f9e6a, 0x8fe06a];
    const col = new THREE.Color();
    spots.forEach((sp, k) => {
      _q.identity();
      _p.set(sp.x, sp.y + 2.5 * sp.s, sp.z);
      _m.compose(_p, _q, _s.set(sp.s, sp.s, sp.s));
      trunks.setMatrixAt(k, _m);
      _p.set(sp.x, sp.y + 7.5 * sp.s, sp.z);
      _m.compose(_p, _q, _s.set(sp.s, sp.s, sp.s));
      foliage.setMatrixAt(k, _m);
      col.set(greens[k % greens.length]);
      foliage.setColorAt(k, col);
    });
    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    this.group.add(trunks, foliage);
  }

  update(dt) {
    this._t += dt;
    // 별 회전
    for (const star of this.coins) {
      star.rotation.y += star.userData.spin;
      star.rotation.z = Math.sin(this._t * 2 + star.position.x) * 0.15;
    }
    // 풍선 살랑 바운스 (전체 인스턴스드메시를 부드럽게)
    if (this.balloons) {
      this.balloons.position.y = Math.sin(this._t * 1.3) * 0.6;
    }
  }
}
