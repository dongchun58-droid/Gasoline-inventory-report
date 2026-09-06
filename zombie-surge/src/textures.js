// textures.js — 캔버스 기반 텍스처(카드·문 숫자판·다리 바닥·물)
import * as THREE from 'three';

const hash = (i, s = 1) => Math.abs(Math.sin(i * 12.9898 * s + 78.233) * 43758.5453) % 1;

export function cardTexture(type, text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const g = cv.getContext('2d');
  const col = { plus: ['#2f8fd6', '#1a5fa0', '#fff'], mul: ['#ffd23f', '#d8a800', '#3a2a00'], minus: ['#e0503a', '#9a2a1a', '#fff'],
                weapon: ['#8a5cf6', '#5a30c0', '#fff'], shield: ['#2fd6b8', '#178a78', '#08302a'] }[type] || ['#888', '#555', '#fff'];
  const grad = g.createLinearGradient(0, 0, 0, 160); grad.addColorStop(0, col[0]); grad.addColorStop(1, col[1]);
  g.fillStyle = grad; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 148);
  g.fillStyle = col[2]; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${text.length > 4 ? 70 : 96}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
  g.fillText(text, 128, 84);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function plateTexture(num) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + hash(i) * 0.12})`; g.fillRect(hash(i, 3) * 256, hash(i, 5) * 128, 3 + hash(i, 7) * 40, 2); }
  g.strokeStyle = '#8a7a5a'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 84px "Barlow Condensed", "Arial Narrow", sans-serif'; g.shadowColor = '#000'; g.shadowBlur = 6;
  g.fillText(String(num), 128, 66);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function updatePlate(tex, num) {
  const cv = tex.image, g = cv.getContext('2d');
  g.fillStyle = '#3a2a1c'; g.fillRect(12, 12, 232, 104);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 84px "Barlow Condensed", "Arial Narrow", sans-serif'; g.shadowColor = '#000'; g.shadowBlur = 6;
  g.fillText(String(num), 128, 66); tex.needsUpdate = true;
}

export function deckTexture(base = '#b9b3a6') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // 석판 타일 + 미세 노이즈
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${hash(i, 2) * 0.10})`; g.fillRect(hash(i) * 256, hash(i, 4) * 256, 2, 2); }
  g.strokeStyle = 'rgba(40,35,30,0.45)'; g.lineWidth = 3;
  for (let y = 0; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let r = 0; r < 4; r++) for (let x = (r % 2) * 64; x < 256; x += 128) { g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function waterTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128); grad.addColorStop(0, '#0c4488'); grad.addColorStop(0.5, '#0f4f95'); grad.addColorStop(1, '#0a3d7a');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * 128 + Math.sin(i * 3.1) * 6;
    g.strokeStyle = i % 2 ? 'rgba(120,180,240,0.35)' : 'rgba(8,40,90,0.4)'; g.lineWidth = 1.5 + (i % 2);
    g.beginPath(); for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin((x + i * 20) * 0.08) * 3); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 피부/천 노멀맵용 미세 노이즈(실사감)
export function noiseNormal(size = 64, strength = 0.6) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = hash(i, 9) - 0.5, m = hash(i, 13) - 0.5;
    img.data[i * 4] = 128 + n * 60 * strength; img.data[i * 4 + 1] = 128 + m * 60 * strength; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
