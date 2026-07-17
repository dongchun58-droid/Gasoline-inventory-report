// ice.js — 얼음 왕국 맵 배경 (거대 얼음성·크리스마스 출발문·얼음동굴·바다·눈밭, 오리지널)
import * as THREE from 'three';
import { normalFromCanvas } from './pbrtex.js';

const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _p2 = new THREE.Vector3();

// 바다 표면 텍스처(진파랑 + 잔물결·포말) — 용암처럼 스크롤해서 파도 느낌(평면은 안정적으로 고정)
function waterTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#0c4488'); grad.addColorStop(0.5, '#0f4f95'); grad.addColorStop(1, '#0a3d7a');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  // 잔물결(밝은/어두운 곡선)
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * 128 + (Math.sin(i * 3.1) * 6);
    g.strokeStyle = i % 2 ? 'rgba(120,180,240,0.35)' : 'rgba(8,40,90,0.4)';
    g.lineWidth = 1.5 + (i % 2);
    g.beginPath();
    for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin((x + i * 20) * 0.08) * 3);
    g.stroke();
  }
  // 흰 포말 점점이
  for (let i = 0; i < 40; i++) {
    const x = (Math.abs(Math.sin(i * 12.9) * 43758.5) % 1) * 128;
    const y = (Math.abs(Math.sin(i * 78.2) * 43758.5) % 1) * 128;
    g.fillStyle = 'rgba(220,240,255,0.5)';
    g.fillRect(x, y, 2 + (i % 2), 1.5);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const SEA_Y = -4.5;         // 바다 수면 높이(도로보다 낮음)
// 작은 얼음성(원뿔) 파라미터 — maps.js iceTrack와 공유. 큰 평지 루프 좌상단에 위치.
// scale은 트랙에서 x,z에만 적용됨. Cx,Cz=나선 중심(제어점 단위).
export const ICE_MTN = { Cx: -4, Cz: -82, Rb: 36, Rt: 14, topY: 28, ppt: 12, upTurns: 1.5, downTurns: 0.5, aIn: -0.7 };

// 반투명 얼음 재질 (주행 시선을 가리지 않도록 비교적 불투명하게)
function iceMat(color = 0xbfe4ff, opacity = 0.9, rough = 0.15) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.0, transmission: 0.1,
    transparent: true, opacity, clearcoat: 0.7, clearcoatRoughness: 0.25,
    ior: 1.31, thickness: 1.0,
  });
}
function snowMat(color = 0xf2f9ff) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0 });
}

// 미끄러운 얼음 바닥 텍스처 — 갈라진 결빙(균열) + 반짝임. 도로 위에서 '아 얼음이다' 하고 보이게.
function iceFloorTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 60, 8, 64, 64, 92);
  grad.addColorStop(0, '#f4ffff'); grad.addColorStop(0.6, '#d2f2ff'); grad.addColorStop(1, '#a6def8');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  // 균열(파란 실금) — 결정적(sin 해시)
  g.strokeStyle = 'rgba(74,140,196,0.55)'; g.lineWidth = 1.5; g.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    let x = Math.abs(Math.sin(i * 12.9) * 43758.5) % 1 * 128, y = Math.abs(Math.sin(i * 78.2) * 43758.5) % 1 * 128;
    g.beginPath(); g.moveTo(x, y);
    for (let j = 1; j <= 3; j++) { x += Math.sin(i * 3.1 + j) * 10; y += Math.cos(i * 2.7 + j) * 10; g.lineTo(x, y); }
    g.stroke();
  }
  // 반짝 하이라이트
  for (let i = 0; i < 12; i++) {
    const x = Math.abs(Math.sin(i * 5.3) * 12345.6) % 1 * 128, y = Math.abs(Math.sin(i * 9.1) * 12345.6) % 1 * 128;
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x, y, 1.5 + (i % 2), 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class IceScenery {
  constructor(track, gradientMap) {
    this.track = track;
    this.group = new THREE.Group();
    this._t = 0;
    this._twinkle = [];

    this._buildGround();
    this._buildSea();
    this._buildWhale();
    this._buildMountain();
    this._buildStartGate();
    this._buildIceCave();
    this._buildPines();
    this._buildBergs();
    this._buildAuroraGlow();
    this._buildSlippery();
    this._buildFallingSnow();
  }

  // ---- 미끄러운 얼음 구간: 도로 '전체 폭 x 길게' 얼어붙은 큰 구간(무조건 지나가며 미끄러짐) ----
  _buildSlippery() {
    const t = this.track;
    const N = t.samplePos.length;
    const tex = iceFloorTexture();
    const iceMat = new THREE.MeshPhysicalMaterial({ map: tex, color: 0xffffff, roughness: 0.04, metalness: 0.0,
      clearcoat: 1.0, clearcoatRoughness: 0.03, transparent: true, opacity: 0.92, depthWrite: false });
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xeafaff, transparent: true, opacity: 0.85, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
    this._icePatches = [];
    // 평지 구간(상승로 0.18~0.43·점프 gap은 피함) — 도로 전 폭을 덮는 큰 얼음 구간
    const spots = [0.06, 0.12, 0.60, 0.70, 0.80, 0.92];
    for (const tt of spots) {
      const i = Math.floor(tt * N) % N;
      const p = t.samplePos[i], lat = t.sampleLat[i], up = t.sampleUp[i], tan = t.sampleTan[i];
      const hw = (t.sampleHalf ? t.sampleHalf[i] : t.halfWidth);
      const halfLen = 8;                       // 도로 진행방향 길이(반)
      _m.makeBasis(lat, tan, up);              // X=lat, Y=tan → 평면이 도로에 눕고 법선=up
      const q = new THREE.Quaternion().setFromRotationMatrix(_m);
      // 본체(도로 전 폭 x 길이 타원)
      const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 44), iceMat);
      patch.quaternion.copy(q); patch.scale.set(hw * 0.98, halfLen, 1);
      patch.position.copy(p).addScaledVector(up, 0.05);
      this.group.add(patch);
      // 밝은 테두리(경계)
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.965, 1.0, 44), rimMat);
      rim.quaternion.copy(q); rim.scale.set(hw * 0.98, halfLen, 1);
      rim.position.copy(p).addScaledVector(up, 0.07);
      this.group.add(rim);
      // 판정용: 도로 정렬 박스(폭 x 길이)
      this._icePatches.push({
        cx: p.x, cz: p.z, tx: tan.x, tz: tan.z, lx: lat.x, lz: lat.z,
        halfLen: halfLen + 1, hw: hw + 1,
      });
    }
  }

  // ---- 하늘에서 떨어지는 얼음덩이 (여러 곳) ----
  _buildFallingSnow() {
    const t = this.track;
    const N = t.samplePos.length;
    const snow = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.85 });
    this._snowballs = [];
    // 코스 곳곳(상승로·평지·하단 바다변) 여러 지점에서 낙하
    const spots = [0.03, 0.09, 0.16, 0.34, 0.40, 0.60, 0.68, 0.76, 0.83, 0.90, 0.96];
    for (let s = 0; s < spots.length; s++) {
      const i = Math.floor(spots[s] * N) % N;
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), snow);
      this.group.add(ball);
      // 경고 링(착지 지점)
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 20),
        new THREE.MeshBasicMaterial({ color: 0x2f8fd6, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
      this.group.add(ring);
      // 위상·주기를 어긋나게 해서 여기저기서 번갈아 떨어지도록
      this._snowballs.push({ i0: i, ball, ring, phase: (s * 0.37) % 1, P: 2.6 + (s % 4) * 0.35 });
    }
  }

  _updateHazards(dt, karts) {
    const t = this.track;
    // 미끄러운 얼음 구간(도로 정렬 박스 판정)
    if (this._icePatches && karts) {
      for (const k of karts) {
        for (const ip of this._icePatches) {
          const dx = k.pos.x - ip.cx, dz = k.pos.z - ip.cz;
          const along = dx * ip.tx + dz * ip.tz, latr = dx * ip.lx + dz * ip.lz;
          if (Math.abs(along) < ip.halfLen && Math.abs(latr) < ip.hw) { k.setIce(1.2); break; }
        }
      }
    }
    // 떨어지는 눈덩이
    if (this._snowballs) {
      for (const sb of this._snowballs) {
        const i = sb.i0;
        const p = t.samplePos[i], lat = t.sampleLat[i], up = t.sampleUp[i];
        const off = Math.sin((this._t + sb.phase) * 0.7) * (t.halfWidth * 0.6);
        const cyc = ((this._t / sb.P) + sb.phase) % 1;
        const groundP = _p2.copy(p).addScaledVector(lat, off);
        // 낙하: cyc 0→0.85 하강, 이후 리셋
        const fall = Math.min(1, cyc / 0.82);
        const y = 95 * (1 - fall) + 2.4;
        sb.ball.position.copy(groundP).addScaledVector(up, y);
        sb.ball.rotation.x += dt * 4; sb.ball.rotation.z += dt * 3;
        sb.ball.visible = cyc < 0.86;
        // 경고 링
        sb.ring.position.copy(groundP).addScaledVector(up, 0.1);
        sb.ring.quaternion.copy(sb.ball.quaternion).identity();
        _m.makeBasis(lat, up, t.sampleTan[i]); sb.ring.quaternion.setFromRotationMatrix(_m); sb.ring.rotateX(-Math.PI / 2);
        sb.ring.material.opacity = 0.3 + 0.5 * fall;
        sb.ring.scale.setScalar(1 + (1 - fall) * 0.5);
        sb.ring.visible = cyc < 0.9;
        // 착지 순간 충돌
        if (cyc > 0.78 && cyc < 0.9 && karts) {
          for (const k of karts) {
            if (k.airborne || k.invincTimer > 0 || k.bulletTimer > 0) continue;
            const dx = k.pos.x - groundP.x, dz = k.pos.z - groundP.z;
            if (dx * dx + dz * dz < 20) { k.spinOut(0.9); k.setIce(0.4); }
          }
        }
      }
    }
  }

  // ---- 눈밭 지면(육지) ----
  _buildGround() {
    const t = this.track;
    const size = 2 * (t.radius + 520);
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const g = new THREE.Mesh(geo, snowMat(0xeaf4ff));
    g.position.set(t.center.x, -0.6, t.center.z);
    g.receiveShadow = true;
    this.group.add(g);
  }

  // ---- 바다: 하단 물결(굴곡) 해안선을 따라 넓게. 스케치처럼 딥(만)은 물에 잠기고 혹은 육지 ----
  _buildSea() {
    const t = this.track;
    const N = t.samplePos.length;
    const se = (t.seaEdges && t.seaEdges[0]) || [0.58, 0.97, 1];
    const i0 = Math.floor(se[0] * N), i1 = Math.floor(se[1] * N);
    // 하단(바다 구간) 도로 샘플의 범위 계산
    let minZ = 1e9, maxZ = -1e9, minX = 1e9, maxX = -1e9;
    for (let i = i0; i <= i1; i++) {
      const p = t.samplePos[i % N];
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    }
    const beach = t.halfWidth + 16;              // 혹(가장 안쪽) 바깥의 좁은 해변
    const innerZ = minZ + beach;                 // 해안선(안쪽 가장자리) — 이보다 +z 는 바다
    // 수평선까지 넓게(그 너머로 흰 눈밭·나무가 안 보이도록)
    const width = (maxX - minX) + 1200, depth = 2200;
    const cx = (minX + maxX) / 2;
    // 용암과 동일한 방식: '평평한' 판 + 스크롤 텍스처(정점을 움직이지 않으므로 도로 위로 안 튐)
    const tex = waterTexture();
    tex.repeat.set(width / 60, depth / 60);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, color: 0x0e4d92, roughness: 0.28, metalness: 0.25,
      normalMap: normalFromCanvas(tex.image, 0.8),
    });
    this._seaTex = tex;
    const geo = new THREE.PlaneGeometry(width, depth, 1, 1); geo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(geo, mat);
    sea.position.set(cx, -0.5, innerZ + depth / 2);        // 눈밭(-0.6) 위, 도로(0) 아래로 고정(안정)
    sea.userData.noShadow = true;
    this._sea = sea; this._seaMat = mat;
    this.group.add(sea);
    this._seaCenter = { x: cx, z: innerZ + 120, innerZ };   // 고래·유빙 배치용
    // 물가 포말 띠(도로 바깥 해안선)
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xeafaff, transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false });
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(width, 12), foamMat); foam.rotateX(-Math.PI / 2);
    foam.position.set(cx, -0.42, innerZ);
    this.group.add(foam);
    // 떠다니는 유빙(하양)
    const floeMat = snowMat(0xf2fbff);
    for (let i = 0; i < 8; i++) {
      const px = minX + ((i * 137) % Math.max(1, (maxX - minX)));
      const pz = innerZ + 40 + ((i * 71) % 240);
      const floe = new THREE.Mesh(new THREE.CylinderGeometry(6 + (i % 3) * 3, 8 + (i % 3) * 3, 2, 6), floeMat);
      floe.position.set(px, -0.45, pz); floe.userData.noShadow = true;
      this.group.add(floe);
    }
  }

  // 바다 표면 스크롤(용암과 동일 — 텍스처만 흘려 파도 느낌, 판은 고정)
  _animateSea(dt) {
    if (!this._seaTex) return;
    this._seaTex.offset.y = (this._seaTex.offset.y - dt * 0.05) % 1;
    this._seaTex.offset.x = (this._seaTex.offset.x + dt * 0.02) % 1;
  }

  // ---- 북극고래(그린란드고래/보우헤드, 오리지널 카툰): 어두운 몸 + 흰 아래턱 반점. 바다에서 브리칭 ----
  _buildWhale() {
    const t = this.track;
    // 하단 도로(바다 구간) 중앙에서 바깥(바다)으로 밀어 배치 → 도로에서 잘 보임
    const se = (t.seaEdges && t.seaEdges[0]) || [0.58, 0.97, 1];
    const N = t.samplePos.length;
    const im = Math.floor(((se[0] + se[1]) / 2) * N) % N;
    const rp = t.samplePos[im], lat = t.sampleLat[im];
    let ox = lat.x * se[2], oz = lat.z * se[2];
    const on = Math.hypot(ox, oz) || 1; ox /= on; oz /= on;
    const wx = rp.x + ox * 62, wz = rp.z + oz * 62;
    const grp = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.5, metalness: 0.05 });   // 짙은 회흑색
    const skinDk = new THREE.MeshStandardMaterial({ color: 0x1e232b, roughness: 0.55 });
    const chin = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.5 });                    // 흰 아래턱
    const spotM = new THREE.MeshStandardMaterial({ color: 0x2b2f37, roughness: 0.6 });
    const eyeB = new THREE.MeshBasicMaterial({ color: 0x0c0f14 });
    // 몸통(길쭉한 타원) — +Z가 머리 방향, 어두운 색
    const body = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 16), skin);
    body.scale.set(1, 1.05, 2.1); grp.add(body);
    // 큰 머리(보우헤드는 머리가 몸의 1/3, 활처럼 굽은 위턱)
    const head = new THREE.Mesh(new THREE.SphereGeometry(5.2, 18, 14), skin);
    head.scale.set(0.95, 1.15, 1.2); head.position.set(0, 1.6, 9.2); grp.add(head);   // 위로 솟은 이마/위턱
    // 아래턱(흰색, 앞으로 삐죽) + 반점
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 12), chin);
    jaw.scale.set(0.82, 0.5, 1.5); jaw.position.set(0, -1.8, 11.6); grp.add(jaw);
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.4;
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), spotM);
      sp.position.set(Math.sin(a) * 2.4, -2.4 + Math.cos(a) * 0.2, 13.2 - Math.abs(a) * 0.6); grp.add(sp);
    }
    // 활 모양 입선(어두운 위턱이 흰 아래턱을 덮는 경계)
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.35, 8, 16, Math.PI), skinDk);
    mouth.position.set(0, -0.4, 11.4); mouth.rotation.x = Math.PI / 2 + 0.25; grp.add(mouth);
    // 눈(작고 어두움, 머리 옆)
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), eyeB);
      eye.position.set(sx * 4.2, 0.4, 8.0); grp.add(eye);
    }
    // 분수공 자리 살짝 융기
    const blow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), skinDk);
    blow.scale.set(1.4, 0.5, 1); blow.position.set(0, 5.2, 6.5); grp.add(blow);
    // 꼬리(수평 플루크, 넓게) — 보우헤드는 등지느러미 없음
    for (const sx of [-1, 1]) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(4.2, 9, 4), skin);
      fl.rotation.z = Math.PI / 2; fl.rotation.y = sx * 0.55;
      fl.scale.set(0.35, 1, 1); fl.position.set(sx * 5.5, 0.2, -12.5); grp.add(fl);
    }
    // 가슴지느러미(패들형)
    for (const sx of [-1, 1]) {
      const pf = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6.5, 5), skin);
      pf.rotation.z = sx * 1.2; pf.scale.set(0.4, 1, 1); pf.position.set(sx * 5.8, -1.8, 3); grp.add(pf);
    }
    grp.scale.setScalar(1.7);
    grp.position.set(wx, -30, wz);
    this.group.add(grp);
    this._whale = grp;
    this._whaleBase = { x: wx, z: wz };
    // 물보라(브리칭 착수 스플래시)
    const spl = new THREE.Group();
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xd6f2ff, transparent: true, opacity: 0.9, toneMapped: false });
    spl.__drops = [];
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.8 + (i % 3) * 0.3, 6, 5), dropMat.clone());
      spl.add(d); spl.__drops.push({ m: d, a: (i / 12) * Math.PI * 2, r: 3 + (i % 4) });
    }
    spl.visible = false; this.group.add(spl); this._whaleSplash = spl;
  }

  _updateWhale(dt) {
    const w = this._whale; if (!w) return;
    const base = this._whaleBase, spl = this._whaleSplash;
    const period = 6.5;
    const cyc = ((this._t / period) % 1);
    // cyc 0.12~0.52 구간에 물 위로 아치를 그리며 브리칭
    if (cyc > 0.12 && cyc < 0.52) {
      const u = (cyc - 0.12) / 0.40;            // 0..1
      const arc = Math.sin(u * Math.PI);        // 0→1→0
      w.visible = true;
      w.position.set(base.x, -13 + arc * 26, base.z + (u - 0.3) * 22); // 수면 위로 솟구쳐 앞으로
      w.rotation.x = (0.5 - u) * 1.7;           // 머리 들고 올랐다가 머리부터 입수
      w.rotation.y = 0.5;
      // 착수 스플래시(입수 직전/직후)
      if (u > 0.86 && spl) {
        spl.visible = true; spl.position.set(base.x, -0.3, base.z + 4);
        const p = (u - 0.86) / 0.14;
        for (const d of spl.__drops) {
          const rr = d.r * (1 + p * 2);
          d.m.position.set(Math.cos(d.a) * rr, Math.max(0, 6 * (1 - p)), Math.sin(d.a) * rr);
          d.m.material.opacity = 0.9 * (1 - p);
        }
      } else if (spl) spl.visible = false;
    } else {
      w.visible = false; if (spl) spl.visible = false;
    }
  }

  // ---- 작은 얼음성(중앙 탑) + 나선 램프 받침: 도로가 탑 둘레를 '주차장식'으로 감아 오름 ----
  _buildMountain() {
    const M = ICE_MTN;
    const scale = 2.6;                       // 얼음 맵 scale (maps.js와 동일)
    const cx = M.Cx * scale, cz = M.Cz * scale;
    const topY = M.topY;
    // 중앙 탑 반경: 안쪽 하강로(Rt) 보다 작게 → 도로를 가리지 않음
    const keepR = Math.min(M.Rt * scale * 0.62, 22);
    const iceBlue = new THREE.MeshStandardMaterial({ color: 0xbcdcf8, roughness: 0.5, metalness: 0.06 });
    const iceDk = new THREE.MeshStandardMaterial({ color: 0x9cc6ee, roughness: 0.55, metalness: 0.06 });
    const snow = snowMat(0xeef7ff);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0xd6efff, roughness: 0.3, metalness: 0.12 });
    const grp = new THREE.Group();
    grp.position.set(cx, 0, cz);             // 나선 중심(좌상단)
    this._castleCenter = { x: cx, z: cz };

    // --- 나선 램프 받침: 공중에 뜬 상승/하강 도로 아래로 반투명 얼음 기둥 ---
    const t = this.track;
    const iceCol = new THREE.MeshPhysicalMaterial({ color: 0xbfe4ff, roughness: 0.2, metalness: 0.0,
      transmission: 0.35, transparent: true, opacity: 0.5, clearcoat: 0.8 });
    const N = t.samplePos.length;
    for (let i = 0; i < N; i += 7) {
      const p = t.samplePos[i];
      if (p.y < 2.5) continue;              // 평지 구간은 받침 불필요
      const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, p.y + 1, 6), iceCol);
      col.position.set(p.x, (p.y + 1) / 2 - 0.6, p.z);
      col.userData.noShadow = true;
      this.group.add(col);
    }
    // 얼음 기단(성 아래 낮고 넓은 빙판 언덕) — 도로(반경 Rt*scale≈36 이상)를 묻지 않게 낮게
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(keepR + 8, keepR + 20, 6, 32), iceDk);
    mound.position.y = 1.0; grp.add(mound);

    // --- 중앙 얼음성 탑(키프 + 성가퀴 + 첨탑 + 코너 터렛 + 별) ---
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(keepR * 0.86, keepR, topY + 12, 12), iceBlue);
    keep.position.y = (topY + 12) / 2 + 3; grp.add(keep);
    // 성가퀴(총안) 링
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), snow);
      b.position.set(Math.cos(ang) * keepR, topY + 16, Math.sin(ang) * keepR);
      b.rotation.y = -ang; grp.add(b);
    }
    // 상단 원뿔 지붕 + 첨탑
    const cap = new THREE.Mesh(new THREE.ConeGeometry(keepR + 2, 16, 12), spireMat);
    cap.position.y = topY + 24; grp.add(cap);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(keepR * 0.5, 34, 8), iceBlue);
    spire.position.y = topY + 48; grp.add(spire);
    // 코너 터렛 4개(중앙 탑 둘레, keepR 안쪽)
    for (let a = 0; a < 4; a++) {
      const ang = a / 4 * Math.PI * 2 + Math.PI / 4;
      const rr = keepR * 0.82;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, topY + 6, 8), spireMat);
      tw.position.set(Math.cos(ang) * rr, (topY + 6) / 2 + 3, Math.sin(ang) * rr); grp.add(tw);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(5.2, 12, 8), iceBlue);
      rf.position.set(Math.cos(ang) * rr, topY + 12, Math.sin(ang) * rr); grp.add(rf);
    }
    this._star = this._makeStar(0xfff2a0);
    this._star.scale.setScalar(5); this._star.position.set(0, topY + 70, 0); grp.add(this._star);

    this.group.add(grp);
    this._castle = grp;
  }

  _makeStar(color) {
    const shape = new THREE.Shape();
    const spikes = 5, outer = 1, inner = 0.45;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    geo.center();
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  }

  // ---- 크리스마스 출발문(멋지고 화려한 문) ----
  _buildStartGate() {
    const s = this.track.startInfo();
    const hw = this.track.halfWidth;
    const gate = new THREE.Group();
    const basis = new THREE.Matrix4().makeBasis(s.lat, s.up, s.tan.clone().negate());
    gate.quaternion.setFromRotationMatrix(basis);
    gate.position.copy(s.pos).addScaledVector(s.up, 0);

    const red = new THREE.MeshStandardMaterial({ color: 0xd42a2a, roughness: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const green = new THREE.MeshStandardMaterial({ color: 0x1e8f43, roughness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffcf4a, roughness: 0.3, metalness: 0.6, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    const lightMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

    // 좌우 사탕지팡이 기둥(빨강/하양 나선)
    for (const sx of [-1, 1]) {
      const px = sx * (hw + 3.5);
      const pole = new THREE.Group();
      for (let i = 0; i < 16; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.4, 12), i % 2 ? red : white);
        seg.position.y = 1 + i * 1.4; seg.rotation.y = i * 0.3; pole.add(seg);
      }
      pole.position.set(px, 0, 0);
      gate.add(pole);
      // 기둥 위 눈 얹힌 구
      const knob = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 12), white);
      knob.position.set(px, 24, 0); gate.add(knob);
    }
    // 상단 아치(초록 화환) — 반원 튜브
    const arch = new THREE.Mesh(new THREE.TorusGeometry(hw + 3.5, 2.0, 10, 28, Math.PI), green);
    arch.position.set(0, 23, 0); gate.add(arch);
    // 화환 장식 볼(빨강/금색 번갈아) + 반짝 전구
    const R = hw + 3.5;
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI;
      const x = Math.cos(a) * R, y = 23 + Math.sin(a) * R;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), i % 2 ? red : gold);
      ball.position.set(x, y, 1.4); gate.add(ball);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lightMat(i % 3 === 0 ? 0xff5a5a : i % 3 === 1 ? 0xfff2a0 : 0x8affc0));
      bulb.position.set(x, y, 2.2); gate.add(bulb); this._twinkle.push(bulb.material);
    }
    // 아치 꼭대기 리본/별
    const topStar = this._makeStar(0xfff2a0);
    topStar.scale.setScalar(4); topStar.position.set(0, R + 27, 1.5); gate.add(topStar);
    this._twinkle.push(topStar.material);
    // 가운데 대형 리스(화환 원)
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(4.5, 1.3, 10, 24), green);
    wreath.position.set(0, 30, 0.5); gate.add(wreath);
    const bow = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 1), red);
    bow.position.set(0, 25.5, 1.0); gate.add(bow);
    // 바닥 눈더미
    for (const sx of [-1, 1]) {
      const pile = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 10), white);
      pile.scale.set(1.6, 0.5, 1.2); pile.position.set(sx * (hw + 3.5), 0.5, 0); gate.add(pile);
    }
    this.group.add(gate);
  }

  // ---- 얼음동굴(트랙 일부 구간을 덮는 반투명 터널) ----
  _buildIceCave() {
    const t = this.track;
    if (t.caveRange === null) return;   // 이 맵은 동굴 없음
    const N = t.samplePos.length;
    const cave = t.caveRange || [0.16, 0.32];
    const mat = iceMat(0x9fd0f5, 0.6, 0.15);
    const stalMat = iceMat(0xcdeeff, 0.7, 0.12);
    for (let i = 0; i < N; i += 4) {
      const tt = i / N;
      if (tt < cave[0] || tt > cave[1]) continue;
      const p = t.samplePos[i], lat = t.sampleLat[i], up = t.sampleUp[i], tan = t.sampleTan[i];
      const hw = (t.sampleHalf ? t.sampleHalf[i] : t.halfWidth) + 5;
      // 아치형 터널(반원 튜브)
      const arch = new THREE.Mesh(new THREE.TorusGeometry(hw, 3.2, 8, 18, Math.PI), mat);
      _m.makeBasis(lat, up, tan);
      arch.quaternion.setFromRotationMatrix(_m);
      arch.position.copy(p).addScaledVector(up, 0);
      this.group.add(arch);
      // 천장 고드름
      if (i % 12 === 0) {
        for (const sx of [-0.4, 0.2]) {
          const st = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 6), stalMat);
          st.quaternion.setFromRotationMatrix(_m);
          st.position.copy(p).addScaledVector(up, hw - 2).addScaledVector(lat, sx * hw);
          st.rotateX(Math.PI);
          this.group.add(st);
        }
      }
    }
  }

  // ---- 눈 덮인 침엽수 ----
  _buildPines() {
    const t = this.track;
    const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.8 });
    const snow = snowMat(0xffffff);
    const N = t.samplePos.length;
    const se = t.seaEdges && t.seaEdges[0];         // 바다 구간/방향 — 바다쪽엔 나무 안 심음(물 위 X)
    for (let i = 0; i < N; i += 22) {
      const tt = i / N;
      const inSea = se && tt >= se[0] && tt <= se[1];
      for (const side of [-1, 1]) {
        if (((i * 7 + (side > 0 ? 3 : 0)) % 5) > 2) continue;
        if (inSea && side === se[2]) continue;      // 바다쪽 나무 스킵

        const p = t.samplePos[i], lat = t.sampleLat[i];
        const off = (t.sampleHalf ? t.sampleHalf[i] : t.halfWidth) + 12 + ((i * 13) % 40);
        const wx = p.x + lat.x * off * side, wz = p.z + lat.z * off * side;
        const tree = new THREE.Group();
        const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 4, 6), trunk);
        tk.position.y = 2; tree.add(tk);
        for (let k = 0; k < 3; k++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(4.5 - k * 1.1, 6, 8), leaf);
          c.position.y = 5 + k * 3.4; tree.add(c);
          const sc = new THREE.Mesh(new THREE.ConeGeometry(4.7 - k * 1.1, 1.6, 8), snow);
          sc.position.y = 6.6 + k * 3.4; tree.add(sc);
        }
        tree.position.set(wx, 0, wz);
        tree.scale.setScalar(0.8 + ((i * 3) % 10) * 0.06);
        this.group.add(tree);
      }
    }
  }

  // ---- 얼음 빙산/스파이크(원경) ----
  _buildBergs() {
    const t = this.track;
    const mat = iceMat(0xbfe4ff, 0.85, 0.2);
    for (let a = 0; a < 26; a++) {
      const ang = (a / 26) * Math.PI * 2;
      const R = t.radius + 180 + ((a * 37) % 220);
      const berg = new THREE.Mesh(new THREE.ConeGeometry(18 + (a % 5) * 8, 40 + (a % 6) * 26, 5), mat);
      berg.position.set(t.center.x + Math.cos(ang) * R, 12, t.center.z + Math.sin(ang) * R);
      berg.rotation.y = a;
      this.group.add(berg);
    }
  }

  _buildAuroraGlow() {
    // 은은한 오로라 띠(발광 평면) — 하늘 배경 보조
    const mat = new THREE.MeshBasicMaterial({ color: 0x6effc8, transparent: true, opacity: 0.12, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(1600, 120), mat.clone());
      band.position.set(this.track.center.x, 320 + i * 60, this.track.center.z - 300);
      band.rotation.x = -0.5;
      this._twinkle.push(band.material);
      this.group.add(band);
    }
  }

  update(dt, karts) {
    this._t += dt;
    this._updateHazards(dt, karts);
    this._updateWhale(dt);
    this._animateSea(dt);
    // 전구/별 반짝임
    const tw = 0.6 + 0.4 * Math.abs(Math.sin(this._t * 3));
    for (let i = 0; i < this._twinkle.length; i++) {
      const m = this._twinkle[i];
      if (m.opacity != null && m.opacity < 0.3) { m.opacity = 0.06 + 0.1 * Math.abs(Math.sin(this._t * 1.5 + i)); }
      else { m.color && m.color.offsetHSL(0, 0, 0); }
    }
    if (this._star) this._star.rotation.z += dt * 0.4;
  }
}
