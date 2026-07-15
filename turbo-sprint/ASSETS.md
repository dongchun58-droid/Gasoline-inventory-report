# ASSETS.md — 외부 에셋 출처·라이선스

Phase 7(그래픽 오버홀)부터 CC0/CC-BY 에셋을 허용. 모든 항목은 여기에 기록한다.

## HDRI (환경맵 / IBL)

| 파일 | 용도 | 원작 | 라이선스 | 입수 경로 |
|---|---|---|---|---|
| `public/assets/env/venice_sunset_1k.hdr` | INFERNO CASTLE 하늘·간접광·반사 | "Venice Sunset" — Greg Zaal (HDRI Haven / Poly Haven) | **CC0** (퍼블릭 도메인) | three.js 공식 저장소 미러: `mrdoob/three.js` → `examples/textures/equirectangular/venice_sunset_1k.hdr` |
| `public/assets/env/blouberg_sunrise_2_1k.hdr` | (예비) 노을 대안 | "Blouberg Sunrise 2" — Greg Zaal (HDRI Haven / Poly Haven) | **CC0** | 동일 저장소 미러 |
| `public/assets/env/quarry_01_1k.hdr` | (예비) 주간 대안 | "Quarry 01" — Greg Zaal (HDRI Haven / Poly Haven) | **CC0** | 동일 저장소 미러 |

> 참고: 실행 환경의 네트워크 정책상 polyhaven.com / ambientcg.com 직접 다운로드가
> 차단되어, 동일 CC0 에셋의 three.js 저장소 미러(1K)를 사용했다.
> 원본 2K가 필요해지면 polyhaven.com 에서 같은 이름으로 받아 교체하면 된다.

## 절차적 텍스처 (Step 2)
도로 아스팔트(디퓨즈/노멀/러프니스), 석재·용암 노멀맵은 외부 텍스처 사이트
(ambientCG 등)가 차단된 환경이라 **코드로 생성**한다 (`src/pbrtex.js`).
외부 에셋 아님 — 라이선스 이슈 없음.

## 규칙
- 허용 라이선스: **CC0**(표기 불요) 또는 **CC-BY**(타이틀 화면 크레딧 필수)
- 신규 에셋 추가 시 이 표에 한 줄 추가할 것
- 에셋 총량 25MB 이하 유지 (현재: HDRI 3장 ≈ 4.4MB)
