// items.js — ? 아이템 박스 + 아이템(버섯/별/불릿/바나나/등껍질)
import * as THREE from 'three';

export const ITEMS = {
  mushroom: { emoji: '🍄', label: 'MUSHROOM' },
  star:     { emoji: '⭐', label: 'STAR' },
  bullet:   { emoji: '🚀', label: 'BULLET' },
  banana:   { emoji: '🍌', label: 'BANANA' },
  shell:    { emoji: '🐢', label: 'SHELL' },
};

const _d = new THREE.Vector3();

function qmark(gm) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#c8971f'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
  g.fillStyle = '#ffffff';
  g.font = 'bold 96px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', 64, 72);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1, emissive: 0xffd23f, emissiveIntensity: 0.55 });
}

export class ItemSystem {
  constructor(track, gm, rows) {
    this.track = track;
    this.gm = gm;
    this.group = new THREE.Group();
    this.boxes = [];
    this.bananas = [];
    this.shells = [];
    this._t = 0;

    const mat = qmark(gm);
    const geo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const N = track.samplePos.length;
    // 맵별 배치(itemRows)가 있으면 사용 — 얼음맵은 성 등반·점프 구간(공중/단절)을 피함
    const boxRows = (rows && rows.length) ? rows : [0.14, 0.32, 0.5, 0.68, 0.86];
    for (const r of boxRows) {
      const i = Math.floor(r * N) % N;
      if (track.sampleGap && track.sampleGap[i]) continue;   // 단절(낭떠러지) 구간엔 배치 안 함
      const p = track.samplePos[i], lat = track.sampleLat[i], up = track.sampleUp[i];
      const hw = track.sampleHalf ? track.sampleHalf[i] : track.halfWidth;
      // 중앙 분리대가 있는 구간: 센터 대신 양쪽 차선에 2개씩 (분리대 위엔 못 먹으므로)
      const median = track.sampleMedian && track.sampleMedian[i];
      const offs = median
        ? [-hw * 0.62, -hw * 0.28, hw * 0.28, hw * 0.62]
        : [-hw * 0.55, 0, hw * 0.55];
      for (const off of offs) {
        const mesh = new THREE.Mesh(geo, mat);
        // 도로면(up 방향)에서 살짝 띄움 — 경사/공중 도로에서도 도로 위에 정확히 뜨게
        mesh.position.copy(p).addScaledVector(lat, off).addScaledVector(up, 1.3);
        this.group.add(mesh);
        this.boxes.push({ mesh, home: mesh.position.clone(), active: true, respawn: 0 });
      }
    }

    // 바나나/등껍질 프리팹 재질·지오메트리
    this._bananaGeo = new THREE.TorusGeometry(0.55, 0.2, 8, 12, Math.PI * 1.2);
    this._bananaMat = new THREE.MeshStandardMaterial({ color: 0xffe23f, roughness: 0.6, metalness: 0 });
    this._shellGeo = new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this._shellMat = new THREE.MeshStandardMaterial({ color: 0x35c94a, roughness: 0.45, metalness: 0.1, emissive: 0x35c94a, emissiveIntensity: 0.2 });
  }

  _grant(kart, rank) {
    const roll = Math.abs((Math.sin(this._t * 97.13 + kart.pos.x * 3.7 + kart.pos.z * 1.9) * 43758.5453) % 1);
    // 버섯이 가장 많고, 불릿 확률은 이전의 약 2배
    let item;
    if (rank === 1) {
      item = roll < 0.68 ? 'mushroom' : roll < 0.82 ? 'banana' : roll < 0.94 ? 'shell' : 'bullet'; // 불릿 ~6%
    } else if (rank >= 3) {
      item = roll < 0.46 ? 'mushroom' : roll < 0.66 ? 'star' : roll < 0.8 ? 'shell' : roll < 0.88 ? 'banana' : 'bullet'; // 불릿 ~12%
    } else {
      item = roll < 0.54 ? 'mushroom' : roll < 0.74 ? 'star' : roll < 0.86 ? 'shell' : roll < 0.9 ? 'banana' : 'bullet'; // 불릿 ~10%
    }
    kart.heldItem = item;
    if (kart.isAI) kart.aiUseTimer = 0.8 + roll * 1.8;
  }

  useItem(kart, karts) {
    const item = kart.heldItem;
    if (!item) return null;
    kart.heldItem = null;
    if (item === 'mushroom') kart.giveBoost(2.6); // 더 길고 강한 가속
    else if (item === 'star') kart.setInvincible(5);
    else if (item === 'bullet') kart.startBullet(4.5);
    else if (item === 'banana') this._dropBanana(kart);
    else if (item === 'shell') this._fireShell(kart);
    return item;
  }

  _dropBanana(owner) {
    _d.copy(owner.forward).setY(0).normalize();
    const mesh = new THREE.Mesh(this._bananaGeo, this._bananaMat);
    mesh.position.copy(owner.pos).addScaledVector(_d, -3);
    mesh.rotation.x = -Math.PI / 2;
    const gy = this.track.samplePos[owner.idx].y;
    mesh.position.y = gy + 0.35;
    this.group.add(mesh);
    this.bananas.push({ mesh, owner, grace: 1.2 });
  }

  _fireShell(owner) {
    _d.copy(owner.forward).setY(0).normalize();
    const mesh = new THREE.Mesh(this._shellGeo, this._shellMat);
    mesh.position.copy(owner.pos).addScaledVector(_d, 2.5);
    mesh.position.y += 0.4;
    this.group.add(mesh);
    this.shells.push({ mesh, owner, dir: _d.clone(), speed: 42, life: 4, grace: 0.2 });
  }

  update(dt, karts) {
    this._t += dt;

    // ? 박스
    for (const b of this.boxes) {
      if (b.active) {
        b.mesh.rotation.y += dt * 1.6;                 // 세로축 회전만(똑바로 서서 회전) — 기울어짐 방지
        b.mesh.position.y = b.home.y + Math.sin(this._t * 2 + b.home.x) * 0.18; // 은은한 상하 바운스
        for (const k of karts) {
          if (k.heldItem || k.spinTimer > 0) continue;
          if (k.pos.distanceToSquared(b.mesh.position) < 7) {
            b.active = false; b.respawn = 3; b.mesh.visible = false;
            this._grant(k, k.rank || 2);
            break;
          }
        }
      } else {
        b.respawn -= dt;
        if (b.respawn <= 0) { b.active = true; b.mesh.visible = true; }
      }
    }

    // AI 아이템 자동 사용
    for (const k of karts) {
      if (k.isAI && k.heldItem) {
        k.aiUseTimer -= dt;
        if (k.aiUseTimer <= 0) this.useItem(k, karts);
      }
    }

    // 바나나 (밟으면 스핀)
    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const bn = this.bananas[i];
      bn.grace -= dt;
      bn.mesh.rotation.z += dt * 1.5;
      let hit = false;
      for (const k of karts) {
        if (bn.grace > 0 && k === bn.owner) continue;
        if (k.pos.distanceToSquared(bn.mesh.position) < 4) {
          if (k.spinOut(1.2)) hit = true;
          hit = true; break;
        }
      }
      if (hit) { this.group.remove(bn.mesh); this.bananas.splice(i, 1); }
    }

    // 등껍질 (직진, 맞으면 스핀)
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt; sh.grace -= dt;
      sh.mesh.position.addScaledVector(sh.dir, sh.speed * dt);
      const gi = this.track.sampleNear(sh.mesh.position, 0);
      sh.mesh.position.y = this.track.samplePos[gi].y + 0.4;
      sh.mesh.rotation.y += dt * 8;
      let done = sh.life <= 0;
      for (const k of karts) {
        if (sh.grace > 0 && k === sh.owner) continue;
        if (k.pos.distanceToSquared(sh.mesh.position) < 4.5) { k.spinOut(1.2); done = true; break; }
      }
      if (done) { this.group.remove(sh.mesh); this.shells.splice(i, 1); }
    }
  }

  reset() {
    for (const bn of this.bananas) this.group.remove(bn.mesh);
    for (const sh of this.shells) this.group.remove(sh.mesh);
    this.bananas.length = 0; this.shells.length = 0;
    for (const b of this.boxes) { b.active = true; b.mesh.visible = true; b.respawn = 0; }
  }
}
