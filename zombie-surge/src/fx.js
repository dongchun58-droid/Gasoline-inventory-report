// fx.js — 예광탄(LineSegments), 체액/재 파티클(Points), 머즐 플래시, 경고 마커
import * as THREE from 'three';

export class FX {
  constructor() {
    this.group = new THREE.Group();
    // 예광탄
    this.MAXT = 240; this.tracers = [];
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAXT * 6), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.MAXT * 6), 3));
    this.tLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, toneMapped: false }));
    this.tLines.frustumCulled = false; this.group.add(this.tLines);
    // 파티클(체액=짙은 녹갈 / 재=회백)
    this.MAXP = 1200; this.parts = [];
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAXP * 3), 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.MAXP * 3), 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true }));
    this.points.frustumCulled = false; this.group.add(this.points);
    // 머즐 플래시(가산 스프라이트 풀)
    this.flashes = [];
    const fm = new THREE.SpriteMaterial({ color: 0xffd080, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(fm); s.scale.setScalar(0.5); s.visible = false; this.group.add(s); this.flashes.push({ s, life: 0 }); }
    // 보스 광역 예고 마커
    this.marker = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.4, 28), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; this.group.add(this.marker);
    this._c = new THREE.Color();
  }
  tracer(from, to, color) {
    if (this.tracers.length >= this.MAXT) this.tracers.shift();
    this.tracers.push({ a: from.clone(), b: to.clone(), c: color, life: 0.07 });
  }
  flash(pos) {
    const f = this.flashes.find((x) => x.life <= 0); if (!f) return;
    f.s.position.copy(pos); f.s.visible = true; f.life = 0.05; f.s.scale.setScalar(0.35 + Math.random() * 0.35);
  }
  ichor(pos, n = 10) {       // 피격 체액(짙은 녹갈색)
    for (let i = 0; i < n; i++) this._spawn(pos, 0x3a4a22, 2.2, 0.45);
  }
  ash(pos, n = 18) {         // 사망 재(회백, 천천히 상승)
    for (let i = 0; i < n; i++) this._spawn(pos, 0x9a968c, 0.9, 0.9, 1.4);
  }
  spark(pos, n = 6) { for (let i = 0; i < n; i++) this._spawn(pos, 0xffc060, 3, 0.25); }
  _spawn(pos, color, spd, life, up = 0) {
    if (this.parts.length >= this.MAXP) this.parts.shift();
    const a = Math.random() * 6.283, e = Math.random() * 1.2 + 0.2, s = spd * (0.5 + Math.random());
    this.parts.push({ x: pos.x, y: pos.y + 0.6 + Math.random() * 0.6, z: pos.z, vx: Math.cos(a) * s * Math.cos(e), vy: Math.sin(e) * s + up, vz: Math.sin(a) * s * Math.cos(e), life, max: life, c: color, g: up ? -1.5 : 9 });
  }
  showMarker(x, z) { this.marker.visible = true; this.marker.position.set(x, 0.06, z); this._mt = 0; }
  hideMarker() { this.marker.visible = false; }
  update(dt) {
    // 예광탄
    const tp = this.tLines.geometry.attributes.position, tc = this.tLines.geometry.attributes.color; let n = 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.life -= dt; if (t.life <= 0) { this.tracers.splice(i, 1); continue; }
      this._c.setHex(t.c);
      tp.setXYZ(n * 2, t.a.x, t.a.y, t.a.z); tp.setXYZ(n * 2 + 1, t.b.x, t.b.y, t.b.z);
      tc.setXYZ(n * 2, this._c.r, this._c.g, this._c.b); tc.setXYZ(n * 2 + 1, this._c.r * 0.3, this._c.g * 0.3, this._c.b * 0.3); n++; }
    this.tLines.geometry.setDrawRange(0, n * 2); tp.needsUpdate = true; tc.needsUpdate = true;
    // 파티클
    const pp = this.points.geometry.attributes.position, pc = this.points.geometry.attributes.color; let m = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.02) { p.y = 0.02; p.vx *= 0.6; p.vz *= 0.6; p.vy = 0; }
      this._c.setHex(p.c); const f = p.life / p.max;
      pp.setXYZ(m, p.x, p.y, p.z); pc.setXYZ(m, this._c.r * f, this._c.g * f, this._c.b * f); m++; }
    this.points.geometry.setDrawRange(0, m); pp.needsUpdate = true; pc.needsUpdate = true;
    for (const f of this.flashes) { if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; } }
    if (this.marker.visible) { this._mt += dt; this.marker.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(this._mt * 10)); this.marker.scale.setScalar(1 + Math.sin(this._mt * 6) * 0.08); }
  }
}
