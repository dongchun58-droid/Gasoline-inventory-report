// stages.js — 무기 티어 · 캐릭터 · 웨이브 방어 스테이지 데이터
// 화력 차이를 '확실히': dps/rate/스프레드/트레이서 굵기 모두 계단식으로 벌림.
export const WEAPONS = {
  rifle:   { key: 'rifle',   name: 'RIFLE',   dps: 0.85, rate: 9,  spread: 0.06, tracer: 0xfff0a0, w: 0.075, len: 5.5, pellets: 1, flash: 0.7,  beam: false, gun: 0x4a5460, gunScale: 1.5 },
  smg:     { key: 'smg',     name: 'SMG',     dps: 1.7,  rate: 18, spread: 0.13, tracer: 0xffe070, w: 0.07,  len: 4.2, pellets: 1, flash: 0.65, beam: false, gun: 0x8a5a2e, gunScale: 1.45 },
  shotgun: { key: 'shotgun', name: 'SHOTGUN', dps: 3.2,  rate: 5,  spread: 0.34, tracer: 0xffc040, w: 0.105, len: 3.4, pellets: 5, flash: 1.5,  beam: false, gun: 0x2f6b4a, gunScale: 1.6 },
  minigun: { key: 'minigun', name: 'MINIGUN', dps: 6.0,  rate: 34, spread: 0.16, tracer: 0xffd050, w: 0.10,  len: 6.5, pellets: 1, flash: 1.1,  beam: false, gun: 0xb08a3a, gunScale: 1.7 },
  laser:   { key: 'laser',   name: 'LASER',   dps: 10.5, rate: 26, spread: 0.02, tracer: 0x7ff0ff, w: 0.20,  len: 9.0, pellets: 1, flash: 1.3,  beam: true,  gun: 0xdfeff8, gunScale: 1.6 },
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

// 웨이브 방어: 각 스테이지는 웨이브 배열. cards=선택 카드 쌍 수, horde=몰려오는 좀비 수
const W = (cards, horde, type, opts = {}) => ({ cards, horde, type, ...opts });
export const STAGES = [
  { n: 1, name: '도시 외곽 다리', phase: 'A', playable: true,
    theme: { sky: 0x8fc2ea, fog: 0xa9d0ea, sun: 0xfff2d0, deck: 0xb9b3a6, parapet: 0xd8d2c4, water: 0x0e4d92, hemi: 0xbfe6ff, ground: 0x3a5a7a, time: 'day' },
    startTroops: 12, cardSpeed: 17, plusRange: [4, 11],
    cards: { plus: 0.60, mul: 0.05, minus: 0.11, weapon: 0.14, shield: 0.10 },
    zombie: { hp: 4, speed: 4.8 },
    waves: [ W(2, 12, 'walker'), W(2, 20, 'walker'), W(3, 30, 'mixed'), W(2, 42, 'runner'),
             W(3, 55, 'mixed'), W(2, 0, 'boss', { boss: { type: 'brute', name: 'BRUTE', hp: 900, speed: 2.4, slam: 3, aoe: 0.18, aoeEvery: 7.5, escort: 10 } }) ],
    par: 150 },
  { n: 2, name: '항만 · 노을', phase: 'A', playable: true,
    theme: { sky: 0xf0a060, fog: 0xe8a878, sun: 0xffc080, deck: 0x9a9088, parapet: 0x8a7a6a, water: 0x3a3a70, hemi: 0xffc9a0, ground: 0x4a3a3a, time: 'sunset' },
    startTroops: 14, cardSpeed: 19, plusRange: [5, 14],
    cards: { plus: 0.55, mul: 0.06, minus: 0.15, weapon: 0.14, shield: 0.10 },
    zombie: { hp: 6, speed: 5.4 },
    waves: [ W(2, 18, 'walker'), W(2, 30, 'runner'), W(3, 45, 'mixed'),
             W(2, 0, 'boss', { boss: { type: 'brute', name: 'BRUTE', hp: 700, speed: 2.6, slam: 3, aoe: 0.22, aoeEvery: 7, escort: 8 } }),
             W(3, 60, 'mixed'), W(2, 80, 'runner'), W(3, 95, 'mixed'),
             W(2, 0, 'boss', { boss: { type: 'screamer', name: 'SCREAMER', hp: 1600, speed: 2.8, slam: 4, aoe: 0.22, aoeEvery: 6.5, escort: 14, summon: { n: 7, every: 8 } } }) ],
    par: 210 },
  { n: 3, name: '고속도로 · 밤', phase: 'A', playable: false },
  { n: 4, name: '붕괴 시가지', phase: 'A', playable: false },
  { n: 5, name: '폐쇄 공장', phase: 'B', playable: false },
  { n: 6, name: '병원 옥상', phase: 'B', playable: false },
  { n: 7, name: '지하철', phase: 'B', playable: false },
  { n: 8, name: '국도 컨보이', phase: 'C', playable: false },
  { n: 9, name: '산악 도로', phase: 'C', playable: false },
  { n: 10, name: '최종 방어선', phase: 'C', playable: false },
];
