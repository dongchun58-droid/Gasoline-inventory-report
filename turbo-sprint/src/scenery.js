// scenery.js — 지면 카트 월드 (마리오카트풍, 오리지널)
// 넓은 도로가 초원·언덕 사이를 지나가고, 울타리·나무·꽃·타이어벽·산·호수·구름으로 꾸민다.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _dir = new THREE.Vector3();

// 사실적 표준 재질 (그림자·반사 수용)
function toon(color, gm, emissiveI = 0) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.82, metalness: 0.0,
    emissive: color, emissiveIntensity: emissiveI,
  });
}

// 잔디 디테일 텍스처 (밝기 노이즈 → 지면에 결)
let _grassTex = null;
function grassTexture() {
  if (_grassTex) return _grassTex;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#cfe0bf'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5) % 1, y = (Math.sin(i * 78.233) * 43758.5) % 1;
    const px = Math.abs(x) * 128, py = Math.abs(y) * 128;
    const dark = (i % 3 === 0);
    g.strokeStyle = dark ? 'rgba(120,150,95,0.5)' : 'rgba(235,245,225,0.5)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + (dark ? 1 : -1), py - 3); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  _grassTex = tex;
  return tex;
}

// 결정적 언덕 높이 (Math.random 미사용)
function hills(x, z) {
  return (
    Math.sin(x * 0.028) * 9 +
    Math.cos(z * 0.024) * 7 +
    Math.sin((x + z) * 0.017) * 5 +
    Math.cos(x * 0.06 + z * 0.045) * 2.5
  );
}

export class Scenery {
  constructor(track, gradientMap) {
    this.track = track;
    this.gm = gradientMap;
    this.group = new THREE.Group();

    this._buildLandscape();
    this._buildFences();
    this._buildRoadsideProps();
    this._buildFinishArch();
    this._buildClouds();
  }

  // ---- 지면: 도로 회랑은 평탄, 바깥으로 갈수록 언덕 ----
  _buildLandscape() {
    const track = this.track;
    const gm = this.gm;
    const CX = track.center.x, CZ = track.center.z;
    const RAD = track.radius;
    const CORR = (track.maxHalf || track.halfWidth) + 4; // 회랑 반경(가장 넓은 구간 기준)
    const BLEND = 30;                    // 언덕으로 섞이는 폭

    const size = 2 * (RAD + 340), seg = 130;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x62c24a);
    const cGrass2 = new THREE.Color(0x8fe06a);
    const cSand = new THREE.Color(0xe4d29a);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + CX, wz = pos.getZ(i) + CZ;
      const d = track.pathDistanceXZ(wx, wz);
      let h, shoulder = 0;
      if (d < CORR) { h = -0.15; shoulder = 1; }
      else {
        const k = Math.min(1, (d - CORR) / BLEND);
        h = THREE.MathUtils.lerp(-0.15, hills(wx, wz), k * k);
        shoulder = 1 - k;
      }
      pos.setY(i, h);
      const t = THREE.MathUtils.clamp((h + 6) / 16, 0, 1);
      tmp.copy(cGrass).lerp(cGrass2, t);
      if (shoulder > 0.6) tmp.lerp(cSand, 0.25 * shoulder);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // 잔디 결 UV (넓게 반복)
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, uv.getX(i) * size / 6, uv.getY(i) * size / 6); }
    geo.computeVertexNormals();
    const gtex = grassTexture();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, map: gtex, roughness: 0.95, metalness: 0.0,
    }));
    ground.position.set(CX, 0, CZ);
    this.group.add(ground);
    this._groundH = (x, z) => {
      const d = track.pathDistanceXZ(x, z);
      if (d < CORR) return -0.15;
      const k = Math.min(1, (d - CORR) / BLEND);
      return THREE.MathUtils.lerp(-0.15, hills(x, z), k * k);
    };

    // 호수 (도로에서 먼 곳)
    const lakeMat = new THREE.MeshStandardMaterial({ color: 0x2f9fe0, transparent: true, opacity: 0.85, metalness: 0.2, roughness: 0.12 });
    for (const [fx, fz] of [[-0.5, -0.35], [0.55, 0.2], [0.2, -0.6], [-0.35, 0.5]]) {
      const lx = CX + fx * RAD, lz = CZ + fz * RAD;
      if (track.pathDistanceXZ(lx, lz) < 70) continue;
      const lake = new THREE.Mesh(new THREE.CircleGeometry(38, 24), lakeMat);
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(lx, 1.2, lz);
      this.group.add(lake);
    }

    // 먼 산맥
    const mtnMat = new THREE.MeshStandardMaterial({ color: 0x6a8a9c, roughness: 0.92, metalness: 0 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
    const R = RAD + 210, MC = 20;
    for (let i = 0; i < MC; i++) {
      const a = (i / MC) * Math.PI * 2;
      const mx = CX + Math.cos(a) * R, mz = CZ + Math.sin(a) * R;
      const hgt = 100 + (i % 4) * 30, rad = 60 + (i % 3) * 16;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, hgt, 6), mtnMat);
      m.position.set(mx, hgt / 2 - 4, mz); this.group.add(m);
      const sn = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.4, hgt * 0.34, 6), snowMat);
      sn.position.set(mx, hgt - hgt * 0.34 / 2 - 4, mz); this.group.add(sn);
    }

    this._buildTrees();
  }

  _buildTrees() {
    const track = this.track;
    const gm = this.gm;
    const CX = track.center.x, CZ = track.center.z, RAD = track.radius;
    const spots = [];
    const reach = RAD + 180, step = 34;
    for (let x = -reach; x < reach; x += step) {
      for (let z = -reach; z < reach; z += step) {
        const idx = Math.round(x * 0.13 + z * 0.11);
        if (Math.abs(idx) % 4 === 0) continue;
        const wx = CX + x + (idx % 9), wz = CZ + z + (idx % 7);
        const d = track.pathDistanceXZ(wx, wz);
        if (d < (track.maxHalf || track.halfWidth) + 5) continue;   // 도로 위엔 없음
        if (Math.hypot(x, z) > RAD + 170) continue;
        spots.push({ x: wx, y: this._groundH(wx, wz), z: wz, s: 0.85 + (Math.abs(idx) % 5) * 0.16 });
      }
    }
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.95, 5, 6), toon(0x7a5230, gm), spots.length);
    const foliage = new THREE.InstancedMesh(new THREE.SphereGeometry(3.4, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }), spots.length);
    foliage.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spots.length * 3), 3);
    const greens = [0x3f9e3a, 0x59bd4a, 0x4fae4a, 0x2f8e5a];
    const col = new THREE.Color();
    spots.forEach((sp, k) => {
      _q.identity();
      _m.compose(_p.set(sp.x, sp.y + 2.5 * sp.s, sp.z), _q, _s.set(sp.s, sp.s, sp.s));
      trunks.setMatrixAt(k, _m);
      _m.compose(_p.set(sp.x, sp.y + 6.5 * sp.s, sp.z), _q, _s.set(sp.s, sp.s * 1.15, sp.s));
      foliage.setMatrixAt(k, _m);
      col.set(greens[k % greens.length]); foliage.setColorAt(k, col);
    });
    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    this.group.add(trunks, foliage);
  }

  // ---- 도로 양쪽 나무 울타리 ----
  _buildFences() {
    const track = this.track;
    const gm = this.gm;
    const N = track.samplePos.length;
    const step = 8;
    const sides = [[], []];
    for (let i = 0; i < N - 1; i += step) {
      const p = track.samplePos[i], lat = track.sampleLat[i], tan = track.sampleTan[i];
      const gap = (track.sampleHalf ? track.sampleHalf[i] : track.halfWidth) + 1.3; // 가변폭 추종
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        sides[s].push({
          x: p.x + lat.x * gap * side, z: p.z + lat.z * gap * side, tan,
        });
      }
    }
    const postCount = sides[0].length + sides[1].length;
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 1.6, 0.35), toon(0x9c6b3f, gm), postCount);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.22, 0.16), toon(0xb98a52, gm), postCount * 2);
    let pi = 0, ri = 0;
    for (const arr of sides) {
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i];
        _q.identity();
        _m.compose(_p.set(a.x, 0.8, a.z), _q, _s.set(1, 1, 1));
        posts.setMatrixAt(pi++, _m);
        // 다음 기둥으로 레일 2줄
        const b = arr[(i + 1) % arr.length];
        _dir.set(b.x - a.x, 0, b.z - a.z);
        const len = _dir.length();
        if (len < 0.1 || len > step * 3) { // 랩 경계 등 과도한 간격은 스킵
          _m.compose(_p.set(0, -999, 0), _q, _s.set(0.001, 0.001, 0.001));
          rails.setMatrixAt(ri++, _m); rails.setMatrixAt(ri++, _m); continue;
        }
        _dir.normalize();
        _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), _dir);
        for (const hy of [0.6, 1.15]) {
          _m.compose(_p.set((a.x + b.x) / 2, hy, (a.z + b.z) / 2), _q, _s.set(len, 1, 1));
          rails.setMatrixAt(ri++, _m);
        }
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    this.group.add(posts, rails);
  }

  // ---- 꽃밭 · 타이어벽 · 응원 풍선 ----
  _buildRoadsideProps() {
    const track = this.track;
    const gm = this.gm;
    const N = track.samplePos.length;

    // 꽃밭 (도로 옆 알록달록 반구 클러스터)
    const flowerCols = [0xff4d6d, 0xffd23f, 0xff8fab, 0x9b5cff, 0xffffff];
    const flowerGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const flowerCount = 0;
    const clusters = [];
    for (let i = 60; i < N - 1; i += 130) clusters.push(i);
    const totalFlowers = clusters.length * 2 * 14;
    const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }), totalFlowers);
    flowers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalFlowers * 3), 3);
    const stem = new THREE.MeshStandardMaterial({ color: 0x3f9e3a, roughness: 0.8 });
    let fi = 0;
    const col = new THREE.Color();
    for (const ci of clusters) {
      const p = track.samplePos[ci], lat = track.sampleLat[ci], tan = track.sampleTan[ci];
      for (const side of [-1, 1]) {
        const bx = p.x + lat.x * (track.halfWidth + 3) * side;
        const bz = p.z + lat.z * (track.halfWidth + 3) * side;
        for (let f = 0; f < 14; f++) {
          const ox = (f % 4 - 1.5) * 1.1 + (side) * 0;
          const oz = (Math.floor(f / 4) - 1.5) * 1.1;
          const fx = bx + lat.x * ox + tan.x * oz;
          const fz = bz + lat.z * ox + tan.z * oz;
          _q.identity();
          _m.compose(_p.set(fx, 0.5, fz), _q, _s.set(1, 1, 1));
          flowers.setMatrixAt(fi, _m);
          col.set(flowerCols[(f + ci) % flowerCols.length]);
          flowers.setColorAt(fi, col);
          fi++;
        }
      }
    }
    flowers.instanceMatrix.needsUpdate = true;
    this.group.add(flowers);

    // 타이어벽 (코너 바깥, 검은 토러스 3단 스택)
    const tireGeo = new THREE.TorusGeometry(0.9, 0.45, 8, 12);
    const tireMat = toon(0x1a1a20, gm);
    const tireSpots = [];
    // 곡률 큰 지점 몇 곳
    for (let i = 40; i < N - 1; i += 70) tireSpots.push(i);
    const tires = new THREE.InstancedMesh(tireGeo, tireMat, tireSpots.length * 2 * 3);
    let ti = 0;
    for (const si of tireSpots) {
      const p = track.samplePos[si], lat = track.sampleLat[si];
      for (const side of [-1, 1]) {
        const bx = p.x + lat.x * (track.halfWidth + 2.2) * side;
        const bz = p.z + lat.z * (track.halfWidth + 2.2) * side;
        for (let h = 0; h < 3; h++) {
          _q.setFromAxisAngle(_up, si + h);
          _q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
          _m.compose(_p.set(bx, 0.5 + h * 0.7, bz), _q, _s.set(1, 1, 1));
          tires.setMatrixAt(ti++, _m);
        }
      }
    }
    tires.instanceMatrix.needsUpdate = true;
    this.group.add(tires);
  }

  // ---- 스타트/피니시 배너 아치 ----
  _buildFinishArch() {
    const s = this.track.startInfo();
    const gm = this.gm;
    const arch = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.5, 0.6, 9, 10);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, toon(0xffffff, gm));
      post.position.copy(s.pos).addScaledVector(s.lat, (this.track.halfWidth + 1) * side).addScaledVector(s.up, 4.5);
      arch.add(post);
    }
    // 배너
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#e23b3b'; g.fillRect(0, 0, 1024, 128);
    // 체커 테두리
    for (let x = 0; x < 32; x++) for (let y = 0; y < 2; y++) {
      g.fillStyle = ((x + y) % 2) ? '#ffffff' : '#181818';
      g.fillRect(x * 32, y === 0 ? 0 : 108, 32, 20);
    }
    g.fillStyle = '#ffffff';
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★ TURBO SPRINT ★', 512, 66);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(this.track.halfWidth * 2 + 3, 2.4, 0.3),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    banner.position.copy(s.pos).addScaledVector(s.up, 8.4);
    _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), s.lat);
    banner.quaternion.copy(_q);
    arch.add(banner);
    this.group.add(arch);
  }

  _buildClouds() {
    const gm = this.gm;
    const cloudMat = toon(0xffffff, gm, 0.0);
    const puff = new THREE.SphereGeometry(1, 10, 8);
    const positions = [
      [80, 70, -80], [-90, 90, -30], [10, 100, -160], [160, 66, -60],
      [-60, 80, 90], [60, 110, 40], [-140, 96, -120], [120, 84, -150],
    ];
    for (const [x, y, z] of positions) {
      const cloud = new THREE.Group();
      const n = 5;
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(puff, cloudMat);
        b.position.set((i - n / 2) * 3.4, Math.sin(i) * 1.1, Math.cos(i) * 2);
        b.scale.setScalar(3.5 + (i % 3));
        cloud.add(b);
      }
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(1.6);
      this.group.add(cloud);
    }
  }

  update(dt) { /* 정적 배경 (동적 요소는 items/karts) */ }
}
