// ice.js — 얼음 왕국 맵 배경 (거대 얼음성·크리스마스 출발문·얼음동굴·바다·눈밭, 오리지널)
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _p2 = new THREE.Vector3();

export const SEA_Y = -3.2;         // 바다 수면 높이(도로보다 낮음)
// 얼음 산(원뿔) 파라미터 — maps.js iceHelix와 공유. scale은 트랙에서 x,z에만 적용됨.
export const ICE_MTN = { Rb: 130, Rt: 66, topY: 92, ptsPerTurn: 12, upTurns: 3, downTurns: 1 };

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

export class IceScenery {
  constructor(track, gradientMap) {
    this.track = track;
    this.group = new THREE.Group();
    this._t = 0;
    this._twinkle = [];

    this._buildGround();
    this._buildSea();
    this._buildMountain();
    this._buildStartGate();
    this._buildIceCave();
    this._buildPines();
    this._buildBergs();
    this._buildAuroraGlow();
    this._buildSlippery();
    this._buildFallingSnow();
  }

  // ---- 미끄러운 빙판(도로 위 광택 얼음 패치) ----
  _buildSlippery() {
    const t = this.track;
    const N = t.samplePos.length;
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xd6f2ff, roughness: 0.05, metalness: 0.0,
      transmission: 0.3, transparent: true, opacity: 0.55, clearcoat: 1.0, depthWrite: false });
    this._icePatches = [];
    const spots = [0.05, 0.235, 0.80, 0.90, 0.965, 0.42];
    for (const tt of spots) {
      const i = Math.floor(tt * N) % N;
      const p = t.samplePos[i], lat = t.sampleLat[i], up = t.sampleUp[i], tan = t.sampleTan[i];
      const off = (((i * 17) % 100) / 100 - 0.5) * (t.halfWidth * 0.9);
      const r = 5 + ((i * 7) % 4);
      const patch = new THREE.Mesh(new THREE.CircleGeometry(r, 22), mat);
      _m.makeBasis(lat, up, tan);
      patch.quaternion.setFromRotationMatrix(_m);
      patch.rotateX(-Math.PI / 2);
      patch.position.copy(p).addScaledVector(lat, off).addScaledVector(up, 0.06);
      this.group.add(patch);
      this._icePatches.push({ pos: patch.position.clone(), r2: (r + 1.5) * (r + 1.5) });
    }
  }

  // ---- 하늘에서 떨어지는 눈덩이 (2곳) ----
  _buildFallingSnow() {
    const t = this.track;
    const N = t.samplePos.length;
    const snow = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.85 });
    this._snowballs = [];
    const spots = [0.47, 0.86];
    for (let s = 0; s < spots.length; s++) {
      const i = Math.floor(spots[s] * N) % N;
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), snow);
      this.group.add(ball);
      // 경고 링(착지 지점)
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 20),
        new THREE.MeshBasicMaterial({ color: 0x2f8fd6, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
      this.group.add(ring);
      this._snowballs.push({ i0: i, ball, ring, phase: s * 1.4, P: 3.2 });
    }
  }

  _updateHazards(dt, karts) {
    const t = this.track;
    // 미끄러운 빙판
    if (this._icePatches && karts) {
      for (const k of karts) {
        for (const ip of this._icePatches) {
          const dx = k.pos.x - ip.pos.x, dz = k.pos.z - ip.pos.z;
          if (dx * dx + dz * dz < ip.r2) { k.setIce(0.25); break; }
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

  // ---- 눈밭 지면 ----
  _buildGround() {
    const t = this.track;
    const size = 2 * (t.radius + 520);
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const g = new THREE.Mesh(geo, snowMat(0xeaf4ff));
    g.position.set(t.center.x, -0.35, t.center.z);
    g.receiveShadow = true;
    g.userData.noShadow = false;
    this.group.add(g);
  }

  // ---- 바다(한쪽) : 큰 물 평면. 도로 밖으로 나가면 이 아래로 추락 ----
  _buildSea() {
    const t = this.track;
    const size = 2 * (t.radius + 520);
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x1f6ea8, roughness: 0.12, metalness: 0.0, transmission: 0.2,
      transparent: true, opacity: 0.9, clearcoat: 1.0,
    });
    const sea = new THREE.Mesh(geo, mat);
    // 바다는 지면보다 낮게, 트랙 중심에서 바깥쪽으로 크게 깔되 살짝 오프셋
    sea.position.set(t.center.x, SEA_Y, t.center.z);
    sea.userData.noShadow = true;
    this._sea = sea; this._seaMat = mat;
    this.group.add(sea);
  }

  // ---- 도로 아래 얼음 노반(두꺼운 슬래브) + 오르막 지지 기둥 ----
  // ---- 얼음 산(원뿔): 나선 도로가 표면에 새겨진 솔리드 산 (안쪽=벽, 바깥=낭떠러지) ----
  _buildMountain() {
    const t = this.track;
    const M = ICE_MTN;
    // 트랙 scale 역산 (제어점 반경 Rb가 월드 samplePos[0].x = Rb*scale)
    const scale = Math.abs(t.samplePos[0].x) / M.Rb || 2.6;
    const botR = M.Rb * scale, topR = M.Rt * scale, topY = M.topY;
    const iceBlue = new THREE.MeshStandardMaterial({ color: 0xbcdcf8, roughness: 0.5, metalness: 0.06 });
    const iceDk = new THREE.MeshStandardMaterial({ color: 0x9cc6ee, roughness: 0.55, metalness: 0.06 });
    const snow = snowMat(0xeef7ff);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0xd6efff, roughness: 0.3, metalness: 0.12 });
    const grp = new THREE.Group();
    grp.position.set(0, 0, 0);              // 나선 축 = 원점
    this._castleCenter = { x: 0, z: 0 };

    // 산 본체(원뿔) — 도로면보다 살짝 낮춰 z-fighting 방지, 도로는 표면에 얹힘
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, topY, 56, 1), iceBlue);
    cone.position.y = topY / 2 - 1.5; grp.add(cone);
    // 안쪽 벽 느낌의 겹 원뿔(살짝 안쪽·진한 얼음)
    const cone2 = new THREE.Mesh(new THREE.CylinderGeometry(topR - 14, botR - 14, topY + 2, 40, 1), iceDk);
    cone2.position.y = topY / 2; grp.add(cone2);
    // 눈 덮인 능선 링(각 등반 턴 높이) — 산 결
    for (let k = 1; k <= M.upTurns; k++) {
      const fy = k / (M.upTurns + 0.4);
      const rr = (M.Rb - (M.Rb - M.Rt) * fy) * scale;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr - 2, 2.4, 6, 40), snow);
      ring.rotation.x = Math.PI / 2; ring.position.y = fy * topY - 2; grp.add(ring);
    }
    // 정상 눈모자 + 얼음성 첨탑 + 별
    const cap = new THREE.Mesh(new THREE.ConeGeometry(topR + 3, 22, 28), snow);
    cap.position.y = topY + 8; grp.add(cap);
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(topR * 0.62, topR * 0.72, 34, 6), spireMat);
    keep.position.y = topY + 24; grp.add(keep);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(topR * 0.62, 60, 6), iceBlue);
    spire.position.y = topY + 68; grp.add(spire);
    for (let a = 0; a < 6; a++) {
      const ang = a / 6 * Math.PI * 2;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 44, 6), spireMat);
      tw.position.set(Math.cos(ang) * topR * 0.7, topY + 20, Math.sin(ang) * topR * 0.7); grp.add(tw);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(9, 20, 6), iceBlue);
      rf.position.set(Math.cos(ang) * topR * 0.7, topY + 50, Math.sin(ang) * topR * 0.7); grp.add(rf);
    }
    this._star = this._makeStar(0xfff2a0);
    this._star.scale.setScalar(7); this._star.position.set(0, topY + 108, 0); grp.add(this._star);

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
    for (let i = 0; i < N; i += 22) {
      for (const side of [-1, 1]) {
        if (((i * 7 + (side > 0 ? 3 : 0)) % 5) > 2) continue;
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
    // 전구/별 반짝임
    const tw = 0.6 + 0.4 * Math.abs(Math.sin(this._t * 3));
    for (let i = 0; i < this._twinkle.length; i++) {
      const m = this._twinkle[i];
      if (m.opacity != null && m.opacity < 0.3) { m.opacity = 0.06 + 0.1 * Math.abs(Math.sin(this._t * 1.5 + i)); }
      else { m.color && m.color.offsetHSL(0, 0, 0); }
    }
    if (this._star) this._star.rotation.z += dt * 0.4;
    if (this._seaMat) this._seaMat.opacity = 0.86 + 0.06 * Math.sin(this._t * 1.2);
  }
}
