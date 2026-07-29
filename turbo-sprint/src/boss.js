// boss.js — 얼음 왕국 보스전: 후반에 아레나(사방이 얼음벽)가 닫히고 미사일로 보스를 공격.
// 보스는 눈덩이로 반격(맞으면 20초 정지). 보스 HP 700, 미사일 1발 = 5 데미지. AI들도 함께 싸움.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function iceMat(color = 0xbcdcf8, rough = 0.35) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.08 });
}

export class BossBattle {
  constructor(scene, gradientMap) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.maxHp = 700;
    this.hp = 700;
    this.active = false;
    this.dying = false;
    this.done = false;
    this.arena = { x: 0, z: 0, r: 78 };
    this._t = 0;
    this._throwTimer = 2.2;
    this._deathT = 0;

    this._missiles = [];
    this._snowballs = [];
    this._aiFireCd = [];
    this._playerCd = 0;

    this._buildBoss();
    this._buildWalls();
    this._buildHpBar();
    this._buildHud();
  }

  // ---- 보스 모델: 거대한 얼음 골렘(빙괴 몸통 + 머리 + 팔 + 결정 뿔) ----
  _buildBoss() {
    const g = new THREE.Group();
    const blue = iceMat(0x9fc6ee, 0.45);
    const lite = iceMat(0xdff0ff, 0.3);
    const dark = iceMat(0x6f9fd0, 0.5);
    const crystal = new THREE.MeshStandardMaterial({ color: 0xbfe9ff, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.9, emissive: 0x2a6aa0, emissiveIntensity: 0.3 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x39d6ff, toneMapped: false });
    // 몸통(큰 빙괴)
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 1), blue);
    body.scale.set(1.05, 1.2, 1.0); body.position.y = 9; g.add(body);
    const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 1), lite);
    belly.scale.set(1, 1.05, 0.7); belly.position.set(0, 7.5, 3.6); g.add(belly);
    // 머리
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 1), blue);
    head.position.y = 18; g.add(head);
    const face = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0, 1), lite);
    face.scale.set(1, 0.9, 0.6); face.position.set(0, 17.6, 2.8); g.add(face);
    // 눈(빛나는 시안)
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), eyeMat);
      eye.position.set(sx * 1.5, 18.4, 4.0); g.add(eye);
    }
    // 입(어두운 틈)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.6), dark);
    mouth.position.set(0, 16.4, 4.2); g.add(mouth);
    // 어깨/등 결정 뿔
    const spikePts = [[-6, 13, -2], [6, 13, -2], [-4, 16, -4], [4, 16, -4], [0, 20.5, -2]];
    for (const [x, y, z] of spikePts) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 6), crystal);
      sp.position.set(x, y, z); sp.rotation.z = x * 0.06; sp.rotation.x = -0.2; g.add(sp);
    }
    // 팔(어깨 + 큰 주먹) — 참조 저장(휘두르는 연출용)
    this._arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(1.8, 4, 6, 10), blue);
      upper.position.set(0, -2.5, 0); arm.add(upper);
      const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0, 0), blue);
      fist.position.set(0, -6, 0); arm.add(fist);
      for (let s = 0; s < 3; s++) {
        const kn = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 5), crystal);
        kn.position.set((s - 1) * 1.6, -7.6, 1.4); arm.add(kn);
      }
      arm.position.set(sx * 7.5, 12, 0); arm.rotation.z = sx * 0.25;
      g.add(arm); this._arms.push({ arm, sx });
    }
    // 발/기단
    const base = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 8.5, 3, 10), dark);
    base.position.y = 1.5; g.add(base);
    g.traverse((o) => { if (o.isMesh) o.userData.noShadow = false; });
    // 위압감: 내부를 키우고, 외부 래퍼(this.boss)는 스케일 1 유지(피격 펄스/사망 연출용)
    g.scale.setScalar(1.4);
    const outer = new THREE.Group(); outer.add(g);
    this.boss = outer;
    this.group.add(outer);
  }

  _buildWalls() {
    this._wallGroup = new THREE.Group();
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfe4ff, roughness: 0.18, metalness: 0.0, transmission: 0.25,
      transparent: true, opacity: 0.72, clearcoat: 0.8, ior: 1.31,
    });
    this._wallCols = [];
    const R = this.arena.r + 4;
    const count = 40;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const h = 16 + (i % 3) * 4;
      const col = new THREE.Mesh(new THREE.BoxGeometry(13, h, 6), wallMat);
      col.position.set(Math.cos(a) * R, h / 2, Math.sin(a) * R);
      col.rotation.y = -a;
      col.userData = { baseY: h / 2, h };
      this._wallGroup.add(col); this._wallCols.push(col);
      // 뾰족 얼음탑(위)
      const spk = new THREE.Mesh(new THREE.ConeGeometry(6.5, 10, 5), wallMat);
      spk.position.set(Math.cos(a) * R, h + 5, Math.sin(a) * R); spk.rotation.y = -a;
      spk.userData = { baseY: h + 5, h };
      this._wallGroup.add(spk); this._wallCols.push(spk);
    }
    this.group.add(this._wallGroup);
  }

  _buildHpBar() {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.4), new THREE.MeshBasicMaterial({ color: 0x101820, toneMapped: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(25, 1.8), new THREE.MeshBasicMaterial({ color: 0x39e06a, toneMapped: false }));
    fill.position.z = 0.05;
    g.add(bg, fill);
    g.position.y = 36;
    this._hpBar = g; this._hpFill = fill;
    this.boss.add(g);
  }

  _buildHud() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);width:min(560px,80vw);z-index:40;font-family:system-ui,sans-serif;text-align:center;display:none;pointer-events:none;';
    el.innerHTML = `
      <div style="color:#eaf7ff;font-weight:800;letter-spacing:2px;font-size:18px;text-shadow:0 2px 6px #05203a;margin-bottom:4px;">❄ ICE GOLEM ❄ <span style="font-weight:600;opacity:.85">— 미사일로 처치! (아이템 버튼)</span></div>
      <div style="height:20px;background:#0b1420cc;border:2px solid #7fb8e6;border-radius:11px;overflow:hidden;box-shadow:0 3px 12px #04121faa;">
        <div id="bossHpFill" style="height:100%;width:100%;background:linear-gradient(90deg,#39e06a,#8fffb0);transition:width .12s;"></div>
      </div>
      <div id="bossHpTxt" style="color:#dff0ff;font-weight:700;font-size:13px;margin-top:2px;text-shadow:0 1px 3px #05203a;">700 / 700</div>`;
    document.body.appendChild(el);
    this._hudEl = el;
    this._hudFill = el.querySelector('#bossHpFill');
    this._hudTxt = el.querySelector('#bossHpTxt');
  }

  // 아레나 중심(평지 개활지) 계산 — 트랙 평지 샘플 무게중심
  computeArena(track) {
    const N = track.samplePos.length;
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const p = track.samplePos[i];
      if (p.y < 1) { sx += p.x; sz += p.z; n++; }
    }
    this.arena = { x: sx / Math.max(1, n), z: sz / Math.max(1, n), r: 78 };
    return this.arena;
  }

  // 보스전 시작: 아레나 배치 + 카트들을 원 안에 흩어 배치 + 벽 상승
  start(track, karts) {
    this.computeArena(track);
    this._track = track;
    const A = this.arena;
    this.group.position.set(A.x, 0, A.z);
    this.boss.position.set(0, 0, 0);
    this.hp = this.maxHp; this.active = true; this.dying = false; this.done = false;
    this._t = 0; this._throwTimer = 4.5; this._deathT = 0;
    this._missiles.forEach((m) => this.group.remove(m.mesh)); this._missiles.length = 0;
    this._snowballs.forEach((s) => this.group.remove(s.mesh)); this._snowballs.length = 0;
    this._aiFireCd = karts.map((_, i) => 1 + i * 0.4);
    // 벽: 바닥 아래에서 솟아오름
    for (const c of this._wallCols) c.position.y = -c.userData.h;
    this._wallRise = 0;
    // 카트 배치: 보스 주위 원형으로 흩어 세움(보스를 바라보게)
    const ring = A.r - 22;
    karts.forEach((k, i) => {
      const a = (i / karts.length) * Math.PI * 2 + 0.3;
      k.pos.set(A.x + Math.cos(a) * ring, 0, A.z + Math.sin(a) * ring);
      k.speed = 6; k.boostTimer = 0; k.stunTimer = 0; k.spinTimer = 0; k.iceTimer = 0;
      k.lavaTimer = 0; k.leapTimer = 0; k.airborne = false; k.drifting = false;
      // 접선 방향으로 세워 곧바로 선회 시작(보스를 도는 자세)
      const dir = (i % 2) ? 1 : -1;
      k.forward.set(dir * -Math.sin(a), 0, dir * Math.cos(a)).normalize();
      k._syncMesh();
    });
    this.group.visible = true;
    this._hudEl.style.display = 'block';
    this._updateHud();
  }

  _updateHud() {
    const f = Math.max(0, this.hp) / this.maxHp;
    this._hudFill.style.width = (f * 100) + '%';
    this._hudFill.style.background = f > 0.5 ? 'linear-gradient(90deg,#39e06a,#8fffb0)'
      : f > 0.22 ? 'linear-gradient(90deg,#f5c542,#ffe08a)' : 'linear-gradient(90deg,#e0503a,#ff9a7a)';
    this._hudTxt.textContent = Math.max(0, Math.ceil(this.hp)) + ' / ' + this.maxHp;
    this._hpFill.scale.x = Math.max(0.001, f);
    this._hpFill.position.x = -12.5 * (1 - f);
    this._hpFill.material.color.setHex(f > 0.5 ? 0x39e06a : f > 0.22 ? 0xf5c542 : 0xe0503a);
  }

  // 미사일 발사(플레이어) — 쿨다운. 눈덩이에 맞아 정지(스턴) 중이면 발사 불가.
  playerFire(kart) {
    if (!this.active || this.dying) return;
    if (kart.stunTimer > 0) return;
    if (this._playerCd > 0) return;
    this._playerCd = 0.42;
    this._fire(kart);
  }

  _fire(kart) {
    const A = this.arena;
    const mesh = new THREE.Group();
    const cyan = new THREE.MeshBasicMaterial({ color: 0x6ff0ff, toneMapped: false });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xdff6ff, roughness: 0.3, emissive: 0x2aa0d0, emissiveIntensity: 0.6 }));
    shaft.rotation.x = Math.PI / 2; mesh.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 8), cyan); tip.rotation.x = Math.PI / 2; tip.position.z = 1.5; mesh.add(tip);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0xaef6ff, transparent: true, opacity: 0.6, toneMapped: false })); fin.position.z = -1.2; mesh.add(fin);
    mesh.userData.noShadow = true;
    // 로컬 좌표(group은 arena중심 기준) → kart.pos를 arena기준으로
    mesh.position.set(kart.pos.x - A.x, 2.0, kart.pos.z - A.z);
    this.group.add(mesh);
    this._missiles.push({ mesh, from: kart });
  }

  // AI 입력: 보스 둘레를 '빠르게 도는 웨이포인트'를 쫓게 함(자기 속도보다 빠르므로 자연히 원을 그림) + 회피
  aiInput(kart, idx, dt) {
    if (!this.active || this.dying || kart.stunTimer > 0) return { accel: false, brake: false, steer: 0, drift: false };
    const A = this.arena;
    const dir = (idx % 2) ? 1 : -1;
    const orbitR = 34 + (idx % 3) * 7;
    // 보스를 도는 웨이포인트(각 카트마다 위상차) — 반경 orbitR, 각속도 0.55rad/s
    const ang = dir * this._t * 0.55 + idx * (Math.PI * 2 / 4);
    let tx = A.x + Math.cos(ang) * orbitR, tz = A.z + Math.sin(ang) * orbitR;
    // 회피: 가장 가까운 눈덩이 착지점이 위험 반경 안이면 반대로 도망
    let best = 15 * 15, dgx = 0, dgz = 0;
    for (const s of this._snowballs) {
      const wx = A.x + s.tx, wz = A.z + s.tz;
      const dd = (kart.pos.x - wx) ** 2 + (kart.pos.z - wz) ** 2;
      if (dd < best) { best = dd; dgx = kart.pos.x - wx; dgz = kart.pos.z - wz; }
    }
    let ddx, ddz;
    if (dgx || dgz) { const dl = Math.hypot(dgx, dgz) || 1; ddx = dgx / dl; ddz = dgz / dl; }
    else { ddx = tx - kart.pos.x; ddz = tz - kart.pos.z; const dl = Math.hypot(ddx, ddz) || 1; ddx /= dl; ddz /= dl; }
    const cross = kart.forward.x * ddz - kart.forward.z * ddx;
    const dot = kart.forward.x * ddx + kart.forward.z * ddz;
    let steer = 0;
    if (dot < 0.98) steer = cross > 0 ? -1 : 1;
    // 발사(일정 간격)
    if (this._aiFireCd[idx] === undefined) this._aiFireCd[idx] = 1;
    this._aiFireCd[idx] -= dt;
    if (this._aiFireCd[idx] <= 0) { this._fire(kart); this._aiFireCd[idx] = 1.6 + (idx % 3) * 0.6; }
    // 최고속을 웨이포인트 속도보다 낮게(선회 반경↓) → 웨이포인트를 뒤쫓으며 자연히 원을 그림
    return { accel: true, brake: false, steer, drift: false, maxSpeed: 12 };
  }

  // 보스가 눈덩이 투척(랜덤 대상) — 맞으면 20초 정지
  _throwSnowball(karts) {
    const targets = karts.filter((k) => k.stunTimer <= 0 && !k.finished);
    if (!targets.length) return;
    // 결정적 랜덤(시간 기반)
    const r = Math.abs(Math.sin(this._t * 91.7) * 43758.5) % 1;
    const tgt = targets[Math.floor(r * targets.length) % targets.length];
    const A = this.arena;
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.8 }));
    ball.userData.noShadow = true;
    const start = _v.set(0, 23, 4);                 // 보스 손 근처(로컬, 커진 보스 기준)
    ball.position.copy(start);
    this.group.add(ball);
    // 대상의 현재 위치(로컬) + 약간의 리드 — 착지점 고정(피할 수 있게 예고 마커 표시)
    const tx = tgt.pos.x - A.x + tgt.forward.x * tgt.speed * 0.25;
    const tz = tgt.pos.z - A.z + tgt.forward.z * tgt.speed * 0.25;
    // 착지 예고 마커(도로에 눕힌 붉은 원) — 보고 피하도록
    const mark = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.5, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(tx, 0.15, tz); mark.userData.noShadow = true;
    this.group.add(mark);
    this._snowballs.push({ mesh: ball, mark, sx: start.x, sz: start.z, sy: start.y, tx, tz, u: 0, dur: 1.5 });
  }

  update(dt, karts, player, camera) {
    if (!this.active) return;
    this._t += dt;
    if (this._playerCd > 0) this._playerCd -= dt;

    // 벽 상승(시작 연출)
    if (this._wallRise < 1) {
      this._wallRise = Math.min(1, this._wallRise + dt * 0.8);
      for (const c of this._wallCols) c.position.y = -c.userData.h + (c.userData.baseY + c.userData.h) * this._wallRise;
    }

    // HP바 카메라 향하게
    if (camera) this._hpBar.lookAt(camera.position);

    if (this.dying) { this._updateDeath(dt); return; }

    // 보스 연출(둥실 + 팔 흔들 + 피격 펄스)
    this.boss.position.y = Math.sin(this._t * 1.4) * 0.6;
    this.boss.rotation.y = Math.sin(this._t * 0.4) * 0.2;
    for (const a of this._arms) a.arm.rotation.x = Math.sin(this._t * 2 + a.sx) * 0.25;
    if (this._flashT > 0) this._flashT -= dt;
    this.boss.scale.setScalar(1 + Math.max(0, this._flashT) * 0.6);

    // 눈덩이 투척 타이머 — 천천히(맞으면 20초 정지라 자주 던지면 다 멈춤). 간격 ↑
    this._throwTimer -= dt;
    if (this._throwTimer <= 0) { this._throwSnowball(karts); this._throwTimer = 5.5 + (Math.abs(Math.sin(this._t * 13.3)) % 1) * 2.5; }

    // 미사일 이동(보스로 유도) → 명중 시 -5
    const A = this.arena;
    for (let i = this._missiles.length - 1; i >= 0; i--) {
      const m = this._missiles[i];
      // 보스 중심(로컬 원점, y~13) — 커진 보스에 맞춰 명중 반경도 확대
      _v.set(0 - m.mesh.position.x, 13 - m.mesh.position.y, 0 - m.mesh.position.z);
      const d = _v.length();
      if (d < 10 || m.mesh.position.length() > A.r + 30) {
        if (d < 12) this._hitBoss();
        this.group.remove(m.mesh); this._missiles.splice(i, 1); continue;
      }
      _v.multiplyScalar(1 / d);
      m.mesh.position.addScaledVector(_v, 95 * dt);
      m.mesh.lookAt(_v2.copy(m.mesh.position).add(_v));
    }

    // 눈덩이 이동(포물선) → 대상 근처 착탄 시 20초 스턴
    for (let i = this._snowballs.length - 1; i >= 0; i--) {
      const s = this._snowballs[i];
      s.u += dt / s.dur;
      if (s.mark) { s.mark.material.opacity = 0.3 + 0.4 * s.u; s.mark.scale.setScalar(1 + (1 - s.u) * 0.4); }
      if (s.u >= 1) {
        // 착탄: 로컬 → 월드. 착지점(마커)에 있으면 20초 정지 — 피했으면 무사.
        const wx = A.x + s.tx, wz = A.z + s.tz;
        for (const k of karts) {
          if (k.stunTimer > 0 || k.invincTimer > 0 || k.finished) continue;
          const dx = k.pos.x - wx, dz = k.pos.z - wz;
          if (dx * dx + dz * dz < 16) k.stun(20);
        }
        this._spawnPuff(s.tx, s.tz);
        this.group.remove(s.mesh); if (s.mark) this.group.remove(s.mark);
        this._snowballs.splice(i, 1); continue;
      }
      const x = s.sx + (s.tx - s.sx) * s.u;
      const z = s.sz + (s.tz - s.sz) * s.u;
      const y = s.sy + (0.6 - s.sy) * s.u + Math.sin(s.u * Math.PI) * 9;   // 아치
      s.mesh.position.set(x, y, z);
      s.mesh.rotation.x += dt * 6; s.mesh.rotation.z += dt * 5;
    }

    // 눈발 퍼프 갱신
    if (this._puffs) for (let i = this._puffs.length - 1; i >= 0; i--) {
      const p = this._puffs[i]; p.life -= dt;
      p.mesh.scale.multiplyScalar(1 + dt * 3); p.mesh.material.opacity = Math.max(0, p.life / 0.5) * 0.7;
      if (p.life <= 0) { this.group.remove(p.mesh); this._puffs.splice(i, 1); }
    }

    if (this.hp <= 0) this._beginDeath();
  }

  _hitBoss() {
    this.hp -= 5;
    this._updateHud();
    this._flashT = 0.12;                 // 피격 순간 살짝 커졌다 복귀(반응)
    this._spawnPuff(0, 0, 11);           // 보스 위쪽에 충돌 퍼프
  }

  _spawnPuff(lx, lz, ly = 0.5) {
    if (!this._puffs) this._puffs = [];
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false }));
    puff.position.set(lx, ly, lz); puff.userData.noShadow = true;
    this.group.add(puff);
    this._puffs.push({ mesh: puff, life: 0.5 });
  }

  _beginDeath() {
    this.dying = true; this._deathT = 0;
    this._hudTxt.textContent = '처치 완료!';
  }

  _updateDeath(dt) {
    this._deathT += dt;
    // 피격 플래시 원복
    this.boss.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) { o.material.emissive.setHex(0x2a6aa0); o.material.emissiveIntensity = 0.2; } });
    // 무너짐: 가라앉으며 흔들리고 조각 흩어짐
    const u = Math.min(1, this._deathT / 1.8);
    this.boss.position.y = -u * 14;
    this.boss.rotation.z = Math.sin(this._deathT * 20) * 0.08 * (1 - u);
    this.boss.scale.setScalar(1 - u * 0.3);
    this._hpBar.visible = false;
    // 벽 하강
    if (this._deathT > 0.6) {
      const wr = Math.min(1, (this._deathT - 0.6) / 1.2);
      for (const c of this._wallCols) c.position.y = c.userData.baseY - (c.userData.baseY + c.userData.h) * wr;
    }
    if (this._deathT > 2.0) { this.done = true; }
  }

  // 보스전 종료: 숨기고 카트를 트랙 출발선 근처로 복귀(막바퀴 이어서 주행)
  end(track, karts, LAPS) {
    this.active = false; this.done = false; this.dying = false;
    this.group.visible = false;
    this._hudEl.style.display = 'none';
    this.boss.scale.setScalar(1); this.boss.position.set(0, 0, 0); this.boss.rotation.set(0, 0, 0);
    this._hpBar.visible = true;
    this._missiles.forEach((m) => this.group.remove(m.mesh)); this._missiles.length = 0;
    this._snowballs.forEach((s) => { this.group.remove(s.mesh); if (s.mark) this.group.remove(s.mark); }); this._snowballs.length = 0;
    if (this._puffs) { this._puffs.forEach((p) => this.group.remove(p.mesh)); this._puffs.length = 0; }
    // 출발선 근처(막바퀴) 재배치
    const N = track.samplePos.length;
    karts.forEach((k, i) => {
      const idx = (Math.floor(0.01 * N) + i * 6) % N;
      const p = track.samplePos[idx], lat = track.sampleLat[idx], tan = track.sampleTan[idx];
      const hw = track.sampleHalf ? track.sampleHalf[idx] : track.halfWidth;
      const off = ((i % 2) ? 1 : -1) * hw * 0.4;
      k.pos.copy(p).addScaledVector(lat, off).addScaledVector(track.sampleUp[idx], 0.1);
      k.idx = idx; k._safeIdx = idx; k.forward.copy(tan);
      k.speed = 8; k.stunTimer = 0; k.spinTimer = 0; k.airborne = false;
      k.lap = LAPS - 1; k._started = true; k._armed = true;
      k._syncMesh();
    });
  }
}
