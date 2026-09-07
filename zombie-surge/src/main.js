// main.js — ZOMBIE SURGE 엔트리: 렌더러·조명·상태 머신(menu → wave defense → result)
import * as THREE from 'three';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { FX } from './fx.js';
import { WaveDefense } from './wave.js';
import { FieldRun } from './field.js';
import { STAGES, CHARACTER_ORDER } from './stages.js';
import { renderPortraits } from './squad.js';
import { buildBoss } from './zombies.js';
import { load, save } from './save.js';
import { GameAudio } from './audio.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 6.6, 10.5);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.3); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -40; sun.shadow.bias = -0.0008;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x3a5a7a, 1.05); scene.add(hemi);
scene.add(new THREE.AmbientLight(0xffffff, 0.26));
const fx = new FX(); scene.add(fx.group);
const hud = new HUD();
const input = new Input(renderer.domElement, document.getElementById('fireBtn'));
const audio = new GameAudio();
input.onFirstInput(() => { audio.start(); audio.setScene(state.mode === 'play' ? 'wave' : 'menu'); });
const state = { mode: 'menu', run: null, stage: null, character: 'cool', data: load() };
const portraits = renderPortraits(CHARACTER_ORDER);

document.getElementById('muteBtn').onclick = () => {
  audio.start(); audio.muted = !audio.muted; audio.setMuted(audio.muted);
  document.getElementById('muteBtn').textContent = audio.muted ? '🔈' : '🔊';
};
function applyTheme(t) {
  scene.background = new THREE.Color(t.sky); scene.fog = new THREE.Fog(t.fog, t.time === 'night' ? 70 : 95, t.time === 'night' ? 240 : 320);
  sun.color.setHex(t.sun); sun.intensity = t.time === 'night' ? 0.85 : t.time === 'sunset' ? 1.9 : 2.3;
  sun.position.set(t.time === 'sunset' ? -40 : 30, t.time === 'sunset' ? 24 : 55, -18);
  renderer.toneMappingExposure = t.time === 'night' ? 1.25 : 1.08;
  hemi.color.setHex(t.hemi); hemi.groundColor.setHex(t.ground);
}
function launch(n, character) {
  const st = STAGES.find((s) => s.n === n); if (!st || !st.playable) return;
  if (state.run) state.run.dispose();
  state.stage = st; state.character = character; state.data.character = character; save(state.data);
  applyTheme(st.theme);
  state.run = st.field ? new FieldRun(scene, camera, st, character, fx, audio)
                       : new WaveDefense(scene, camera, st, character, fx, audio);
  hud.hideMenu(); hud.hideResult(); hud.setStage(st); hud.setHero(character, portraits);
  audio.start(); audio.setScene('wave');
  state.mode = 'play';
}
function startStage(n, character) {
  if (!state.data.seenTut) { hud.showTutorial(() => { state.data.seenTut = true; save(state.data); launch(n, character); }); }
  else launch(n, character);
}
function showMenu() { state.mode = 'menu'; hud.hideResult(); audio.setScene('menu');
  hud.buildMenu(state.data, portraits, startStage, showCredits, () => hud.showTutorial(null)); }
function showCredits() {
  hud.showCredits(`<b>ZOMBIE SURGE</b> — 캐릭터·좀비·보스·환경 모두 오리지널 프로시저럴 생성(외부 모델 없음).<br>
  사운드: 실시간 합성(레이어드 총성 + 컨볼루션 리버브 + 전쟁 타악 루프).<br><br>
  추후 Tier-2 실사 모델 도입 시 출처 표기: Characters/animations — Mixamo (Adobe) · Zombies — Sketchfab CC0/CC-BY · Environment — Poly Haven, Kenney, Quaternius (CC0).<br>
  전체 목록: <code>public/assets/ASSETS.md</code>`);
}
function finish(kind) {
  const st = state.stage, r = state.run, clear = kind === 'clear';
  let stars = 0; if (clear) { stars = 1; if (r.troops >= Math.max(15, r.peak * 0.35)) stars++; if (r.time <= st.par) stars++; }
  state.data.coins += r.coins;
  if (clear) { state.data.stars[st.n] = Math.max(state.data.stars[st.n] || 0, stars); state.data.unlocked = Math.max(state.data.unlocked, st.n + 1); }
  save(state.data);
  const hasNext = STAGES.some((s) => s.n === st.n + 1 && s.playable);
  audio.setScene('result'); clear ? audio.clear() : audio.fail();
  hud.showResult({ clear, stars, troops: r.troops, peak: r.peak, kills: r.kills, time: r.time, coins: r.coins, hasNext },
    () => startStage(st.n + 1, state.character), () => startStage(st.n, state.character), showMenu);
  state.mode = 'result';
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const r = state.run;
  if (state.mode === 'play' && r) {
    r.update(dt, input);
    hud.update(r.status());
    const rz = r.z || 0;
    sun.target.position.set(r.x, 0, rz - 20); sun.position.set(r.x + (state.stage.theme.time === 'sunset' ? -40 : 30), state.stage.theme.time === 'sunset' ? 24 : 55, rz - 38);
    if (r.status().boss) audio.setScene('boss');
    if (r.done) { state.mode = 'ending'; state.endT = 0; state.endKind = r.done; }
  } else if (state.mode === 'ending' && r) {
    state.endT += dt; r.update(dt * 0.35, { steer: null, steerZ: null, axis: 0, axisZ: 0, fire: false, consumeForm: () => false });
    hud.update(r.status());
    if (state.endT > 1.4) finish(state.endKind);
  } else if (state.mode === 'result' && r) { r.zombies.update(dt, r.t); }
  fx.update(dt, camera);
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
applyTheme(STAGES[0].theme);
showMenu();
requestAnimationFrame(frame);
window.__zs = { get run() { return state.run; }, state, startStage: launch, STAGES, scene, camera, renderer, input, audio, fx, hud, portraits, THREE, buildBoss };
