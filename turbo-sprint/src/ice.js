// ice.js — 얼음 왕국 맵 배경 (거대 얼음성·크리스마스 출발문·얼음동굴·바다·눈밭, 오리지널)
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);

export const SEA_Y = -3.2;         // 바다 수면 높이(도로보다 낮음)

// 반투명 얼음 재질
function iceMat(color = 0xbfe4ff, opacity = 0.72, rough = 0.15) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0.0, transmission: 0.35,
    transparent: true, opacity, clearcoat: 0.8, clearcoatRoughness: 0.2,
    ior: 1.31, thickness: 2.0,
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
    this._buildRoadBed();
    this._buildCastle();
    this._buildStartGate();
    this._buildIceCave();
    this._buildPines();
    this._buildBergs();
    this._buildAuroraGlow();
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
  _buildRoadBed() {
    const t = this.track;
    const N = t.samplePos.length;
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x9fc8ee, roughness: 0.5, metalness: 0.0,
      transparent: true, opacity: 0.92 });
    const pillarMat = iceMat(0xbfe4ff, 0.85, 0.2);
    const step = 8;
    for (let i = 0; i < N - step; i += step) {
      const p = t.samplePos[i], lat = t.sampleLat[i], up = t.sampleUp[i], tan = t.sampleTan[i];
      const hw = (t.sampleHalf ? t.sampleHalf[i] : t.halfWidth);
      const nxt = t.samplePos[Math.min(N - 1, i + step)];
      const segLen = p.distanceTo(nxt) + 1.5;
      // 두꺼운 얼음 슬래브(도로 바로 아래)
      const slab = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 2, 3.2, segLen), bedMat);
      _m.makeBasis(lat, up, tan);
      slab.quaternion.setFromRotationMatrix(_m);
      slab.position.copy(p).addScaledVector(up, -1.7);
      this.group.add(slab);
      // 오르막(공중 구간): 지면까지 지지 기둥
      if (p.y > 5) {
        const h = p.y + 1;
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.7, hw * 0.95, h, 6), pillarMat);
        pil.position.set(p.x, (p.y - 0.35) / 2 - 0.35, p.z);
        this.group.add(pil);
      }
    }
  }

  // ---- 거대 얼음성(중앙) ----
  _buildCastle() {
    const t = this.track;
    const cx = t.center.x, cz = t.center.z;
    const castle = new THREE.Group();
    castle.position.set(cx, 0, cz);
    const wall = iceMat(0xa9d8ff, 0.8, 0.18);
    const wallDk = iceMat(0x8fc4f0, 0.85, 0.2);
    const spireMat = iceMat(0xd6f0ff, 0.7, 0.12);
    const trim = snowMat(0xffffff);

    // 기단(넓은 계단식 얼음 언덕)
    for (let i = 0; i < 4; i++) {
      const r = 210 - i * 34;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 18, 18, 8), i % 2 ? wallDk : wall);
      base.position.y = 9 + i * 16; castle.add(base);
      // 계단 눈 트림
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r + 1, r + 1, 2.5, 8), trim);
      cap.position.y = 18 + i * 16; castle.add(cap);
    }
    // 중앙 성채(큰 육각 타워)
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(74, 86, 96, 6), wall);
    keep.position.y = 96; castle.add(keep);
    const keepBand = new THREE.Mesh(new THREE.CylinderGeometry(75, 75, 4, 6), trim);
    keepBand.position.y = 132; castle.add(keepBand);
    // 성채 지붕(뾰족)
    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(80, 70, 6), spireMat);
    keepRoof.position.y = 175; castle.add(keepRoof);
    // 꼭대기 별
    this._star = this._makeStar(0xfff2a0);
    this._star.position.set(0, 218, 0); this._star.scale.setScalar(6);
    castle.add(this._star);

    // 둘레 타워 6개 (육각 배치)
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      const R = 150;
      const tx = Math.cos(ang) * R, tz = Math.sin(ang) * R;
      const h = 70 + (a % 2) * 26;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(20, 26, h, 8), a % 2 ? wall : wallDk);
      tw.position.set(tx, h / 2, tz); castle.add(tw);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 3, 8), trim);
      band.position.set(tx, h, tz); castle.add(band);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(26, 40, 8), spireMat);
      roof.position.set(tx, h + 20, tz); castle.add(roof);
      // 고드름 스파이크
      const tip = new THREE.Mesh(new THREE.ConeGeometry(3, 16, 6), spireMat);
      tip.position.set(tx, h + 48, tz); castle.add(tip);
    }
    // 성벽 사이 커튼월(육각)
    for (let a = 0; a < 6; a++) {
      const ang0 = (a / 6) * Math.PI * 2, ang1 = ((a + 1) / 6) * Math.PI * 2;
      const R = 150;
      const x0 = Math.cos(ang0) * R, z0 = Math.sin(ang0) * R;
      const x1 = Math.cos(ang1) * R, z1 = Math.sin(ang1) * R;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const wallSeg = new THREE.Mesh(new THREE.BoxGeometry(len, 46, 12), wall);
      wallSeg.position.set(mx, 40, mz);
      wallSeg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      castle.add(wallSeg);
    }
    this.group.add(castle);
    this._castle = castle;
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

  update(dt) {
    this._t += dt;
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
