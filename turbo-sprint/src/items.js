// items.js — ? 아이템 박스 + 아이템(버섯/별/불릿)
import * as THREE from 'three';

export const ITEMS = {
  mushroom: { emoji: '🍄', label: 'MUSHROOM' },
  star:     { emoji: '⭐', label: 'STAR' },
  bullet:   { emoji: '🚀', label: 'BULLET' },
};

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
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: gm, emissive: 0xffd23f, emissiveIntensity: 0.6 });
}

export class ItemSystem {
  constructor(track, gm) {
    this.track = track;
    this.group = new THREE.Group();
    this.boxes = [];
    this._t = 0;

    const mat = qmark(gm);
    const geo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const N = track.samplePos.length;
    const rows = [0.14, 0.32, 0.5, 0.68, 0.86];
    for (const r of rows) {
      const i = Math.floor(r * N) % N;
      const p = track.samplePos[i], lat = track.sampleLat[i];
      for (const off of [-track.halfWidth * 0.55, 0, track.halfWidth * 0.55]) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x + lat.x * off, p.y + 1.8, p.z + lat.z * off);
        this.group.add(mesh);
        this.boxes.push({ mesh, home: mesh.position.clone(), active: true, respawn: 0 });
      }
    }
  }

  _grant(kart, rank) {
    const roll = Math.abs((Math.sin(this._t * 97.13 + kart.pos.x * 3.7 + kart.pos.z * 1.9) * 43758.5453) % 1);
    let item;
    if (rank === 1) item = roll < 0.75 ? 'mushroom' : 'bullet';
    else if (rank >= 3) item = roll < 0.35 ? 'mushroom' : (roll < 0.7 ? 'bullet' : 'star');
    else item = roll < 0.5 ? 'mushroom' : (roll < 0.8 ? 'bullet' : 'star');
    kart.heldItem = item;
    if (kart.isAI) kart.aiUseTimer = 0.8 + roll * 1.6;
  }

  useItem(kart, karts) {
    const item = kart.heldItem;
    if (!item) return null;
    kart.heldItem = null;
    if (item === 'mushroom') kart.giveBoost(1.5);
    else if (item === 'star') kart.setInvincible(5);
    else if (item === 'bullet') kart.startBullet(4.5);
    return item;
  }

  update(dt, karts) {
    this._t += dt;
    for (const b of this.boxes) {
      if (b.active) {
        b.mesh.rotation.y += dt * 1.6;
        b.mesh.rotation.x += dt * 0.9;
        b.mesh.position.y = b.home.y + Math.sin(this._t * 2 + b.home.x) * 0.2;
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
  }
}
