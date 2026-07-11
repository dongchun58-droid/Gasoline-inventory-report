# TURBO SPRINT — 10초 그랑프리

`KART_SPEC.md` 설계서를 따라 만드는 초압축 스프린트 카트 레이서 (Three.js + Vite, 외부 에셋 0개).

## 현재 진행 상황

### ✅ Phase 1 — 달리는 재미
- Vite + Three.js 셋업, 프레임레이트 독립 루프(고정 dt 1/120 물리 + 가변 렌더)
- "선셋 스카이 서킷" 트랙: `CatmullRomCurve3`(closed) 스플라인 → 도로 메시 압출
- 도로 표면(Canvas 텍스처): 진보라 아스팔트 + 시안 센터라인 + 양끝 체커 연석, 피니시 체커 라인
- 프로시저럴 카트 1대: 바디/노즈콘/리어윙/드라이버(헬멧+에미시브 바이저)/배기관 2 + 토러스 휠 4 (조향·서스펜션 바운스·회전 반영), 블롭 섀도
- §5 주행 물리: 가속(지수 감쇠)·브레이크·후진·드래그, 속도 비례 선회율, 스플라인 최근접점 기반 접지·경사 정렬, 도로 이탈 낙하 + 리스폰
- 체이스캠(스프링-댐퍼) + 속도 비례 FOV(60→72)
- 임시 노을 스카이돔 + 셀 셰이딩(MeshToonMaterial + 3단 그라디언트맵) + 노을 라이팅

> Phase 2 이후(드리프트·미니터보, 레이스 상태머신, AI·순위, 아이템, 폴리시)는 각 Phase의
> 완료 기준을 iPad Safari에서 확인한 뒤 순서대로 진행합니다.

## 실행

```bash
cd turbo-sprint
npm install
npm run dev -- --host      # 같은 Wi-Fi의 iPad Safari에서 http://<맥의IP>:5173 접속
```

프로덕션 빌드:

```bash
npm run build              # dist/ 정적 서빙 (GitHub Pages / nginx)
npm run preview            # 빌드 결과 로컬 확인
```

## 조작 (Magic Keyboard)

| 키 | 동작 |
|---|---|
| ↑ / W | 가속 |
| ↓ / S | 브레이크 · 후진 |
| ← → / A D | 조향 |
| R | 즉시 리스타트 |

Shift(드리프트) / Space(아이템) / M(음소거)은 다음 Phase에서 활성화됩니다.

## 구조

```
turbo-sprint/
├─ index.html      # 뷰포트 메타, 최소 HUD(속도/FPS), 세로모드 경고
└─ src/
   ├─ main.js      # 씬·렌더러·라이팅·스카이·그라디언트맵, 고정 dt 루프
   ├─ input.js     # 키보드 상태머신 (키 매핑 상수)
   ├─ track.js     # 스플라인·도로 메시·연석·피니시라인·접지 조회
   ├─ kart.js      # §5 차량 물리 + 프로시저럴 카트 모델
   └─ camera.js    # 체이스캠 + FOV 제어
```
