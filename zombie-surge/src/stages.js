// stages.js — 10단계 데이터. M1: 1·2단계 플레이 가능, 3~10은 잠금(메뉴 표시용)
// 좌표: 전진 = -z. length = 보스 전까지 주행 거리(유닛).
export const WEAPONS = {
  rifle:   { name: 'RIFLE',    dps: 0.7, range: 42, tracer: 0x8fd6ff, rate: 14 },
  smg:     { name: 'SMG',      dps: 1.0, range: 38, tracer: 0xbfffd0, rate: 22 },
  shotgun: { name: 'SHOTGUN',  dps: 1.4, range: 24, tracer: 0xffd27a, rate: 10 },
  laser:   { name: 'LASER',    dps: 2.2, range: 50, tracer: 0xff6fe0, rate: 30 },
};
export const WEAPON_ORDER = ['rifle', 'smg', 'shotgun', 'laser'];

export const STAGES = [
  { n: 1, name: '도시 외곽 다리', phase: 'A', playable: true,
    theme: { sky: 0x8fc2ea, fog: 0xa9d0ea, sun: 0xfff2d0, deck: 0xb9b3a6, parapet: 0xd8d2c4, water: 0x0e4d92, hemi: 0xbfe6ff, ground: 0x3a5a7a, time: 'day' },
    speed: 9, length: 520, startTroops: 10,
    cardGap: 34, cards: { plus: 0.62, mul: 0.04, minus: 0.12, weapon: 0.12, shield: 0.10 }, plusRange: [3, 10],
    gates: [ { at: 0.18, counts: [18, 26] }, { at: 0.42, counts: [36, 28] }, { at: 0.68, counts: [56, 72] }, { at: 0.88, counts: [90, 70] } ],
    packs: [ { at: 0.30, n: 10, type: 'walker' }, { at: 0.55, n: 16, type: 'walker' }, { at: 0.78, n: 14, type: 'runner' } ],
    miniBoss: null,
    boss: { type: 'brute', name: 'BRUTE', hp: 1000, speed: 2.2, slam: 4, aoe: 0.30, aoeEvery: 7 },
    zombie: { hp: 4, speed: 3.4 }, par: 110 },
  { n: 2, name: '항만 · 노을', phase: 'A', playable: true,
    theme: { sky: 0xf0a060, fog: 0xe8a878, sun: 0xffc080, deck: 0x9a9088, parapet: 0x8a7a6a, water: 0x3a3a70, hemi: 0xffc9a0, ground: 0x4a3a3a, time: 'sunset' },
    speed: 10, length: 640, startTroops: 12,
    cardGap: 30, cards: { plus: 0.52, mul: 0.05, minus: 0.17, weapon: 0.12, shield: 0.14 }, plusRange: [4, 13],
    gates: [ { at: 0.15, counts: [26, 36] }, { at: 0.35, counts: [54, 40] }, { at: 0.55, counts: [80, 100] }, { at: 0.75, counts: [110, 90] }, { at: 0.9, counts: [130, 150] } ],
    packs: [ { at: 0.25, n: 10, type: 'runner' }, { at: 0.45, n: 14, type: 'walker' }, { at: 0.65, n: 12, type: 'runner' }, { at: 0.83, n: 16, type: 'walker' } ],
    miniBoss: { at: 0.5, type: 'brute', name: 'BRUTE', hp: 450, speed: 2.4, slam: 3, aoe: 0.25, aoeEvery: 8 },
    boss: { type: 'screamer', name: 'SCREAMER', hp: 1400, speed: 2.6, slam: 5, aoe: 0.35, aoeEvery: 6, summon: { n: 6, every: 9 } },
    zombie: { hp: 5, speed: 3.8 }, par: 140 },
  { n: 3, name: '고속도로 · 밤', phase: 'A', playable: false },
  { n: 4, name: '붕괴 시가지', phase: 'A', playable: false },
  { n: 5, name: '폐쇄 공장', phase: 'B', playable: false },
  { n: 6, name: '병원 옥상', phase: 'B', playable: false },
  { n: 7, name: '지하철', phase: 'B', playable: false },
  { n: 8, name: '국도 컨보이', phase: 'C', playable: false },
  { n: 9, name: '산악 도로', phase: 'C', playable: false },
  { n: 10, name: '최종 방어선', phase: 'C', playable: false },
];

export const CHARACTERS = {
  cool:     { name: 'COOL GUY',  role: '돌격 대장',  skin: 0xe8b894, cloth: 0x5b6b4e, vest: 0x2f3630, hair: 0x2a1c12, bonus: { dps: 1.0, troops: 0, speed: 1.15 } },
  hulk:     { name: 'SMASHER',   role: '중화기 사수', skin: 0xd9a888, cloth: 0x556444, vest: 0x2a3326, hair: 0x101010, bonus: { dps: 1.15, troops: 0, speed: 1.0 } },
  princess: { name: 'PRINCESS',  role: '저격/의무병', skin: 0xf2cdb4, cloth: 0x6a6270, vest: 0x3a3244, hair: 0xe8c060, bonus: { dps: 1.0, troops: 4, speed: 1.0 } },
  bearded:  { name: 'BIG BOSS',  role: '폭파 전문',  skin: 0xdcb08c, cloth: 0x7a6a50, vest: 0x3a2e22, hair: 0x4a3020, bonus: { dps: 1.05, troops: 2, speed: 1.0 } },
};
export const CHARACTER_ORDER = ['cool', 'hulk', 'princess', 'bearded'];
