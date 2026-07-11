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

export class Scenery {
  constructor(track, gradientMap) {
    this.track = track;
    this.gm = gradientMap;
    this.group = new THREE.Group();
    this.coins = [];   // 애니메이션되는 개별 메시
    this.balloons = null;
    this._t = 0;

    this._buildEdgeProps();
    this._buildRings();
    this._buildBalloons();
    this._buildCoins();
    this._buildFinishArch();
    this._buildClouds();
    this._buildIslands();
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
