// main.js — 씬, 고정 dt 물리 + 가변 렌더 루프, 리사이즈
// Phase 1: 트랙을 카트로 달릴 수 있는 최소 플레이 상태
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './input.js';
import { Track } from './track.js';
import { Kart, PHYS, VEHICLES, VEHICLE_ORDER } from './kart.js';
import { ChaseCamera } from './camera.js';
import { Scenery } from './scenery.js';
import { AIController } from './ai.js';
import { ItemSystem } from './items.js';
import { Features } from './features.js';
import { Obstacles } from './obstacles.js';
import { HUD } from './hud.js';
import { setupTouch } from './touch.js';
import { GameAudio } from './audio.js';

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

// 환경맵(반사)용 이퀴렉트 텍스처 — 금속/유리 재질 반사에 사용
function makeEnvTex() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.0, '#1E6FE0');
  grd.addColorStop(0.5, '#8fd0ff');
  grd.addColorStop(0.6, '#eaf9ff');   // 지평선
  grd.addColorStop(0.61, '#6fc45a');  // 그 아래 초록
  grd.addColorStop(1.0, '#3f8e3a');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  // 태양 하이라이트
  const sg = g.createRadialGradient(120, 60, 4, 120, 60, 60);
  sg.addColorStop(0, 'rgba(255,255,240,1)'); sg.addColorStop(1, 'rgba(255,255,240,0)');
  g.fillStyle = sg; g.fillRect(60, 0, 120, 120);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 렌더러 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let PIX_CAP = 2; // HD (프레임 낮으면 자동 저하)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIX_CAP));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---------- 씬 ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfeaff, 200, 680);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);

const gradientMap = makeToonGradient();

const sky = makeSky();
scene.add(sky);

// 환경 반사 (금속 차량 재질)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(makeEnvTex()).texture;

// 라이팅 (한낮 햇살 + 실시간 그림자)
const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
sun.position.set(-60, 90, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);
const SUN_DIR = new THREE.Vector3(0.5, 0.95, 0.35).normalize();
const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x6bbf5a, 0.9);
scene.add(hemi);

// ---------- 트랙 ----------
const track = new Track(gradientMap);
scene.add(track.group);

// ---------- 카트들 (플레이어 + AI 3) ----------
const LAPS = 3;
// [색, 이름, 레인오프셋, 그리드 lat, 그리드 back]
const LINEUP = [
  { color: 0x2e6bff, name: 'YOU',       lane: 0,  gLat: -3.5, gBack: 5,  ai: false, type: 'kart' },
  { color: 0xff3b3b, name: 'CRIMSON',   lane: -3, gLat: 3.5,  gBack: 5,  ai: true,  type: 'sports' },
  { color: 0x18c2c2, name: 'TEAL',      lane: 0,  gLat: -3.5, gBack: 12, ai: true,  type: 'bike' },
  { color: 0xffc233, name: 'GOLD',      lane: 3,  gLat: 3.5,  gBack: 12, ai: true,  type: 'truck' },
];
const karts = [];
const ais = [];
let player;
for (const spec of LINEUP) {
  const k = new Kart(track, spec.color, gradientMap, spec.type);
  k.name = spec.name;
  k.isAI = spec.ai;
  k.gridLat = spec.gLat; k.gridBack = spec.gBack;
  k.resetToStart(spec.gLat, spec.gBack);
  scene.add(k.model, k.shadow);
  karts.push(k);
  if (spec.ai) ais.push(new AIController(k, track, spec.lane));
  else player = k;
}

// ---------- 아이템 시스템 ----------
const itemSystem = new ItemSystem(track, gradientMap);
scene.add(itemSystem.group);

// ---------- 장애물: 횡단하는 젖소 ----------
const obstacles = new Obstacles(track, gradientMap);
scene.add(obstacles.group);

// ---------- 트랙 기능: 네온 부스트 발판 + 점프 램프 ----------
const features = new Features(track, gradientMap);
scene.add(features.group);

// ---------- 배경 월드 ----------
const scenery = new Scenery(track, gradientMap);
scene.add(scenery.group);

// ---------- HUD ----------
const hud = new HUD(track);

const chase = new ChaseCamera(camera);
chase.snap(player);

// ---------- 레이스 상태 ----------
const NEUTRAL = { accel: false, brake: false, steer: 0, drift: false };
let raceTime = 0;
let raceState = 'ready';            // 'ready' | 'countdown' | 'racing' | 'finished'
let countdownRem = 3.2;
let goFired = false;
let accelPressRem = null;          // 로켓스타트 판정용
let prevPlayerLap = 0;
let finishSnapped = false;
// SFX 엣지 감지
let _prevBoost = false, _prevAir = false, _prevSpin = false, _mooCd = 0, _prevCdRem = 3.2;

function resetRace() {
  for (const k of karts) {
    k.resetToStart(k.gridLat, k.gridBack);
    k.lap = 0; k.progress = 0; k._prevT = undefined; k._started = false; k._armed = true;
    k.finished = false; k.finishTime = 0;
    k.heldItem = null; k.boostTimer = 0; k.spinTimer = 0; k.invincTimer = 0;
    k.bulletTimer = 0; k.wheelspinTimer = 0; k.drifting = false; k.driftYaw = 0;
    k._bulletMode = false; k._bmShown = undefined;
    for (const p of k.model.userData.bodyParts) p.visible = true;
    k.model.userData.bulletMesh.visible = false;
    k.model.scale.setScalar(1);
  }
  itemSystem.reset();
  raceTime = 0;
  raceState = 'ready';
  countdownRem = 3.2;
  goFired = false;
  accelPressRem = null;
  prevPlayerLap = 0;
  finishSnapped = false;
  hud.hideResult();
  hud.hideLapPopup();
  hud.hideCountdown();
  chase.reset();
  chase.snap(player);
}

// 최종 순위: 완주자는 기록순, 미완주자는 진행도순
function computeStandings() {
  return karts.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

function updateProgress(k) {
  const N = track.samplePos.length;
  const t = k.idx / (N - 1);
  if (k._prevT === undefined) k._prevT = t;
  if (k._armed === undefined) k._armed = true; // 첫 통과(스타트)는 유효
  // 히스테리시스: 통과 후 트랙 중반(t~0.5)을 지나야 다음 통과가 유효
  if (t > 0.4 && t < 0.6) k._armed = true;
  if (k._armed && k._prevT > 0.72 && t < 0.28) {
    k._armed = false;
    if (!k._started) k._started = true; else k.lap++;
    if (k._started && k.lap >= LAPS && !k.finished) {
      k.finished = true; k.finishTime = raceTime;
    }
  }
  k._prevT = t;
  k.progress = (k._started ? k.lap : -1) + t;
}

function updateRanks() {
  const sorted = karts.slice().sort((a, b) => b.progress - a.progress);
  sorted.forEach((k, i) => { k.rank = i + 1; });
}

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = (s % 60);
  return (m > 0 ? m + ':' : '') + sec.toFixed(2).padStart(5, '0');
}

// 카트 간 구 충돌 (반경 1.1m)
const _sep = new THREE.Vector3();
const _shoveTmp = new THREE.Vector3();
function resolveKartCollisions() {
  const MIN = 2.2;
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i], b = karts[j];
      _sep.set(b.pos.x - a.pos.x, 0, b.pos.z - a.pos.z);
      const d = _sep.length();
      if (d > 1e-4 && d < MIN) {
        _sep.multiplyScalar(1 / d); // a→b 방향(단위)
        const push = (MIN - d) * 0.5;
        a.pos.addScaledVector(_sep, -push);
        b.pos.addScaledVector(_sep, push);

        // 불릿/무적은 상대를 스핀아웃시킴 (항상)
        const aP = a.bulletTimer > 0 || a.invincTimer > 0;
        const bP = b.bulletTimer > 0 || b.invincTimer > 0;
        if (aP && !bP) b.spinOut(1.1);
        else if (bP && !aP) a.spinOut(1.1);

        // 나머지 효과는 새 충돌(쿨다운)일 때만 → 급감속 방지
        if (a._bumpCd <= 0 && b._bumpCd <= 0) {
          a._bumpCd = b._bumpCd = 0.35;
          // 부드러운 감속 (한 번, 소폭)
          a.speed *= 0.94; b.speed *= 0.94;
          // 램밍: 빠르고 강한 쪽이 상대를 옆으로 튕겨냄
          const ram = Math.abs(a.speed) >= Math.abs(b.speed) ? a : b;
          const hit = ram === a ? b : a;
          const diff = Math.abs(ram.speed) - Math.abs(hit.speed);
          if (diff > 6 && !bP && !aP) {
            const ratio = ram.stats.strength / hit.stats.strength;
            const mag = Math.min(34, diff * 1.6 * ratio);
            const dir = hit === b ? 1 : -1; // _sep는 a→b
            _sep.y = 0;
            hit.applyShove(_shoveTmp.copy(_sep).multiplyScalar(dir * mag));
            hit.speed *= 0.8;
          }
        }
      }
    }
  }
}

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

// ---------- 실시간 그림자 적용 ----------
function enableShadows(root) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}
enableShadows(scene);
sky.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
for (const k of karts) k.shadow.visible = false; // 실제 그림자로 대체
function updateSun() {
  sun.target.position.copy(player.pos);
  sun.position.copy(player.pos).addScaledVector(SUN_DIR, 130);
}
updateSun();

// ---------- 입력 ----------
const input = new Input();
setupTouch(input); // 터치 조작(폰) 연결

// ---------- 오디오 (합성 BGM) ----------
const audio = new GameAudio();
input.onFirstInput(() => audio.start()); // 첫 입력에서 재생(iOS 정책)
const muteBtn = document.getElementById('btnMute');
function toggleMute() {
  const m = audio.toggleMute();
  if (muteBtn) muteBtn.textContent = m ? '🔇' : '🔊';
}
muteBtn?.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); toggleMute(); });

// ---------- 시작/재시작 버튼 ----------
const startScreen = document.getElementById('startScreen');
function beginRace() {
  resetRace();
  raceState = 'countdown';
  startScreen.classList.remove('show');
  hud.hideResult();
  audio.start();
}
document.getElementById('btnStart')?.addEventListener('pointerdown', (e) => { e.preventDefault(); beginRace(); });
document.getElementById('btnAgain')?.addEventListener('pointerdown', (e) => { e.preventDefault(); beginRace(); });

// ---------- 차량 선택 UI (막대차트 스탯) ----------
function statPct(stat, val) {
  let min = Infinity, max = -Infinity;
  for (const t of VEHICLE_ORDER) { const v = VEHICLES[t][stat]; min = Math.min(min, v); max = Math.max(max, v); }
  return Math.round(20 + ((val - min) / (max - min || 1)) * 80);
}
function setupVehicleSelect() {
  const cont = document.getElementById('vehicleSelect');
  if (!cont) return;
  const bar = (lab, cls, stat, v) =>
    `<div class="vbar"><span class="vlab">${lab}</span><span class="vtrack"><span class="vfill ${cls}" style="width:${statPct(stat, v[stat])}%"></span></span></div>`;
  cont.innerHTML = VEHICLE_ORDER.map((t) => {
    const v = VEHICLES[t];
    return `<div class="vcard${t === player.type ? ' sel' : ''}" data-type="${t}">` +
      `<div class="vname">${v.name}</div>` +
      bar('SPD', 'spd', 'speed', v) + bar('POW', 'pow', 'strength', v) + bar('TRN', 'trn', 'turn', v) +
      `</div>`;
  }).join('');
  cont.querySelectorAll('.vcard').forEach((card) => {
    card.addEventListener('pointerdown', (e) => { e.preventDefault(); selectVehicle(card.dataset.type); });
  });
}
function selectVehicle(type) {
  if (!VEHICLES[type] || type === player.type) return;
  const old = player.setType(type);
  scene.remove(old); scene.add(player.model);
  enableShadows(player.model);
  player.resetToStart(player.gridLat, player.gridBack);
  document.querySelectorAll('#vehicleSelect .vcard').forEach((c) => c.classList.toggle('sel', c.dataset.type === type));
}
setupVehicleSelect();

// ---------- 루프: 고정 dt 물리(1/120) + 가변 렌더 ----------
const FIXED = 1 / 120;
let accumulator = 0;
let last = performance.now() / 1000;

// FPS 표시
const fpsEl = document.getElementById('fps');
let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;

function frame(nowMs) {
  const now = nowMs / 1000;
  let dt = now - last;
  last = now;
  if (dt > 0.25) dt = 0.25; // 탭 복귀 등 큰 점프 방지

  // 음소거 토글 (M)
  if (input.consumePressed('mute')) toggleMute();

  // 시작 / 재시작: R은 언제나 재시작, ready/finished에선 Space도 시작
  const wantStart = input.consumePressed('restart')
    || ((raceState === 'ready' || raceState === 'finished') && input.consumePressed('item'));
  if (wantStart) beginRace();

  // --- 카운트다운 표시 + 로켓스타트 판정 (ready에선 정지) ---
  if (raceState !== 'ready' && countdownRem > -0.4) {
    _prevCdRem = countdownRem;
    countdownRem -= dt;
    for (const thr of [2.4, 1.6]) { if (_prevCdRem > thr && countdownRem <= thr) audio.sfxBeep(false); }
    if (raceState === 'countdown' && accelPressRem === null && input.accel) accelPressRem = countdownRem;
    if (!goFired && countdownRem <= 0.8) {
      goFired = true;
      raceState = 'racing';
      audio.sfxBeep(true); // GO!
      if (accelPressRem !== null) {
        if (accelPressRem <= 1.15) player.giveBoost(1.2);   // 완벽 스타트
        else player.wheelspinTimer = 0.6;                    // 너무 일찍 → 휠스핀
      }
      ais.forEach((ai, i) => { if (((i * 0.37 + 0.2) % 1) < 0.5) ai.kart.giveBoost(0.7); });
    }
    hud.showCountdown(countdownRem);
  }

  if (raceState === 'racing' || raceState === 'finished') {
    // --- 레이싱 / 피니시 ---
    if (raceState === 'racing' && input.consumePressed('item') && player.heldItem && !player.finished) {
      itemSystem.useItem(player, karts);
      audio.sfxItem();
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED && steps < 8) {
      player.step(FIXED, player.finished ? NEUTRAL : input);
      for (const ai of ais) {
        const inp = ai.update(FIXED, player);
        ai.kart.step(FIXED, inp);
      }
      resolveKartCollisions();
      for (const k of karts) updateProgress(k);
      updateRanks();
      accumulator -= FIXED;
      steps++;
    }
    if (raceState === 'racing') raceTime += dt;

    // 남은 바퀴 팝업 (플레이어 랩 증가 시)
    if (player.lap > prevPlayerLap) {
      prevPlayerLap = player.lap;
      const remaining = LAPS - player.lap;
      if (remaining === 1) hud.showLapPopup('FINAL LAP!');
      else if (remaining > 1) hud.showLapPopup('LAP ' + (player.lap + 1) + ' / ' + LAPS);
    }

    // 피니시 진입
    if (player.finished && raceState !== 'finished') {
      raceState = 'finished';
    }

    // --- 효과음 (플레이어 상태 엣지) ---
    if (player.boosting && !_prevBoost) audio.sfxBoost();
    if (player.airborne && !_prevAir) audio.sfxJump();
    if (player.spinTimer > 0 && !_prevSpin) audio.sfxHit();
    _prevBoost = player.boosting; _prevAir = player.airborne; _prevSpin = player.spinTimer > 0;
    // 젖소 "음메" (근접 시, 쿨다운)
    _mooCd -= dt;
    if (_mooCd <= 0) {
      for (const cow of obstacles.cows) {
        if (player.pos.distanceToSquared(cow.mesh.position) < 260) { audio.sfxMoo(); _mooCd = 2.5; break; }
      }
    }
  }

  // 아이템/발판/배경
  itemSystem.update(dt, karts);
  if (raceState === 'racing' || raceState === 'finished') {
    features.update(dt, karts);
    obstacles.update(dt, karts);
  }
  scenery.update(dt);

  // 카메라 (피니시 시 줌 연출)
  if (raceState === 'finished') chase.updateFinish(player, dt);
  else chase.update(player, dt, player.boosting);

  // HUD
  hud.update({
    kmh: player.kmh, rank: player.rank || 1,
    lap: player.lap, laps: LAPS,
    item: player.heldItem, roulette: false,
  });
  hud.drawMinimap(karts);
  if (raceState === 'finished' && !finishSnapped) {
    finishSnapped = true;
    audio.sfxFanfare();
    hud.showResult(computeStandings(), player, fmtTime(player.finishTime));
  }

  fpsAcc += 1 / Math.max(dt, 1e-4); fpsCount++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    const f = Math.round(fpsAcc / fpsCount);
    fpsEl.textContent = f + ' fps';
    fpsAcc = 0; fpsCount = 0; fpsTimer = 0;
    maybeDowngrade(f);
  }

  updateSun(); // 그림자 프러스텀을 플레이어 주변으로
  input.endFrame();
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- 리사이즈 / 적응형 품질 ----------
function applyResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIX_CAP));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', applyResize);

let _qChecks = 0, _lowSet = false;
function maybeDowngrade(fps) {
  if (_lowSet) return;
  _qChecks++;
  if (_qChecks > 6 && fps < 45) { // ~3s 워밍업 후에도 낮으면
    _lowSet = true;
    PIX_CAP = 1.3;
    applyResize();
  }
}

// 디버그용 전역 노출
window.__turbo = {
  scene, player, karts, track, itemSystem, features, obstacles, input, audio, PHYS, resetRace,
  get raceState() { return raceState; },
  get countdownRem() { return countdownRem; },
};
