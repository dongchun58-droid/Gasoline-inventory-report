// stages.js — 무기 티어 · 캐릭터 · 연속 방어전 스테이지 데이터
// 화력 차이를 '확실히': dps/연사/좌우 포착 폭(arc)/트레이서 굵기를 계단식으로 벌린다.
// arc = 각 열이 정면에서 좌우로 몇 m까지 표적을 잡는지. 무기를 올리면 화력뿐 아니라 '폭'이 넓어진다.
export const WEAPONS = {
  rifle:   { key: 'rifle',   name: 'RIFLE',   dps: 2.6,  rate: 9,  arc: 0.55, tracer: 0xfff0a0, w: 0.075, pellets: 1, flash: 0.7,  beam: false, gun: 0x4a5460, gunScale: 1.5 },
  smg:     { key: 'smg',     name: 'SMG',     dps: 5.0,  rate: 18, arc: 0.80, tracer: 0xffe070, w: 0.07,  pellets: 1, flash: 0.65, beam: false, gun: 0x8a5a2e, gunScale: 1.45 },
  shotgun: { key: 'shotgun', name: 'SHOTGUN', dps: 9.0,  rate: 5,  arc: 1.70, tracer: 0xffc040, w: 0.105, pellets: 5, flash: 1.5,  beam: false, gun: 0x2f6b4a, gunScale: 1.6 },
  minigun: { key: 'minigun', name: 'MINIGUN', dps: 16.0, rate: 34, arc: 1.35, tracer: 0xffd050, w: 0.10,  pellets: 1, flash: 1.1,  beam: false, gun: 0xb08a3a, gunScale: 1.7 },
  laser:   { key: 'laser',   name: 'LASER',   dps: 27.0, rate: 26, arc: 2.40, tracer: 0x7ff0ff, w: 0.13,  pellets: 1, flash: 1.3,  beam: true,  gun: 0xdfeff8, gunScale: 1.6 },
};
export const WEAPON_ORDER = ['rifle', 'smg', 'shotgun', 'minigun', 'laser'];

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

// 연속 방어전: 웨이브 구간 없이 쭉 내려온다.
//   quota      처치 목표(진행도 = kills / quota)
//   rate       초당 스폰 수 [시작 → 끝]
//   runnerFrom 이 진행도부터 러너가 섞인다
//   cardEvery  카드 문 간격(초) [시작 → 끝]
//   bosses     at(진행도)에서 내려오는 보스. 마지막(at:1)을 잡아야 클리어.
export const STAGES = [
  { n: 1, name: '도시 외곽 다리', phase: 'A', playable: true,
    theme: { sky: 0x8fc2ea, fog: 0xa9d0ea, sun: 0xfff2d0, deck: 0xb9b3a6, parapet: 0xd8d2c4, water: 0x0e4d92, hemi: 0xbfe6ff, ground: 0x3a5a7a, time: 'day' },
    startTroops: 12, cardSpeed: 17, plusRange: [5, 13],
    cards: { plus: 0.60, mul: 0.03, minus: 0.11, weapon: 0.16, shield: 0.10 },
    zombie: { hp: 11, speed: 4.4 },
    flow: { quota: 600, gateHp: 130, rate: [4.0, 28], runnerFrom: 0.30, tankFrom: 0.55, tankRate: 0.06, tankHp: 4.0, cardEvery: [4.4, 3.2],
            bosses: [ { at: 0.45, type: 'brute', name: 'BRUTE', hp: 520, speed: 3.4, slam: 3, aoe: 0.16, aoeEvery: 7.5 },
                      { at: 1.00, type: 'brute', name: 'BRUTE LORD', hp: 900, speed: 3.6, slam: 5, aoe: 0.22, aoeEvery: 6.5 } ] },
    par: 150 },
  { n: 2, name: '항만 · 노을', phase: 'A', playable: true,
    theme: { sky: 0xf0a060, fog: 0xe8a878, sun: 0xffc080, deck: 0x9a9088, parapet: 0x8a7a6a, water: 0x3a3a70, hemi: 0xffc9a0, ground: 0x4a3a3a, time: 'sunset' },
    startTroops: 20, cardSpeed: 18, plusRange: [6, 15],
    cards: { plus: 0.57, mul: 0.03, minus: 0.14, weapon: 0.16, shield: 0.10 },
    zombie: { hp: 15, speed: 4.8 },
    flow: { quota: 900, gateHp: 200, rate: [5.0, 38], runnerFrom: 0.20, tankFrom: 0.35, tankRate: 0.09, tankHp: 4.5, cardEvery: [4.2, 3.0],
            bosses: [ { at: 0.30, type: 'brute', name: 'BRUTE', hp: 620, speed: 3.6, slam: 4, aoe: 0.18, aoeEvery: 7 },
                      { at: 0.65, type: 'screamer', name: 'SCREAMER', hp: 780, speed: 4.0, slam: 4, aoe: 0.20, aoeEvery: 6.5, summon: { n: 6, every: 8 } },
                      { at: 1.00, type: 'screamer', name: 'SCREAMER ALPHA', hp: 1400, speed: 4.2, slam: 6, aoe: 0.26, aoeEvery: 5.5, summon: { n: 8, every: 7 } } ] },
    par: 210 },
  { n: 3, name: '고속도로 · 밤', phase: 'A', playable: true,
    theme: { sky: 0x0b1428, fog: 0x14203a, sun: 0x8fa8d8, deck: 0x4a4e56, parapet: 0x3d434c, water: 0x061225, hemi: 0x35507e, ground: 0x10182a, time: 'night' },
    startTroops: 28, cardSpeed: 19, plusRange: [7, 17],
    cards: { plus: 0.54, mul: 0.04, minus: 0.16, weapon: 0.16, shield: 0.10 },
    zombie: { hp: 13, speed: 5.2 },
    flow: { quota: 1200, gateHp: 170, rate: [4.2, 40], runnerFrom: 0.14, tankFrom: 0.22, tankRate: 0.13, tankHp: 5.0, cardEvery: [4.0, 2.8],
            bosses: [ { at: 0.24, type: 'brute', name: 'BRUTE', hp: 700, speed: 3.8, slam: 5, aoe: 0.18, aoeEvery: 6.8 },
                      { at: 0.52, type: 'screamer', name: 'SCREAMER', hp: 900, speed: 4.2, slam: 5, aoe: 0.22, aoeEvery: 6.2, summon: { n: 8, every: 7 } },
                      { at: 0.78, type: 'brute', name: 'ROAD CRUSHER', hp: 1200, speed: 4.0, slam: 7, aoe: 0.24, aoeEvery: 5.8 },
                      { at: 1.00, type: 'screamer', name: 'NIGHT ALPHA', hp: 1800, speed: 4.4, slam: 8, aoe: 0.28, aoeEvery: 5.2, summon: { n: 10, every: 6 } } ] },
    par: 260 },
  { n: 4, name: '붕괴 시가지', phase: 'A', playable: true,
    theme: { sky: 0x6b6152, fog: 0x8a7f6c, sun: 0xffd9a0, deck: 0x7d7468, parapet: 0x6a6155, water: 0x2e3630, hemi: 0xbfae90, ground: 0x4a4238, time: 'sunset' },
    startTroops: 34, cardSpeed: 20, plusRange: [8, 20],
    cards: { plus: 0.52, mul: 0.04, minus: 0.18, weapon: 0.16, shield: 0.10 },
    zombie: { hp: 14, speed: 5.6 },
    flow: { quota: 1600, gateHp: 210, rate: [4.6, 44], runnerFrom: 0.18, tankFrom: 0.30, tankRate: 0.13, tankHp: 5.0, cardEvery: [3.8, 2.6],
            bosses: [ { at: 0.20, type: 'brute', name: 'BRUTE', hp: 850, speed: 4.0, slam: 6, aoe: 0.20, aoeEvery: 6.5 },
                      { at: 0.42, type: 'screamer', name: 'SCREAMER', hp: 1100, speed: 4.4, slam: 6, aoe: 0.24, aoeEvery: 6.0, summon: { n: 10, every: 6.5 } },
                      { at: 0.64, type: 'brute', name: 'WRECKER', hp: 1400, speed: 4.2, slam: 8, aoe: 0.26, aoeEvery: 5.5 },
                      { at: 0.84, type: 'screamer', name: 'WAILER', hp: 1600, speed: 4.6, slam: 8, aoe: 0.28, aoeEvery: 5.2, summon: { n: 12, every: 6 } },
                      { at: 1.00, type: 'brute', name: 'CITY BREAKER', hp: 2600, speed: 4.4, slam: 11, aoe: 0.32, aoeEvery: 4.8 } ] },
    par: 320 },
  { n: 5, name: '폐쇄 공장', phase: 'B', playable: false },
  { n: 6, name: '병원 옥상', phase: 'B', playable: false },
  { n: 7, name: '지하철', phase: 'B', playable: false },
  { n: 8, name: '국도 컨보이', phase: 'C', playable: false },
  { n: 9, name: '산악 도로', phase: 'C', playable: false },
  { n: 10, name: '최종 방어선', phase: 'C', playable: false },
];
