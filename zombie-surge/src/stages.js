// stages.js — 무기 티어 · 캐릭터 · 연속 방어전 스테이지 데이터
// 무기는 12티어. 한 스테이지에서 끝까지 올라가지 못하도록 스테이지마다
// 시작 티어(wpnStart)와 상한(wpnMax)을 둔다 — 레이저는 후반 스테이지에서만 나온다.
// arc = 각 열이 정면에서 좌우로 몇 m까지 표적을 잡는지(무기가 좋아지면 폭도 넓어진다).
const W = (key, name, dps, rate, arc, tracer, w, pellets, flash, gun, gunScale, beam) =>
  ({ key, name, dps, rate, arc, tracer, w, pellets, flash, gun, gunScale, beam: !!beam });
export const WEAPONS = {
  pistol:   W('pistol',   'PISTOL',    2.6,  6,  0.42, 0xfff4c0, 0.060, 1, 0.5,  0x6a7280, 1.35),
  rifle:    W('rifle',    'RIFLE',     3.8,  9,  0.55, 0xfff0a0, 0.075, 1, 0.7,  0x4a5460, 1.50),
  arifle:   W('arifle',   'AUTO RIFLE',5.4, 13,  0.62, 0xffe8a0, 0.080, 1, 0.8,  0x3f5a54, 1.55),
  smg:      W('smg',      'SMG',       7.6, 18,  0.80, 0xffe070, 0.075, 1, 0.7,  0x8a5a2e, 1.45),
  hsmg:     W('hsmg',     'HEAVY SMG', 10.5, 22,  0.92, 0xffd860, 0.085, 1, 0.9,  0x9c6a24, 1.60),
  shotgun:  W('shotgun',  'SHOTGUN',  14.0,  5,  1.70, 0xffc040, 0.105, 5, 1.5,  0x2f6b4a, 1.60),
  ashotgun: W('ashotgun', 'AUTO SHOT',18.5,  9,  1.85, 0xffb030, 0.115, 6, 1.7,  0x276b3a, 1.75),
  minigun:  W('minigun',  'MINIGUN',  24.0, 34,  1.35, 0xffd050, 0.100, 1, 1.1,  0xb08a3a, 1.70),
  hminigun: W('hminigun', 'HVY MINI', 31.0, 40,  1.55, 0xffdc70, 0.110, 2, 1.3,  0xc79a3e, 1.90),
  laser1:   W('laser1',   'LASER I',  39.0, 26,  2.10, 0x7ff0ff, 0.120, 1, 1.2,  0xdfeff8, 1.60, true),
  laser2:   W('laser2',   'LASER II', 48.0, 30,  2.45, 0x9ff8ff, 0.140, 1, 1.4,  0xeaf6ff, 1.80, true),
  plasma:   W('plasma',   'PLASMA',   58.0, 34,  2.90, 0xc8a0ff, 0.170, 1, 1.7,  0xd8c4ff, 2.00, true),
};
export const WEAPON_ORDER = ['pistol', 'rifle', 'arifle', 'smg', 'hsmg', 'shotgun', 'ashotgun', 'minigun', 'hminigun', 'laser1', 'laser2', 'plasma'];

// 화려하고 귀여운 영웅 4인 (밝은 원색 + 금색 포인트)
export const CHARACTERS = {
  cool:     { name: 'COOL GUY', role: '돌격 대장', skin: 0xf0c9a0, cloth: 0x2f6fd0, trim: 0xffd23f, hair: 0x3a2415, acc: 'shades',
              bonus: { dps: 1.0, troops: 0 }, desc: '균형형 · 안정적인 화력' },
  hulk:     { name: 'SMASHER',  role: '중화기 사수', skin: 0x8fd06a, cloth: 0x2fae72, trim: 0xffd23f, hair: 0x184a24, acc: 'band',
              bonus: { dps: 1.18, troops: -2 }, desc: '화력 +18% · 시작 병력 −2' },
  princess: { name: 'PRINCESS', role: '저격/의무병', skin: 0xffd9c0, cloth: 0xf05fa0, trim: 0xfff0a0, hair: 0xffd24a, acc: 'tiara',
              bonus: { dps: 0.95, troops: 6 }, desc: '시작 병력 +6 · 화력 −5%' },
  bearded:  { name: 'BIG BOSS', role: '폭파 전문', skin: 0xe8b98c, cloth: 0xd06a2f, trim: 0xffd23f, hair: 0x5a3a1e, acc: 'beard',
              bonus: { dps: 1.08, troops: 2 }, desc: '화력 +8% · 병력 +2' },
};
export const CHARACTER_ORDER = ['cool', 'hulk', 'princess', 'bearded'];
export const TROOP_CAP = 260;

// 보스: kind = 실루엣, weapon = 손에 든 것, scale = 덩치(뒤로 갈수록 커진다)
const B = (at, kind, weapon, name, hp, scale, o = {}) =>
  ({ at, kind, weapon, name, hp, scale, speed: o.speed || 3.8, slam: o.slam || 5,
     aoe: o.aoe || 0.20, aoeEvery: o.aoeEvery || 6.5, summon: o.summon });

export const STAGES = [
  { n: 1, name: '도시 외곽 다리', phase: 'A', playable: true,
    theme: { sky: 0x8fc2ea, fog: 0xa9d0ea, sun: 0xfff2d0, deck: 0xb9b3a6, parapet: 0xd8d2c4, water: 0x0e4d92, hemi: 0xbfe6ff, ground: 0x3a5a7a, time: 'day' },
    startTroops: 12, cardSpeed: 17, plusRange: [2, 4], wpnStart: 0, wpnMax: 2,
    cards: { plus: 0.60, mul: 0.05, minus: 0.10, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 5, speed: 4.4 },
    flow: { quota: 480, gateHp: 90, rate: [3.0, 11], runnerFrom: 0.30, tankFrom: 0.55, tankRate: 0.06, tankHp: 4.0, cardEvery: [2.31, 1.65],
            bosses: [ B(0.45, 'brute', 'none', 'BRUTE', 520, 1.00, { speed: 3.4, slam: 3, aoe: 0.16, aoeEvery: 7.5 }),
                      B(1.00, 'brute', 'maul', 'BRUTE LORD', 900, 1.15, { speed: 3.6, slam: 5, aoe: 0.22, aoeEvery: 6.5 }) ] },
    par: 150 },

  { n: 2, name: '항만 · 노을', phase: 'A', playable: true,
    theme: { sky: 0xf0a060, fog: 0xe8a878, sun: 0xffc080, deck: 0x9a9088, parapet: 0x8a7a6a, water: 0x3a3a70, hemi: 0xffc9a0, ground: 0x4a3a3a, time: 'sunset' },
    startTroops: 20, cardSpeed: 18, plusRange: [2, 5], wpnStart: 1, wpnMax: 3,
    cards: { plus: 0.58, mul: 0.05, minus: 0.12, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 7, speed: 4.8 },
    flow: { quota: 900, gateHp: 200, rate: [3.6, 13], runnerFrom: 0.20, tankFrom: 0.35, tankRate: 0.09, tankHp: 4.5, cardEvery: [2.20, 1.59],
            bosses: [ B(0.30, 'brute', 'none', 'BRUTE', 620, 1.05, { speed: 3.6, slam: 4, aoe: 0.18, aoeEvery: 7 }),
                      B(0.65, 'screamer', 'none', 'SCREAMER', 780, 1.05, { speed: 4.0, slam: 4, aoe: 0.20, aoeEvery: 6.5, summon: { n: 6, every: 8 } }),
                      B(1.00, 'butcher', 'axe', 'DOCK BUTCHER', 1400, 1.25, { speed: 3.8, slam: 6, aoe: 0.26, aoeEvery: 5.5 }) ] },
    par: 210 },

  { n: 3, name: '고속도로 · 밤', phase: 'A', playable: true,
    theme: { sky: 0x0b1428, fog: 0x14203a, sun: 0x8fa8d8, deck: 0x4a4e56, parapet: 0x3d434c, water: 0x061225, hemi: 0x35507e, ground: 0x10182a, time: 'night' },
    startTroops: 28, cardSpeed: 19, plusRange: [3, 6], wpnStart: 2, wpnMax: 5,
    cards: { plus: 0.56, mul: 0.05, minus: 0.14, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 6, speed: 5.2 },
    flow: { quota: 1200, gateHp: 170, rate: [4.6, 20], runnerFrom: 0.14, tankFrom: 0.22, tankRate: 0.13, tankHp: 5.0, cardEvery: [2.15, 1.49],
            bosses: [ B(0.24, 'brute', 'none', 'BRUTE', 700, 1.05, { speed: 3.8, slam: 5, aoe: 0.18, aoeEvery: 6.8 }),
                      B(0.52, 'screamer', 'none', 'SCREAMER', 900, 1.10, { speed: 4.2, slam: 5, aoe: 0.22, aoeEvery: 6.2, summon: { n: 8, every: 7 } }),
                      B(0.78, 'butcher', 'axe', 'ROAD CRUSHER', 1200, 1.25, { speed: 4.0, slam: 7, aoe: 0.24, aoeEvery: 5.8 }),
                      B(1.00, 'reaper', 'twin', 'NIGHT ALPHA', 1800, 1.30, { speed: 4.6, slam: 8, aoe: 0.28, aoeEvery: 5.2, summon: { n: 10, every: 6 } }) ] },
    par: 260 },

  { n: 4, name: '붕괴 시가지', phase: 'A', playable: true,
    theme: { sky: 0x6b6152, fog: 0x8a7f6c, sun: 0xffd9a0, deck: 0x7d7468, parapet: 0x6a6155, water: 0x2e3630, hemi: 0xbfae90, ground: 0x4a4238, time: 'sunset' },
    startTroops: 34, cardSpeed: 20, plusRange: [3, 7], wpnStart: 3, wpnMax: 6,
    cards: { plus: 0.54, mul: 0.05, minus: 0.16, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 6, speed: 5.6 },
    flow: { quota: 1600, gateHp: 210, rate: [5.4, 24], runnerFrom: 0.18, tankFrom: 0.30, tankRate: 0.13, tankHp: 5.0, cardEvery: [2.04, 1.43],
            bosses: [ B(0.20, 'brute', 'none', 'BRUTE', 850, 1.10, { speed: 4.0, slam: 6, aoe: 0.20, aoeEvery: 6.5 }),
                      B(0.42, 'screamer', 'none', 'SCREAMER', 1100, 1.15, { speed: 4.4, slam: 6, aoe: 0.24, aoeEvery: 6.0, summon: { n: 10, every: 6.5 } }),
                      B(0.64, 'butcher', 'axe', 'WRECKER', 1400, 1.30, { speed: 4.2, slam: 8, aoe: 0.26, aoeEvery: 5.5 }),
                      B(0.84, 'reaper', 'twin', 'WAILER', 1600, 1.30, { speed: 4.6, slam: 8, aoe: 0.28, aoeEvery: 5.2, summon: { n: 12, every: 6 } }),
                      B(1.00, 'warlord', 'cleaver', 'CITY BREAKER', 2600, 1.50, { speed: 4.4, slam: 11, aoe: 0.32, aoeEvery: 4.8 }) ] },
    par: 320 },

  // ── Phase B: 측면에서도 밀고 들어온다 ──────────────────────────────────
  { n: 5, name: '폐쇄 공장', phase: 'B', playable: true, flank: 0.22,
    theme: { sky: 0x3a4450, fog: 0x515c68, sun: 0xd8dce4, deck: 0x6e6a64, parapet: 0x585d64, water: 0x22282c, hemi: 0x7f8f9e, ground: 0x33383c, time: 'day' },
    startTroops: 40, cardSpeed: 21, plusRange: [4, 8], wpnStart: 4, wpnMax: 7,
    cards: { plus: 0.53, mul: 0.05, minus: 0.17, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 7, speed: 5.8 },
    flow: { quota: 2000, gateHp: 260, rate: [6.0, 28], runnerFrom: 0.14, tankFrom: 0.22, tankRate: 0.15, tankHp: 5.2, cardEvery: [1.98, 1.38],
            bosses: [ B(0.18, 'butcher', 'axe', 'FOREMAN', 1100, 1.20, { speed: 4.2, slam: 7, aoe: 0.22, aoeEvery: 6.2 }),
                      B(0.38, 'screamer', 'none', 'SCREAMER', 1300, 1.20, { speed: 4.6, slam: 7, aoe: 0.24, aoeEvery: 5.8, summon: { n: 12, every: 6 } }),
                      B(0.58, 'reaper', 'twin', 'SLICER', 1600, 1.35, { speed: 5.0, slam: 8, aoe: 0.26, aoeEvery: 5.4 }),
                      B(0.80, 'brute', 'maul', 'PRESS', 2000, 1.45, { speed: 4.4, slam: 10, aoe: 0.30, aoeEvery: 5.0 }),
                      B(1.00, 'warlord', 'cleaver', 'FURNACE KING', 3200, 1.60, { speed: 4.6, slam: 12, aoe: 0.32, aoeEvery: 4.6 }) ] },
    par: 360 },

  { n: 6, name: '병원 옥상', phase: 'B', playable: true, flank: 0.30,
    theme: { sky: 0x1a2438, fog: 0x2b3850, sun: 0x9fb4d8, deck: 0x8e9298, parapet: 0x767c84, water: 0x0d1524, hemi: 0x46608c, ground: 0x1c2432, time: 'night' },
    startTroops: 46, cardSpeed: 22, plusRange: [4, 9], wpnStart: 5, wpnMax: 8,
    cards: { plus: 0.52, mul: 0.05, minus: 0.18, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 8, speed: 6.0 },
    flow: { quota: 2400, gateHp: 300, rate: [6.8, 33], runnerFrom: 0.12, tankFrom: 0.20, tankRate: 0.16, tankHp: 5.4, cardEvery: [1.93, 1.32],
            bosses: [ B(0.16, 'reaper', 'twin', 'SURGEON', 1300, 1.25, { speed: 5.0, slam: 7, aoe: 0.22, aoeEvery: 6.0 }),
                      B(0.34, 'butcher', 'axe', 'ORDERLY', 1600, 1.30, { speed: 4.6, slam: 8, aoe: 0.26, aoeEvery: 5.6 }),
                      B(0.54, 'screamer', 'none', 'WARD WAILER', 1900, 1.30, { speed: 5.0, slam: 8, aoe: 0.28, aoeEvery: 5.2, summon: { n: 14, every: 5.5 } }),
                      B(0.76, 'warlord', 'cleaver', 'MATRON', 2400, 1.50, { speed: 4.8, slam: 11, aoe: 0.30, aoeEvery: 4.8 }),
                      B(1.00, 'warlord', 'maul', 'ROOFTOP TYRANT', 3800, 1.70, { speed: 5.0, slam: 13, aoe: 0.34, aoeEvery: 4.4, summon: { n: 10, every: 7 } }) ] },
    par: 400 },

  { n: 7, name: '지하철', phase: 'B', playable: true, flank: 0.36,
    theme: { sky: 0x14100e, fog: 0x241c18, sun: 0xffcf90, deck: 0x565049, parapet: 0x413b35, water: 0x0a0806, hemi: 0x5a4636, ground: 0x1a1512, time: 'night' },
    startTroops: 52, cardSpeed: 23, plusRange: [5, 10], wpnStart: 6, wpnMax: 9,
    cards: { plus: 0.51, mul: 0.05, minus: 0.19, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 9, speed: 6.3 },
    flow: { quota: 2800, gateHp: 340, rate: [7.6, 38], runnerFrom: 0.10, tankFrom: 0.18, tankRate: 0.18, tankHp: 5.6, cardEvery: [1.87, 1.26],
            bosses: [ B(0.15, 'butcher', 'axe', 'TUNNEL BUTCHER', 1600, 1.30, { speed: 4.8, slam: 8, aoe: 0.24, aoeEvery: 5.8 }),
                      B(0.32, 'reaper', 'twin', 'THIRD RAIL', 1900, 1.35, { speed: 5.4, slam: 9, aoe: 0.26, aoeEvery: 5.4 }),
                      B(0.50, 'screamer', 'none', 'SHRIEKER', 2200, 1.35, { speed: 5.2, slam: 9, aoe: 0.28, aoeEvery: 5.0, summon: { n: 16, every: 5 } }),
                      B(0.72, 'warlord', 'cleaver', 'CONDUCTOR', 2800, 1.55, { speed: 5.0, slam: 12, aoe: 0.32, aoeEvery: 4.6 }),
                      B(1.00, 'warlord', 'maul', 'DEEP TYRANT', 4400, 1.80, { speed: 5.2, slam: 14, aoe: 0.34, aoeEvery: 4.2, summon: { n: 12, every: 6.5 } }) ] },
    par: 440 },

  // ── Phase C: 장갑차(APC)가 함께 싸운다 ─────────────────────────────────
  { n: 8, name: '국도 컨보이', phase: 'C', playable: true, flank: 0.26, apc: { dps: 26, arc: 2.4, off: 5.6 },
    theme: { sky: 0x7d92a8, fog: 0x8fa2b4, sun: 0xffe6c0, deck: 0x8a8378, parapet: 0x736c62, water: 0x35414a, hemi: 0xa8bccc, ground: 0x4a4a44, time: 'day' },
    startTroops: 58, cardSpeed: 24, plusRange: [5, 11], wpnStart: 7, wpnMax: 10,
    cards: { plus: 0.50, mul: 0.05, minus: 0.20, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 10, speed: 6.4 },
    flow: { quota: 3200, gateHp: 380, rate: [8.4, 44], runnerFrom: 0.10, tankFrom: 0.16, tankRate: 0.19, tankHp: 5.8, cardEvery: [1.81, 1.21],
            bosses: [ B(0.14, 'reaper', 'twin', 'HIGHWAY REAPER', 1900, 1.35, { speed: 5.4, slam: 9, aoe: 0.24, aoeEvery: 5.6 }),
                      B(0.30, 'butcher', 'axe', 'ROADBREAKER', 2300, 1.40, { speed: 5.0, slam: 10, aoe: 0.26, aoeEvery: 5.2 }),
                      B(0.48, 'screamer', 'none', 'CONVOY WAILER', 2600, 1.40, { speed: 5.4, slam: 10, aoe: 0.28, aoeEvery: 5.0, summon: { n: 18, every: 5 } }),
                      B(0.70, 'warlord', 'cleaver', 'IRON WARLORD', 3400, 1.65, { speed: 5.2, slam: 13, aoe: 0.32, aoeEvery: 4.6 }),
                      B(1.00, 'warlord', 'maul', 'CONVOY TYRANT', 5200, 1.90, { speed: 5.4, slam: 15, aoe: 0.36, aoeEvery: 4.2, summon: { n: 14, every: 6 } }) ] },
    par: 480 },

  { n: 9, name: '산악 도로', phase: 'C', playable: true, flank: 0.32, apc: { dps: 38, arc: 2.7, off: 5.8 },
    theme: { sky: 0x2c3a4a, fog: 0x40525f, sun: 0xd0dcea, deck: 0x6f6a60, parapet: 0x5a554d, water: 0x1d2a30, hemi: 0x6d8898, ground: 0x2b3630, time: 'sunset' },
    startTroops: 64, cardSpeed: 25, plusRange: [6, 12], wpnStart: 8, wpnMax: 11,
    cards: { plus: 0.49, mul: 0.05, minus: 0.21, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 11, speed: 6.6 },
    flow: { quota: 3600, gateHp: 420, rate: [9.2, 50], runnerFrom: 0.08, tankFrom: 0.14, tankRate: 0.21, tankHp: 6.0, cardEvery: [1.76, 1.16],
            bosses: [ B(0.13, 'butcher', 'axe', 'RIDGE BUTCHER', 2200, 1.40, { speed: 5.2, slam: 10, aoe: 0.24, aoeEvery: 5.4 }),
                      B(0.28, 'reaper', 'twin', 'SWITCHBACK', 2600, 1.45, { speed: 5.8, slam: 11, aoe: 0.26, aoeEvery: 5.0 }),
                      B(0.46, 'screamer', 'none', 'PEAK SHRIEKER', 3000, 1.45, { speed: 5.6, slam: 11, aoe: 0.30, aoeEvery: 4.8, summon: { n: 20, every: 4.8 } }),
                      B(0.68, 'warlord', 'cleaver', 'STONE WARLORD', 3900, 1.70, { speed: 5.4, slam: 14, aoe: 0.34, aoeEvery: 4.4 }),
                      B(1.00, 'warlord', 'maul', 'MOUNTAIN TYRANT', 6200, 2.05, { speed: 5.6, slam: 17, aoe: 0.38, aoeEvery: 4.0, summon: { n: 16, every: 5.5 } }) ] },
    par: 520 },

  { n: 10, name: '최종 방어선', phase: 'C', playable: true, flank: 0.40, apc: { dps: 55, arc: 3.0, off: 6.0 },
    theme: { sky: 0x2a1420, fog: 0x4a2430, sun: 0xffa070, deck: 0x6b6058, parapet: 0x554b45, water: 0x24101a, hemi: 0x8a4a50, ground: 0x2e1a20, time: 'sunset' },
    startTroops: 72, cardSpeed: 26, plusRange: [6, 14], wpnStart: 9, wpnMax: 11,
    cards: { plus: 0.48, mul: 0.06, minus: 0.21, weapon: 0.15, shield: 0.10 },
    zombie: { hp: 12, speed: 6.8 },
    flow: { quota: 4200, gateHp: 460, rate: [10.0, 54], runnerFrom: 0.06, tankFrom: 0.12, tankRate: 0.23, tankHp: 6.2, cardEvery: [1.71, 1.10],
            bosses: [ B(0.12, 'butcher', 'axe', 'GATE BUTCHER', 2600, 1.45, { speed: 5.4, slam: 11, aoe: 0.24, aoeEvery: 5.2 }),
                      B(0.26, 'reaper', 'twin', 'BLADE REAPER', 3000, 1.50, { speed: 6.0, slam: 12, aoe: 0.26, aoeEvery: 4.9 }),
                      B(0.42, 'screamer', 'none', 'LAST WAILER', 3400, 1.50, { speed: 5.8, slam: 12, aoe: 0.30, aoeEvery: 4.7, summon: { n: 22, every: 4.5 } }),
                      B(0.60, 'brute', 'maul', 'WALL BREAKER', 4000, 1.75, { speed: 5.6, slam: 15, aoe: 0.34, aoeEvery: 4.4 }),
                      B(0.80, 'warlord', 'cleaver', 'IRON TYRANT', 5000, 1.90, { speed: 5.6, slam: 16, aoe: 0.36, aoeEvery: 4.2 }),
                      B(1.00, 'warlord', 'maul', '좀비 로드', 9000, 2.40, { speed: 5.2, slam: 20, aoe: 0.40, aoeEvery: 3.8, summon: { n: 24, every: 4.5 } }) ] },
    par: 600 },
];
