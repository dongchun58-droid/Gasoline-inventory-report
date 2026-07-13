// track.js — 스플라인, 도로 메시, 연석, 접지용 샘플 프레임
// Phase 1: 도로를 달릴 수 있고, 접지 높이/이탈 판정을 제공한다.
import * as THREE from 'three';

// §4 제어점 — 지면 주행을 위해 평탄화(y≈0). XZ 레이아웃은 유지.
const CONTROL_POINTS = [
  [0, 0, 0],      [55, 0, -4],    [100, 0, -28],
  [112, 0, -78],  [88, 0, -112],
  [42, 0, -104],  [18, 0, -72],   [-28, 0, -64],
  [-72, 0, -30],
  [-78, 0, 18],
  [-38, 0, 52],   [-8, 0, 24],
];

export const ROAD_WIDTH = 20;
const HALF_W = ROAD_WIDTH / 2;
const SAMPLES = 720;          // 접지 샘플 수 (조밀할수록 접지가 매끈)
const CURB_W = 1;             // 연석 폭 (양끝 1m)

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// 임시 벡터 (매 프레임 GC 방지)
const _v = new THREE.Vector3();

export class Track {
  constructor(gradientMap) {
    const pts = CONTROL_POINTS.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.length = this.curve.getLength();

    // --- 접지용 샘플 프레임 (뱅킹 없는 안정적 프레임) ---
    this.samplePos = [];   // Vector3
    this.sampleTan = [];   // Vector3 (진행방향)
    this.sampleLat = [];   // Vector3 (측면, 우측 +)
    this.sampleUp = [];    // Vector3 (도로 위)
    this.sampleDist = [];  // 시작점부터 누적거리
    let acc = 0;
    let prev = null;
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const pos = this.curve.getPointAt(t % 1);
      const tan = this.curve.getTangentAt(t % 1).normalize();
      const lat = _v.copy(tan).cross(WORLD_UP);
      if (lat.lengthSq() < 1e-6) lat.set(1, 0, 0);
      lat.normalize();
      const up = new THREE.Vector3().copy(lat).cross(tan).normalize();
      if (prev) acc += pos.distanceTo(prev);
      this.samplePos.push(pos.clone());
      this.sampleTan.push(tan.clone());
      this.sampleLat.push(lat.clone());
      this.sampleUp.push(up);
      this.sampleDist.push(acc);
      prev = pos;
    }
    this.totalDist = acc;

    this.group = new THREE.Group();
    this._buildRoad(gradientMap);
    this._buildFinishLine();
  }

  _buildRoad(gradientMap) {
    const N = SAMPLES; // closed → 마지막=처음
    const positions = new Float32Array((N) * 2 * 3);
    const normals = new Float32Array((N) * 2 * 3);
    const uvs = new Float32Array((N) * 2 * 2);
    const tileLen = 8; // 텍스처 1타일 = 도로 8m

    for (let i = 0; i < N; i++) {
      const p = this.samplePos[i];
      const lat = this.sampleLat[i];
      const up = this.sampleUp[i];
      const d = this.sampleDist[i];
      const vCoord = d / tileLen;

      const li = i * 6;
      // left edge
      positions[li + 0] = p.x - lat.x * HALF_W;
      positions[li + 1] = p.y - lat.y * HALF_W;
      positions[li + 2] = p.z - lat.z * HALF_W;
      // right edge
      positions[li + 3] = p.x + lat.x * HALF_W;
      positions[li + 4] = p.y + lat.y * HALF_W;
      positions[li + 5] = p.z + lat.z * HALF_W;

      normals[li + 0] = up.x; normals[li + 1] = up.y; normals[li + 2] = up.z;
      normals[li + 3] = up.x; normals[li + 4] = up.y; normals[li + 5] = up.z;

      const ui = i * 4;
      uvs[ui + 0] = 0; uvs[ui + 1] = vCoord;
      uvs[ui + 2] = 1; uvs[ui + 3] = vCoord;
    }

    // 인덱스 (closed loop)
    const indices = [];
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const next = (i + 1) % N;
      const c = next * 2;
      const dd = next * 2 + 1;
      indices.push(a, b, c);
      indices.push(b, dd, c);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    const tex = this._makeRoadTexture();
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap });
    this.roadMesh = new THREE.Mesh(geo, mat);
    this.roadMesh.renderOrder = 0;
    this.group.add(this.roadMesh);
  }

  // 도로 표면 텍스처: 아스팔트 + 센터라인(시안) + 양끝 체커 연석
  _makeRoadTexture() {
    const W = 128, H = 128;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');

    // 아스팔트
    g.fillStyle = '#2A2440';
    g.fillRect(0, 0, W, H);

    const curbPx = Math.round((CURB_W / ROAD_WIDTH) * W);
    const checks = 8;
    const cellH = H / checks;
    // 좌/우 연석 체커 (#FF3355 / #FFFFFF)
    for (let side = 0; side < 2; side++) {
      const x0 = side === 0 ? 0 : W - curbPx;
      for (let c = 0; c < checks; c++) {
        g.fillStyle = ((c + side) % 2 === 0) ? '#FF3355' : '#FFFFFF';
        g.fillRect(x0, c * cellH, curbPx, cellH);
      }
    }

    // 센터라인 (시안 #00E5FF)
    const lineW = Math.max(2, Math.round(W * 0.03));
    g.fillStyle = '#00E5FF';
    g.fillRect(W / 2 - lineW / 2, 0, lineW, H);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // 피니시 체커 라인 (t=0)
  _buildFinishLine() {
    const p = this.samplePos[0];
    const lat = this.sampleLat[0];
    const tan = this.sampleTan[0];
    const up = this.sampleUp[0];

    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 16;
    const g = cv.getContext('2d');
    const cols = 16;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < 2; y++) {
        g.fillStyle = ((x + y) % 2 === 0) ? '#ECECF2' : '#12101f';
        g.fillRect(x * (128 / cols), y * 8, 128 / cols, 8);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;

    const depth = 3;
    const geo = new THREE.PlaneGeometry(ROAD_WIDTH - 0.4, depth);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
    const line = new THREE.Mesh(geo, mat);

    // 도로 평면에 눕히기: 기저를 lat/tan/up으로
    const m = new THREE.Matrix4().makeBasis(lat, up, tan.clone().negate());
    line.quaternion.setFromRotationMatrix(m);
    line.position.copy(p).addScaledVector(up, 0.02);
    this.group.add(line);
  }

  // --- 접지 조회 ---
  // 월드 위치 p 근처의 도로 정보를 lastIdx 힌트로 빠르게 검색
  sampleNear(p, lastIdx) {
    const N = this.samplePos.length;
    let best = lastIdx | 0;
    let bestD = Infinity;
    const WIN = 40;
    for (let k = -WIN; k <= WIN; k++) {
      let i = (best + k) % N;
      if (i < 0) i += N;
      const d = this.samplePos[i].distanceToSquared(p);
      if (d < bestD) { bestD = d; best = i; }
    }
    // 윈도 경계에 걸리면 한 번 더 (급이동 대비)
    return best;
  }

  // 접지 결과: { onRoad, height, up, lat, tan, lateral, idx }
  ground(p, lastIdx, out) {
    const i = this.sampleNear(p, lastIdx);
    const sp = this.samplePos[i];
    const lat = this.sampleLat[i];
    const up = this.sampleUp[i];
    const tan = this.sampleTan[i];
    // 측면 오프셋
    _v.copy(p).sub(sp);
    const lateral = _v.dot(lat);
    // 도로 평면 위 표면점의 높이(up축 성분)
    const surfaceY = sp.y + lat.y * lateral;
    out.idx = i;
    out.height = surfaceY;
    out.up = up;
    out.lat = lat;
    out.tan = tan;
    out.lateral = lateral;
    out.onRoad = Math.abs(lateral) <= HALF_W + 0.5;
    return out;
  }

  // 지형 평탄화용: 임의 (x,z)에서 도로 중심선까지의 수평 최단거리
  pathDistanceXZ(x, z) {
    let best = Infinity;
    const arr = this.samplePos;
    for (let i = 0; i < arr.length; i += 4) {
      const dx = arr[i].x - x, dz = arr[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  get halfWidth() { return HALF_W; }
  // 스타트 지점(그리드) 정보
  startInfo() {
    return {
      pos: this.samplePos[0].clone(),
      tan: this.sampleTan[0].clone(),
      lat: this.sampleLat[0].clone(),
      up: this.sampleUp[0].clone(),
    };
  }
}
