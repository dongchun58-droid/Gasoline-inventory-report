// pbrtex.js — 절차적 PBR 텍스처 생성 (Phase 7 Step 2)
// 외부 텍스처 사이트가 차단된 환경이라, 타일링되는 디퓨즈/노멀/러프니스를
// 코드로 생성한다. (결정적 해시 노이즈 — Math.random 미사용)
import * as THREE from 'three';

function hash(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// 타일링되는 fBm 하이트필드 (격자 좌표를 주기로 감싸서 이음매 제거)
export function makeHeightField(size, { cells = 48, octaves = 4, seed = 0 } = {}) {
  const h = new Float32Array(size * size);
  const vnoise = (x, y, period) => {
    let xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const w = (i) => ((i % period) + period) % period; // wrap
    const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed);
    const c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let f = 0, amp = 0.5, period = cells;
      for (let o = 0; o < octaves; o++) {
        f += amp * vnoise((x / size) * period, (y / size) * period, period);
        amp *= 0.5; period *= 2;
      }
      h[y * size + x] = f;
    }
  }
  return h;
}

// 하이트필드 → 탄젠트 공간 노멀맵 (Sobel, 타일링 래핑)
export function normalFromHeight(h, size, strength = 1.0) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  const at = (x, y) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 캔버스(디퓨즈) 밝기 → 노멀맵 (석재 벽돌 등 기존 캔버스 텍스처용)
export function normalFromCanvas(srcCanvas, strength = 1.0) {
  const size = srcCanvas.width;
  const g0 = srcCanvas.getContext('2d');
  const src = g0.getImageData(0, 0, size, srcCanvas.height).data;
  const h = new Float32Array(size * srcCanvas.height);
  for (let i = 0; i < h.length; i++) {
    h[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
  }
  return normalFromHeight(h, size, strength);
}

// 도로(아스팔트) PBR 세트: 디퓨즈(노면+마킹) / 노멀 / 러프니스
// road: { asphalt, center, curbA, curbB } — 맵별 색
export function makeRoadPBR(road, roadWidth, curbW) {
  const S = 512;
  const h = makeHeightField(S, { cells: 96, octaves: 4, seed: 7 });

  // --- 디퓨즈: 아스팔트 입자 + 골재 반점 + 마킹 ---
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const base = new THREE.Color(road.asphalt);
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = h[i];                          // 0~1
    const v = 0.72 + n * 0.55;               // 입자 명암
    img.data[i * 4] = Math.min(255, base.r * 255 * v);
    img.data[i * 4 + 1] = Math.min(255, base.g * 255 * v);
    img.data[i * 4 + 2] = Math.min(255, base.b * 255 * v);
    img.data[i * 4 + 3] = 255;
  }
  // 골재 반점(밝은 점) — 성긴 해시
  for (let k = 0; k < 2600; k++) {
    const x = Math.floor(hash(k, 1, 11) * S), y = Math.floor(hash(1, k, 12) * S);
    const i = (y * S + x) * 4;
    const b = 40 + hash(k, k, 13) * 60;
    img.data[i] = Math.min(255, img.data[i] + b);
    img.data[i + 1] = Math.min(255, img.data[i + 1] + b);
    img.data[i + 2] = Math.min(255, img.data[i + 2] + b);
  }
  g.putImageData(img, 0, 0);
  // 연석 체커 + 센터라인 (기존 마킹 유지)
  const curbPx = Math.round((curbW / roadWidth) * S);
  const checks = 8, cellH = S / checks;
  for (let side = 0; side < 2; side++) {
    const x0 = side === 0 ? 0 : S - curbPx;
    for (let c = 0; c < checks; c++) {
      g.fillStyle = ((c + side) % 2 === 0) ? road.curbA : road.curbB;
      g.fillRect(x0, c * cellH, curbPx, cellH);
    }
  }
  const lineW = Math.max(4, Math.round(S * 0.03));
  g.fillStyle = road.center;
  g.fillRect(S / 2 - lineW / 2, 0, lineW, S);

  const map = new THREE.CanvasTexture(cv);
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  // --- 노멀: 아스팔트 요철 ---
  const normalMap = normalFromHeight(h, S, 2.2);
  normalMap.wrapS = THREE.ClampToEdgeWrapping;

  // --- 러프니스: 입자에 따라 0.78~0.98 ---
  const rcv = document.createElement('canvas');
  rcv.width = S; rcv.height = S;
  const rg = rcv.getContext('2d');
  const rimg = rg.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const r = (0.78 + (1 - h[i]) * 0.2) * 255;
    rimg.data[i * 4] = r; rimg.data[i * 4 + 1] = r; rimg.data[i * 4 + 2] = r; rimg.data[i * 4 + 3] = 255;
  }
  rg.putImageData(rimg, 0, 0);
  const roughnessMap = new THREE.CanvasTexture(rcv);
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, normalMap, roughnessMap };
}
