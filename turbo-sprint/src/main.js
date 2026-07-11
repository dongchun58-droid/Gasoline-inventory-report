// main.js — 씬, 고정 dt 물리 + 가변 렌더 루프, 리사이즈
// Phase 1: 트랙을 카트로 달릴 수 있는 최소 플레이 상태
import * as THREE from 'three';
import { Input } from './input.js';
import { Track } from './track.js';
import { Kart, PHYS } from './kart.js';
import { ChaseCamera } from './camera.js';

// ---------- 셀 셰이딩용 3단 그라디언트맵 (§9) ----------
function makeToonGradient() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 1;
  const g = cv.getContext('2d');
  // 어두움 55% / 중간 80% / 밝음 100%
  const steps = ['#8c8c8c', '#8c8c8c', '#cccccc', '#ffffff'];
  for (let i = 0; i < steps.length; i++) {
    g.fillStyle = steps[i];
    g.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

// ---------- 임시 노을 스카이돔 (Phase 6에서 고도화) ----------
function makeSky() {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.0, '#3D2C8D'); // 천정
  grd.addColorStop(0.55, '#FF5E8A');
  grd.addColorStop(1.0, '#FF9E5E'); // 지평선
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(600, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geo, mat);
}

// ---------- 렌더러 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // iPad 60fps 핵심
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// ---------- 씬 ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xff7e77, 120, 520);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);

const gradientMap = makeToonGradient();

scene.add(makeSky());

// 라이팅 (§9)
const sun = new THREE.DirectionalLight(0xffb36b, 2.2);
sun.position.set(40, 60, 20);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xff9e5e, 0x3d2c8d, 0.8);
scene.add(hemi);

// ---------- 트랙 & 카트 ----------
const track = new Track(gradientMap);
scene.add(track.group);

const player = new Kart(track, 0x2e6bff, gradientMap);
scene.add(player.model);
scene.add(player.shadow);

const chase = new ChaseCamera(camera);
chase.snap(player);

// ---------- 입력 ----------
const input = new Input();
input.onFirstInput(() => { /* Phase 6: AudioContext.resume() */ });

// ---------- 루프: 고정 dt 물리(1/120) + 가변 렌더 ----------
const FIXED = 1 / 120;
let accumulator = 0;
let last = performance.now() / 1000;

// FPS 표시
const fpsEl = document.getElementById('fps');
const speedEl = document.getElementById('speed');
let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;

function frame(nowMs) {
  const now = nowMs / 1000;
  let dt = now - last;
  last = now;
  if (dt > 0.25) dt = 0.25; // 탭 복귀 등 큰 점프 방지

  // 리스타트
  if (input.consumePressed('restart')) {
    player.resetToStart();
    chase.snap(player);
  }

  // 고정 스텝 물리
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED && steps < 8) {
    player.step(FIXED, input);
    accumulator -= FIXED;
    steps++;
  }

  // 카메라(가변 렌더 dt)
  chase.update(player, dt);

  // HUD
  speedEl.firstChild.textContent = player.kmh;
  fpsAcc += 1 / Math.max(dt, 1e-4); fpsCount++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = Math.round(fpsAcc / fpsCount) + ' fps';
    fpsAcc = 0; fpsCount = 0; fpsTimer = 0;
  }

  input.endFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- 리사이즈 ----------
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
}
window.addEventListener('resize', onResize);

// 디버그용 전역 노출
window.__turbo = { scene, player, track, PHYS };
