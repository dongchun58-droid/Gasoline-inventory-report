// items.js — ? 아이템 박스 + 아이템(버섯/별/로켓) + 로켓 발사체
import * as THREE from 'three';

export const ITEMS = {
  mushroom: { emoji: '🍄', label: 'MUSHROOM' },
  star:     { emoji: '⭐', label: 'STAR' },
  rocket:   { emoji: '🚀', label: 'ROCKET' },
};

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

function qmark(gm) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#c8971f'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#ffffff';
  g.font = 'bold 96px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', 64, 70);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: gm, emissive: 0xffd23f, emissiveIntensity: 0.5, transparent: true, opacity: 0.95 });
}

export class ItemSystem {
  constructor(track, gm) {
    this.track = track;
    this.group = new THREE.Group();
    this.boxes = [];
    this.rockets = [];
    this._t = 0;

    const mat = qmark(gm);
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const N = track.samplePos.length;
    // 여러 지점에 가로 3개씩
    const rows = [0.16, 0.42, 0.68, 0.9];
    for (const r of rows) {
      const i = Math.floor(r * N) % N;
      const p = track.samplePos[i], lat = track.sampleLat[i];
      for (const off of [-track.halfWidth * 0.5, 0, track.halfWidth * 0.5]) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x + lat.x * off, p.y + 1.6, p.z + lat.z * off);
        this.group.add(mesh);
        this.boxes.push({ mesh, home: mesh.position.clone(), active: true, respawn: 0 });
      }
    }

    // 로켓 프리팹 재질
    this._rocketMat = new THREE.MeshToonMaterial({ color: 0xff3b3b, gradientMap: gm, emissive: 0xff3b3b, emissiveIntensity: 0.8 });
    this._rocketGeo = new THREE.ConeGeometry(0.4, 1.2, 8);
  }

  // 순위/무작위로 아이템 지급
  _grant(kart, rank) {
    const roll = (Math.sin(this._t * 97.13 + kart.pos.x * 3.7) * 43758.5453) % 1; // 결정적 유사난수
    const r = Math.abs(roll);
    let item;
    if (rank === 1) item = r < 0.7 ? 'mushroom' : 'rocket';
    else if (r < 0.45) item = 'mushroom';
    else if (r < 0.8) item = 'rocket';
    else item = 'star';
    kart.heldItem = item;
    if (kart.isAI) kart.aiUseTimer = 1.0 + r * 1.5;
  }

  useItem(kart, karts) {
    const item = kart.heldItem;
    if (!item) return null;
    kart.heldItem = null;
    if (item === 'mushroom') {
      kart.giveBoost(1.5);
    } else if (item === 'star') {
      kart.setInvincible(5);
    } else if (item === 'rocket') {
      this._fireRocket(kart, karts);
    }
    return item;
  }

  _fireRocket(owner, karts) {
    // 순위상 바로 앞 카트를 타깃
    let target = null, bestGap = Infinity;
    for (const k of karts) {
      if (k === owner) continue;
      const gap = k.progress - owner.progress;
      if (gap > 0 && gap < bestGap) { bestGap = gap; target = k; }
    }
    const mesh = new THREE.Mesh(this._rocketGeo, this._rocketMat);
    mesh.position.copy(owner.pos).addScaledVector(owner.forward, 2);
    mesh.position.y += 0.8;
    this.group.add(mesh);
    this.rockets.push({
      mesh, target, owner,
      dir: owner.forward.clone().setY(0).normalize(),
      speed: 40, life: 4,
    });
  }

  update(dt, karts, player) {
    this._t += dt;
    // 박스 회전 + 픽업 + 리스폰
    for (const b of this.boxes) {
      if (b.active) {
        b.mesh.rotation.y += dt * 1.5;
        b.mesh.rotation.x += dt * 0.8;
        b.mesh.position.y = b.home.y + Math.sin(this._t * 2 + b.home.x) * 0.2;
        for (const k of karts) {
          if (k.heldItem || k.spinTimer > 0) continue;
          if (k.pos.distanceToSquared(b.mesh.position) < 6) {
            b.active = false; b.respawn = 3; b.mesh.visible = false;
            // 순위 계산은 main에서 갱신된 k.rank 사용(없으면 2)
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

    // 로켓 갱신
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      if (r.target && !r.target.finished) {
        _d.copy(r.target.pos).sub(r.mesh.position); _d.y = 0;
        if (_d.lengthSq() > 1e-4) {
          _d.normalize();
          r.dir.lerp(_d, Math.min(1, dt * 3)).normalize();
        }
      }
      r.mesh.position.addScaledVector(r.dir, r.speed * dt);
      r.mesh.position.y = this._groundYish(r.mesh.position) + 0.8;
      // 진행방향 바라보게
      r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), r.dir);
      // 명중 판정
      let hit = false;
      for (const k of karts) {
        if (k === r.owner) continue;
        if (k.pos.distanceToSquared(r.mesh.position) < 5) {
          if (k.spinOut(1.2)) hit = true; else hit = true;
          break;
        }
      }
      if (hit || r.life <= 0) {
        this.group.remove(r.mesh);
        this.rockets.splice(i, 1);
      }
    }
  }

  _groundYish(p) {
    const i = this.track.sampleNear(p, 0);
    return this.track.samplePos[i].y;
  }
}
