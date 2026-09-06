// main.js — ZOMBIE SURGE 엔트리: 렌더러·조명·상태 머신(menu → play → result)
import * as THREE from 'three';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { FX } from './fx.js';
import { LaneRunner } from './lane.js';
import { STAGES } from './stages.js';
import { load, save } from './save.js';
import { GameAudio } from './audio.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 7.6, 11.5);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.bias = -0.0008;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x3a5a7a, 1.0); scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.25); scene.add(ambient);
const fx = new FX(); scene.add(fx.group);
const input = new Input(renderer.domElement);
const hud = new HUD();
const audio = new GameAudio();
input.onFirstInput(() => audio.start && audio.start());
const state = { mode: 'menu', run: null, stage: null, character: 'cool', data: load() };

function applyTheme(theme) {
  scene.background = new THREE.Color(theme.sky); scene.fog = new THREE.Fog(theme.fog, 60, 260);
  sun.color.setHex(theme.sun); sun.intensity = theme.time === 'sunset' ? 1.8 : 2.2;
  sun.position.set(theme.time === 'sunset' ? -40 : 30, theme.time === 'sunset' ? 25 : 60, theme.time === 'sunset' ? -30 : -20);
  hemi.color.setHex(theme.hemi); hemi.groundColor.setHex(theme.ground);
}
function startStage(n, character) {
  const st = STAGES.find((s) => s.n === n); if (!st || !st.playable) return;
  if (state.run) state.run.dispose();
  state.stage = st; state.character = character; state.data.character = character; save(state.data);
  applyTheme(st.theme);
  state.run = new LaneRunner(scene, camera, st, character, fx, audio);
  hud.hideMenu(); hud.hideResult(); hud.setStage(st); hud.showHint(true); setTimeout(() => hud.showHint(false), 4000);
  state.mode = 'play'; state.slow = 0;
}
function showMenu() { state.mode = 'menu'; hud.hideResult(); hud.buildMenu(state.data, startStage, showCredits); }
function showCredits() {
  hud.showCredits(`<b>ZOMBIE SURGE</b> — 오리지널 프로시저럴 캐릭터/환경 (M1). 외부 자산 없음.<br><br>
  예정 자산 출처(추가 시 자동 표기): Characters/animations — Mixamo (Adobe) · Zombies — Sketchfab CC0/CC-BY · Environment — Poly Haven, Kenney, Quaternius (CC0).<br>
  자세한 목록: <code>public/assets/ASSETS.md</code>`);
}
function finish(result) {
  const st = state.stage, r = state.run; const clear = result === 'clear';
  let stars = 0; if (clear) { stars = 1; if (r.troops >= Math.max(20, r.peak * 0.3)) stars++; if (r.time <= st.par) stars++; }
  state.data.coins += r.coins; if (clear) { state.data.stars[st.n] = Math.max(state.data.stars[st.n] || 0, stars); state.data.unlocked = Math.max(state.data.unlocked, st.n + 1); }
  save(state.data);
  const hasNext = STAGES.some((s) => s.n === st.n + 1 && s.playable);
  clear ? (audio.sfxFanfare && audio.sfxFanfare()) : (audio.sfxFail && audio.sfxFail());
  hud.showResult({ clear, stars, troops: r.troops, peak: r.peak, kills: r.kills, time: r.time, coins: r.coins, hasNext },
    () => startStage(st.n + 1, state.character), () => startStage(st.n, state.character), showMenu);
  state.mode = 'result';
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.mode === 'play' && state.run) {
    const r = state.run;
    r.update(dt, input);
    hud.update(r.status());
    sun.target.position.set(r.laneX, 0, r.z - 10); sun.position.set(r.laneX + (state.stage.theme.time === 'sunset' ? -40 : 30), state.stage.theme.time === 'sunset' ? 25 : 60, r.z - 20);
    if (r.done) { state.mode = 'ending'; state.endT = 0; state.endKind = r.done; }
  } else if (state.mode === 'ending' && state.run) {
    state.endT += dt; state.run.update(dt * 0.35, input);   // 슬로모션 연출
    hud.update(state.run.status());
    if (state.endT > 1.3) finish(state.endKind);
  } else if (state.mode === 'result' && state.run) { state.run.zombies.update(dt, state.run.t); }
  fx.update(dt);
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
applyTheme(STAGES[0].theme);
showMenu();
requestAnimationFrame(frame);
window.__zs = { get run() { return state.run; }, state, startStage, STAGES, scene, camera, renderer };
