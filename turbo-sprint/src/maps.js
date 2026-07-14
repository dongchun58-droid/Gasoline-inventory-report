// maps.js — 맵(테마) 정의: 트랙 레이아웃 + 배경 클래스 + 조명/하늘/도로 색
import { Scenery } from './scenery.js';
import { CastleScenery } from './castle.js';

export const MAP_ORDER = ['meadow', 'castle'];

export const MAPS = {
  // ☀️ 초원 서킷 (기존 맵)
  meadow: {
    key: 'meadow',
    name: 'SUNNY CIRCUIT',
    desc: '초록 들판의 상쾌한 코스',
    swatch: ['#57cf42', '#8fd6ff', '#ff8fc0'],
    Scenery,
    scale: 2.9,
    variableWidth: true,
    controlPoints: [
      [0, 0, 0], [55, 0, -4], [100, 0, -28],
      [112, 0, -78], [88, 0, -112],
      [42, 0, -104], [18, 0, -72], [-28, 0, -64],
      [-72, 0, -30], [-78, 0, 18],
      [-38, 0, 52], [-8, 0, 24],
    ],
    obstacle: 'cow',
    pad: { boost: 0x18d6ff, chevron: '#eaffff', jump: '#ff9a2e', jumpHex: 0xff9a2e, jumpEdge: 0xffd23f },
    road: { asphalt: '#2A2440', center: '#00E5FF', curbA: '#FF3355', curbB: '#dfe4ea', median1: 0xffd23f, median2: 0x2a2a32 },
    sky: { stops: [[0, '#1560D8'], [0.42, '#3D9BFF'], [0.72, '#8FD6FF'], [0.9, '#CFF0FF'], [1, '#F2FCFF']], sun: 0xfff6d0, sunPos: [-180, 190, -430] },
    env: [[0, '#1E6FE0'], [0.5, '#8fd0ff'], [0.6, '#eaf9ff'], [0.61, '#6fc45a'], [1, '#3f8e3a']],
    fog: { color: 0xd8f2ff, near: 320, far: 1000 },
    sun: { color: 0xfff2d0, intensity: 2.4, dir: [0.5, 0.95, 0.35] },
    hemi: { sky: 0xbfe6ff, ground: 0x7fd06a, intensity: 1.15 },
    ambient: 0.2,
    bloom: 0.32,
    bloomThreshold: 0.92, // 확산 흰색(눈·구름·잔디)은 번지지 않도록 높임
    exposure: 1.08,
  },

  // 🌋 마왕 성 (신규 맵) — '쿠파 성' 계열에서 영감, 오리지널
  castle: {
    key: 'castle',
    name: 'INFERNO CASTLE',
    desc: '용암과 쇠사슬의 마왕 성',
    swatch: ['#ff5a1e', '#3a1416', '#701018'],
    Scenery: CastleScenery,
    scale: 2.7,
    variableWidth: false, // 좁고 일정한 폭(용암 위 다리) — 긴장감
    controlPoints: [
      [116, 0, 0], [100, 0, 42], [66, 0, 78], [24, 0, 96],
      [-26, 0, 88], [-70, 0, 68], [-100, 0, 40], [-112, 0, 0],
      [-92, 0, -44], [-52, 0, -70], [-10, 0, -86], [40, 0, -82],
      [84, 0, -56], [110, 0, -24],
    ],
    obstacle: 'fireball',
    pad: { boost: 0xff7a1e, chevron: '#ffd8a0', jump: '#ff4a2a', jumpHex: 0xff4a2a, jumpEdge: 0xffb02a },
    road: { asphalt: '#231a20', center: '#ff6a2a', curbA: '#ff3311', curbB: '#160c10', median1: 0x5a3020, median2: 0x1a0e0c },
    sky: { stops: [[0, '#120609'], [0.45, '#3a0d12'], [0.72, '#701d18'], [0.88, '#a83a1e'], [1, '#d66a2a']], sun: 0xff7b30, sunPos: [-150, 130, -420], dim: true },
    env: [[0, '#1a0a10'], [0.55, '#5a1820'], [0.6, '#a83a1e'], [0.62, '#3a1008'], [1, '#120604']],
    fog: { color: 0x1a0a0e, near: 90, far: 560 },
    sun: { color: 0xff9a5a, intensity: 1.35, dir: [0.3, 0.9, -0.35] },
    hemi: { sky: 0x5a2028, ground: 0x1a0808, intensity: 0.5 },
    ambient: 0.1,
    bloom: 0.95,
    bloomThreshold: 0.72,
    exposure: 1.02,
  },
};
