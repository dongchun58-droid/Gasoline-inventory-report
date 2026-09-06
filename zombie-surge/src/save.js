// save.js — localStorage 진행 저장(별·코인·해금·캐릭터)
const KEY = 'zombie_surge_save_v1';
const DEF = { unlocked: 1, stars: {}, coins: 0, character: 'cool', best: {} };
export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s ? { ...DEF, ...s } : { ...DEF }; }
  catch { return { ...DEF }; }
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode 등 */ } }
