# TX TMS

고객사의 알림톡·문자·RCS·자유입력형 콘텐츠를 작성 → 검수자 배정 → 검수 → 선택적 승인 → 완료·보관까지 처리하는 협업 시스템입니다.

## 구성

| 디렉터리 | 내용 |
|---|---|
| `api/` | REST API — Spring Boot, Java 21, MySQL 8 |
| `web/` | 웹 앱 — Next.js(App Router), React, TypeScript |
| `docs/` | 기획 문서 |
| `tx-tms-prototype.html`, `tx-tms-plan-v01.js` | 화면 프로토타입 (참고용) |

## 로컬 실행

1. DB 기동 (프로젝트 전용 MySQL 8, 127.0.0.1:3317)
   ```powershell
   powershell -ExecutionPolicy Bypass -File api/scripts/dev-db.ps1 start
   ```
2. API
   ```bash
   cd api && ./gradlew bootRun
   ```
3. 웹
   ```bash
   cd web && npm install && npm run dev
   ```
   브라우저에서 http://localhost:3000 을 엽니다. 웹은 `/api` 요청을 API 서버(기본 http://localhost:8080)로 전달합니다.

자세한 내용은 `api/README.md`, `web/README.md`를 참고하세요.

## 외부 연동 (운영 배포 전 교체 필요)

- 이메일: 발송 대기함에 적재만 합니다.
- 첨부 저장소: 로컬 디스크(`api/storage/`)를 사용합니다.
- 악성파일 검사: 시연용 검사기를 사용합니다.
