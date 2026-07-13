// main.js — 씬, 고정 dt 물리 + 가변 렌더 루프, 리사이즈
// Phase 1: 트랙을 카트로 달릴 수 있는 최소 플레이 상태
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './input.js';
import { Track } from './track.js';
import { Kart, PHYS } from './kart.js';
import { ChaseCamera } from './camera.js';
import { Scenery } from './scenery.js';

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

// ---------- 밝은 한낮 스카이돔 (마리오 월드풍) + 태양 ----------
function makeSky() {
  const group = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.0, '#1E6FE0'); // 천정 (진한 하늘색)
  grd.addColorStop(0.55, '#5FB8FF');
  grd.addColorStop(0.85, '#B8E8FF');
  grd.addColorStop(1.0, '#EAF9FF'); // 지평선 (밝은 하늘)
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  group.add(dome);
  // 태양 (블룸이 먹는 밝은 원반)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false, toneMapped: false })
  );
  sunDisc.position.set(-180, 190, -430);
  sunDisc.lookAt(0, 0, 0);
  group.add(sunDisc);
  return group;
}

// ---------- 렌더러 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // iPad 60fps 핵심
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ---------- 씬 ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfeaff, 180, 620); // 밝은 하늘색 안개

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);

const gradientMap = makeToonGradient();

scene.add(makeSky());

// 라이팅 (한낮 햇살)
const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
sun.position.set(-60, 90, -40);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x6bbf5a, 1.0); // 하늘색↑ / 풀색↓
scene.add(hemi);

// ---------- 트랙 & 카트 ----------
const track = new Track(gradientMap);
scene.add(track.group);

const player = new Kart(track, 0x2e6bff, gradientMap);
scene.add(player.model);
scene.add(player.shadow);

// ---------- 배경 월드 (소품·풍선·구름·아치) ----------
const scenery = new Scenery(track, gradientMap);
scene.add(scenery.group);

const chase = new ChaseCamera(camera);
chase.snap(player);

// ---------- 포스트프로세싱: 블룸(네온 발광) (§9) ----------
const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
const rt = new THREE.WebGLRenderTarget(dbSize.x, dbSize.y, {
  type: THREE.HalfFloatType,
  samples: 4, // MSAA 유지
});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35, // strength (한낮이라 은은하게)
  0.4,  // radius
  0.8   // threshold (태양·네온·별만 발광)
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

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

  // 배경 애니메이션 (별 회전·풍선 바운스)
  scenery.update(dt);

  // HUD
  speedEl.firstChild.textContent = player.kmh;
  fpsAcc += 1 / Math.max(dt, 1e-4); fpsCount++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = Math.round(fpsAcc / fpsCount) + ' fps';
    fpsAcc = 0; fpsCount = 0; fpsTimer = 0;
  }

  input.endFrame();
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- 리사이즈 ----------
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// 디버그용 전역 노출
window.__turbo = { scene, player, track, PHYS };
