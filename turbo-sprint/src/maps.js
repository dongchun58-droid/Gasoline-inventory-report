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
    // 점프대 2개 — 직선·2차선 구간에 배치(코너 직후 회피). features가 분리대 있으면 자동 스냅
    pad: { boost: 0x18d6ff, chevron: '#eaffff', jump: '#ff9a2e', jumpHex: 0xff9a2e, jumpEdge: 0xffd23f,
      jumps: [0.10, 0.46] },
    road: { asphalt: '#2A2440', center: '#00E5FF', curbA: '#FF3355', curbB: '#dfe4ea', median1: 0xffd23f, median2: 0x2a2a32 },
    sky: { stops: [[0, '#1560D8'], [0.42, '#3D9BFF'], [0.72, '#8FD6FF'], [0.9, '#CFF0FF'], [1, '#F2FCFF']], sun: 0xfff6d0, sunPos: [-180, 190, -430] },
    env: [[0, '#1E6FE0'], [0.5, '#8fd0ff'], [0.6, '#eaf9ff'], [0.61, '#6fc45a'], [1, '#3f8e3a']],
    // Phase 7 Step 1: 주간 HDRI를 간접광·반사로만 사용 (배경은 Astro 톤 하늘 유지)
    hdri: 'assets/env/quarry_01_1k.hdr',
    hdriBackground: false,
    envIntensity: 0.5,
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
      // 성 내부 진입 → 좌/우로 굽이치는 구간(하단) → 좁은 다리 → 탈출
      [-92, 0, -44],
      [-64, 0, -52],  // 내부 진입
      [-40, 0, -40],  // 좌
      [-16, 0, -60],  // 우
      [8, 0, -46],    // 좌 (이 부근 좁은 다리)
      [34, 0, -66],   // 우
      [64, 0, -58],   // 내부 탈출
      [92, 0, -40], [110, 0, -20],
    ],
    // 성 내부(벽으로 둘러싸인) 구간 t범위, 좁은 다리 t범위(용암 추락)
    interior: [0.58, 0.88],
    bridges: [[0.70, 0.76, 5.5]], // [t0, t1, 반폭]
    // 점프대(t≈0.90) 바로 뒤의 용암 강: 점프로만 통과, 일반 주행 시 추락
    // (느린 트럭도 넘도록 폭을 좁게 유지)
    gaps: [[0.907, 0.911]],
    obstacle: 'fireball',
    // 보스 악당: 불 뿜는 용(고질라형) — 성 외곽 주로 2곳(도로 한쪽)에 배치, 불은 도로로 내리쬠
    dragonSpots: [0.14, 0.34],
    dragonSides: [1, -1],
    pad: { boost: 0xff7a1e, chevron: '#ffd8a0', jump: '#ff4a2a', jumpHex: 0xff4a2a, jumpEdge: 0xffb02a },
    road: { asphalt: '#231a20', center: '#ff6a2a', curbA: '#ff3311', curbB: '#160c10', median1: 0x5a3020, median2: 0x1a0e0c },
    sky: { stops: [[0, '#120609'], [0.45, '#3a0d12'], [0.72, '#701d18'], [0.88, '#a83a1e'], [1, '#d66a2a']], sun: 0xff7b30, sunPos: [-150, 130, -420], dim: true },
    env: [[0, '#1a0a10'], [0.55, '#5a1820'], [0.6, '#a83a1e'], [0.62, '#3a1008'], [1, '#120604']],
    // Phase 7 Step 1: 노을 HDRI를 간접광·반사(IBL)로만 사용 (CC0, ASSETS.md)
    // 배경까지 사진으로 바꾸면 실사 속 건물/해변이 마왕성 세계관과 충돌 →
    // 배경은 스타일라이즈드 하늘 유지(hdriBackground: false)
    hdri: 'assets/env/venice_sunset_1k.hdr',
    hdriBackground: false,
    envIntensity: 0.55,
    // 안개: 지평선(어두운 노을) 톤과 일치
    fog: { color: 0x2a120c, near: 100, far: 620 },
    // IBL이 간접광 공급 → 채움광 낮춤, 태양은 노을색
    sun: { color: 0xff8850, intensity: 2.0, dir: [0.3, 0.9, -0.35] },
    hemi: { sky: 0x6a3038, ground: 0x24100e, intensity: 0.45 },
    ambient: 0.1,
    // 과노출 정리: "빛나되 형태가 보이게"
    bloom: 0.45,
    bloomThreshold: 0.95,
    exposure: 1.06,
  },
};
