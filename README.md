# US Gasoline Inventory Weekly Report

EIA 주간 가솔린 재고 데이터를 자동으로 fetch해 계절성 차트 PDF를 생성하고,
매주 수요일 이메일로 자동 발송하는 GitHub Actions 워크플로우입니다.

---

## 파일 구성

```
.
├── generate_report.py            # 메인 스크립트
├── requirements.txt              # Python 의존성
├── .github/
│   └── workflows/
│       └── weekly_report.yml    # GitHub Actions 스케줄 워크플로우
└── README.md
```

---

## 세팅 방법 (5분)

### 1단계 — GitHub 리포지토리 생성

1. https://github.com 에서 새 리포지토리 생성 (private 권장)
2. 이 폴더의 파일들을 전부 업로드

### 2단계 — EIA API 키 발급 (무료)

1. https://www.eia.gov/opendata/ 접속
2. "Register" → 이메일 입력 → API 키 이메일로 수신

### 3단계 — Gmail 앱 비밀번호 발급

> 일반 Gmail 비밀번호가 아닌 "앱 비밀번호"가 필요합니다.

1. https://myaccount.google.com/security 접속
2. "2단계 인증" 활성화 (필수)
3. 검색창에 "앱 비밀번호" 입력 → 앱 선택: "메일" → 기기: "기타" → 생성
4. 16자리 비밀번호 복사

### 4단계 — GitHub Secrets 등록

리포지토리 → **Settings → Secrets and variables → Actions → New repository secret**

| Secret 이름   | 값 예시                        | 설명                    |
|--------------|-------------------------------|------------------------|
| EIA_API_KEY  | `abc123def456...`             | EIA API 키             |
| GMAIL_USER   | `yourname@gmail.com`          | 발신 Gmail 주소         |
| GMAIL_APP_PWD| `abcd efgh ijkl mnop`         | Gmail 앱 비밀번호 (16자)|
| TO_EMAIL     | `realhdh@sk.com`              | 수신 이메일 주소         |

### 5단계 — 테스트 실행

리포지토리 → **Actions → Weekly Gasoline Inventory Report → Run workflow**

버튼을 클릭하면 즉시 실행됩니다. 약 1~2분 후 이메일 확인.

---

## 자동 실행 스케줄

- **매주 수요일 오후 2시 (KST)** 자동 실행
- EIA는 매주 수요일 오전에 최신 데이터를 갱신하므로, 갱신 후 수집하는 타이밍

cron 변경을 원하면 `weekly_report.yml`의 이 줄을 수정:
```yaml
- cron: '0 5 * * 3'   # UTC 기준 (KST = UTC+9)
```

---

## 이메일 내용

- **본문**: 리포트 전체를 이미지로 변환해 HTML 인라인 삽입 (차트 포함)
- **첨부**: PDF 리포트 파일

---

## 주의사항

- GitHub Actions 무료 플랜: 월 2,000분 제공 (이 워크플로우는 1회 약 2~3분 사용)
- EIA API 무료 키: 1시간 5,000회 요청 제한 (충분)
- Gmail 앱 비밀번호는 2단계 인증 활성화 필수
