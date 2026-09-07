// fx.js — 강렬한 화기 이펙트: 굵은 예광탄(Quad 리본) · 큰 머즐 플래시 · 레이저 빔 · 체액/재 · 충격 링
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _side = new THREE.Vector3();

export class FX {
  constructor() {
    this.group = new THREE.Group();
    // ── 예광탄: 카메라를 향한 리본(쿼드) — 선(LineBasic)보다 훨씬 굵고 밝게 보임
    this.MAXT = 900; this.tracers = [];
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAXT * 12), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.MAXT * 12), 3));
    const idx = new Uint32Array(this.MAXT * 6);
    for (let i = 0; i < this.MAXT; i++) { const v = i * 4, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    tg.setIndex(new THREE.BufferAttribute(idx, 1));
    this.tMesh = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.tMesh.frustumCulled = false; this.group.add(this.tMesh);
    // ── 머즐 플래시(가산 스프라이트 풀, 크게)
    this.flashes = [];
    const ft = flashTex();
    for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: 0xffd070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      s.visible = false; this.group.add(s); this.flashes.push({ s, life: 0, max: 1 }); }
    // ── 레이저 연속 빔
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.beam.visible = false; this.group.add(this.beam);
    // ── 파티클(체액=짙은 녹갈 / 재=회백 / 스파크=주황)
    this.MAXP = 2200; this.parts = [];
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAXP * 3), 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.MAXP * 3), 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.17, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, map: dotTex(), alphaTest: 0.02 }));
    this.points.frustumCulled = false; this.group.add(this.points);
    // ── 보스 광역 예고 링
    this.marker = new THREE.Mesh(new THREE.RingGeometry(1.6, 3.0, 32), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; this.group.add(this.marker);
    this._c = new THREE.Color(); this._mt = 0;
  }
  // 레이저·빔용: 경로 전체가 한 줄로 보인다
  tracer(from, to, color, w = 0.06) {
    if (this.tracers.length >= this.MAXT) this.tracers.shift();
    this.tracers.push({ a: from.clone(), b: to.clone(), c: color, w, life: 0.075, max: 0.075, dash: 0 });
  }
  // 실탄용: 경로를 따라 날아가는 짧은 탄환 대시(화면이 선으로 뒤덮이지 않는다)
  bullet(from, to, color, w = 0.05, speed = 150) {
    if (this.tracers.length >= this.MAXT) this.tracers.shift();
    const len = from.distanceTo(to) || 1;
    const life = Math.min(0.34, Math.max(0.06, len / speed));
    const dash = Math.min(0.5, Math.max(0.06, 3.4 / len));   // 대시 길이(경로 대비 비율)
    this.tracers.push({ a: from.clone(), b: to.clone(), c: color, w, life, max: life, dash });
  }
  flash(pos, size = 0.8, color = 0xffd070) {
    const f = this.flashes.find((x) => x.life <= 0); if (!f) return;
    f.s.position.copy(pos); f.s.visible = true; f.life = f.max = 0.07;
    f.s.material.color.setHex(color); f.s.scale.setScalar(size * (0.8 + Math.random() * 0.5));
    f.s.material.rotation = Math.random() * 6.28;
  }
  showBeam(from, to, camera) {
    this.beam.visible = true;
    _d.subVectors(to, from); const len = _d.length();
    this.beam.position.copy(from).addScaledVector(_d, 0.5);
    this.beam.scale.set(0.55, len, 1);
    this.beam.quaternion.setFromUnitVectors(_up, _d.normalize());
    if (camera) { const q = new THREE.Quaternion(); q.setFromAxisAngle(_d, Math.atan2(1, 0)); }
    this.beam.material.opacity = 0.6 + Math.random() * 0.35;
  }
  hideBeam() { this.beam.visible = false; }
  ichor(pos, n = 12) { for (let i = 0; i < n; i++) this._spawn(pos, 0x3f5227, 2.6, 0.42, 0); }
  ash(pos, n = 20) { for (let i = 0; i < n; i++) this._spawn(pos, 0xa9a49a, 1.0, 0.95, 1.5); }
  spark(pos, n = 8, c = 0xffc060) { for (let i = 0; i < n; i++) this._spawn(pos, c, 4.0, 0.28, 0); }
  _spawn(pos, color, spd, life, up) {
    if (this.parts.length >= this.MAXP) this.parts.shift();
    const a = Math.random() * 6.283, e = Math.random() * 1.2 + 0.15, s = spd * (0.5 + Math.random());
    this.parts.push({ x: pos.x, y: pos.y + 0.5 + Math.random() * 0.6, z: pos.z,
      vx: Math.cos(a) * s * Math.cos(e), vy: Math.sin(e) * s + up, vz: Math.sin(a) * s * Math.cos(e),
      life, max: life, c: color, g: up ? -1.4 : 9.5 });
  }
  showMarker(x, z) { this.marker.visible = true; this.marker.position.set(x, 0.07, z); this._mt = 0; }
  hideMarker() { this.marker.visible = false; }
  update(dt, camera) {
    // 예광탄 리본 갱신(카메라를 향하도록 폭 방향 계산)
    const pos = this.tMesh.geometry.attributes.position, col = this.tMesh.geometry.attributes.color;
    let n = 0; const cam = camera ? camera.position : _a.set(0, 10, 20);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.life -= dt; if (t.life <= 0) { this.tracers.splice(i, 1); continue; }
      const f = t.life / t.max;
      let sx, sy, sz, ex, ey, ez;
      if (t.dash) {                                   // 경로를 따라 이동하는 짧은 탄환
        const u = 1 - f, u0 = Math.max(0, u - t.dash), u1 = Math.min(1, u);
        sx = t.a.x + (t.b.x - t.a.x) * u0; sy = t.a.y + (t.b.y - t.a.y) * u0; sz = t.a.z + (t.b.z - t.a.z) * u0;
        ex = t.a.x + (t.b.x - t.a.x) * u1; ey = t.a.y + (t.b.y - t.a.y) * u1; ez = t.a.z + (t.b.z - t.a.z) * u1;
      } else { sx = t.a.x; sy = t.a.y; sz = t.a.z; ex = t.b.x; ey = t.b.y; ez = t.b.z; }
      _d.set(ex - sx, ey - sy, ez - sz);
      _b.set((sx + ex) * 0.5, (sy + ey) * 0.5, (sz + ez) * 0.5);
      _side.subVectors(cam, _b).cross(_d).normalize().multiplyScalar(t.w);
      if (!isFinite(_side.x)) _side.set(t.w, 0, 0);
      const v = n * 4;
      pos.setXYZ(v,     sx + _side.x, sy + _side.y, sz + _side.z);
      pos.setXYZ(v + 1, sx - _side.x, sy - _side.y, sz - _side.z);
      pos.setXYZ(v + 2, ex - _side.x, ey - _side.y, ez - _side.z);
      pos.setXYZ(v + 3, ex + _side.x, ey + _side.y, ez + _side.z);
      this._c.setHex(t.c);
      const hd = t.dash ? Math.min(1, 0.55 + f * 0.7) : f, tl = t.dash ? hd * 0.45 : f * 0.15;
      col.setXYZ(v, this._c.r * tl, this._c.g * tl, this._c.b * tl);
      col.setXYZ(v + 1, this._c.r * tl, this._c.g * tl, this._c.b * tl);
      col.setXYZ(v + 2, this._c.r * hd, this._c.g * hd, this._c.b * hd);
      col.setXYZ(v + 3, this._c.r * hd, this._c.g * hd, this._c.b * hd);
      n++;
    }
    this.tMesh.geometry.setDrawRange(0, n * 6); pos.needsUpdate = true; col.needsUpdate = true;
    // 파티클
    const pp = this.points.geometry.attributes.position, pc = this.points.geometry.attributes.color; let m = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vx *= 0.55; p.vz *= 0.55; p.vy = 0; }
      this._c.setHex(p.c); const f = Math.min(1, p.life / p.max * 1.5);
      pp.setXYZ(m, p.x, p.y, p.z); pc.setXYZ(m, this._c.r * f, this._c.g * f, this._c.b * f); m++;
    }
    this.points.geometry.setDrawRange(0, m); pp.needsUpdate = true; pc.needsUpdate = true;
    for (const f of this.flashes) if (f.life > 0) { f.life -= dt; f.s.material.opacity = Math.max(0, f.life / f.max); if (f.life <= 0) f.s.visible = false; }
    if (this.marker.visible) { this._mt += dt; this.marker.material.opacity = 0.3 + 0.4 * Math.abs(Math.sin(this._mt * 11)); this.marker.scale.setScalar(1 + Math.sin(this._mt * 7) * 0.09); }
  }
}
function flashTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,255,240,1)'); grd.addColorStop(0.22, 'rgba(255,220,130,0.9)');
  grd.addColorStop(0.5, 'rgba(255,150,40,0.35)'); grd.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  // 방사형 스파이크(총구 화염 느낌)
  g.strokeStyle = 'rgba(255,240,190,0.85)'; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(64, 64);
    g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dotTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}
