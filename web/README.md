# TX TMS — web

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · TanStack Query · Zustand · react-hook-form + zod/mini.
UI reference: `../tx-tms-prototype.html` + `../tx-tms-plan-v01.js`.
API: `../api` (types in `src/entities/*/model` mirror the API response shapes).

## Run

```bash
npm install
# API (Spring Boot) on http://localhost:8080 — override with API_ORIGIN
API_ORIGIN=http://localhost:8080 npm run dev     # http://localhost:3000
```

The browser only talks to `/api/*` on the web origin; `next.config.ts` rewrites it to `API_ORIGIN`
(default `http://localhost:8080`). If the API is down the login page still renders (the demo persona
section is hidden) and protected URLs redirect to `/login?next=…`.

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `API_ORIGIN` | server (rewrite) | `http://localhost:8080` | API origin behind `/api` |
| `NEXT_PUBLIC_API_BASE_PATH` | client | `/api` | API base path (validated in `src/shared/config/env.ts`) |

## Verify

| Command | What |
|---|---|
| `npm run lint` | ESLint (next core-web-vitals + TS) |
| `npm run typecheck` | `next typegen` (route types) + `tsc --noEmit` |
| `npm run test` | Vitest unit/component tests (`src/**/*.test.ts(x)`) |
| `npm run build` | production build |
| `npm run e2e:visual` | visual comparison with the prototype (see below) |
| `npm run e2e:real` | request authoring flow against a running API in demo mode (see below) |
| `npm run e2e:real:review` | assignment → review → approval flow against a running API in demo mode (see below) |
| `npm run e2e:real:result` | completion results, exports, follow-ups and the content archive against a running API (see below) |
| `npm run e2e:real:correction` | text correction (check, apply / swap / restore, full check, suggestions) against a running API (see below) |
| `npm run e2e:real:admin` | customer admin screens, notices and performance against a running API (see below) |
| `npm run e2e:real:admin-visual` | M5/M6/M7 screens and modals next to the prototype, app on the running API (see below) |
| `npm run e2e:real:ops` | solution operator screens (customers, initial setup, standards) against a running API (see below) |

### Visual comparison harness (`e2e/visual/`)

Playwright opens the prototype (`file:///E:/workspace/txtms/tx-tms-prototype.html`, needs internet for its
Google Fonts) and this app at the same viewport (1440×900, 1024×768, 820×1000) and writes
`<screen>.prototype.png`, `<screen>.app.png` and `<screen>.side-by-side.png` (prototype | app | diff in red)
to `e2e/visual/out/` (gitignored). API calls are mocked with Playwright routes, so no API is needed.
The dev server is started on port 3100 (`VISUAL_PORT`), or reused if already running.

```bash
npx playwright install chromium   # once
npm run e2e:visual                # all screens
npm run e2e:visual -- login       # one file
```

- `login.visual.ts` — login screen. The only intended difference is the demo disclaimer sentence; the test
  also restores the reference sentence and reports that parity diff (currently 0.00% at all three sizes).
- `token.visual.ts` — invitation page with an invalid link (0.00%).
- `shell.visual.ts` — app shell with a fixture session (chrome comparison + popover/tab captures).
- `screens.visual.ts` — read-only workflow screens next to the prototype logged in as the same persona:
  dashboard (u1, u3, u11), request list (u1), REQ-2609-101 as u2 (contents, correction result after 이 콘텐츠 검사,
  preview, opinions, history),
  REQ-2609-103 as u4 (approval waiting), REQ-2609-088 as u1 (result tab), 콘텐츠 as u1 (collapsed and with the
  lineage expanded). Prints the share of differing pixels per screen (1440×900: 0.2–1.6%). Intended differences are
  listed in the file header; on 콘텐츠 the preview shows completion-time values instead of variable chips (the API
  sends the resolved preview), the past-version row shows the item title (the prototype shows the request title)
  and the campaign filter lists campaigns of completed requests only. The correction cards follow the result screen
  design (PNG, 261007) instead of the prototype card, so `request-101-u2-proof-checked` differs in the cards on
  purpose (panel head and buttons match; the dataset line reads `교정 데이터셋 · 알림톡 v4`).

- `draft.visual.ts` — draft editing as 김서연 (REQ-2609-105): contents tab (0.67%), 요청 정보 (0.30%),
  미리보기 (0.33%), the submit missing-items modal (0.00%) and the submit confirmation (taller on purpose: it
  carries the "텍스트 교정은 선택 사항입니다" note). Other intended differences: menus of unbuilt screens, the
  correction dataset line, the prototype-only "첨부 검사 시연" panel.

- `review.visual.ts` — 검수 (이도현 배정 관리 / 내 검수, 박지훈 내 검수), 승인 (최민아) and the 검수자 배정 / 검수자 변경 /
  검수 완료 modals next to the prototype. Modals are 0.00%; the pages differ only in row order (the server sorts by
  접수일, the prototype keeps seed order), due-date tags (the prototype pins "today"), file ranges the prototype
  seed leaves empty (`페이지 ?`) and menus of unbuilt screens.

API mocks for the harness come from `e2e/fixtures/`:
- `api-snapshot.ts` — contract-shaped responses captured from the demo API (generated; typed exports such as
  `dashboardU1: Dashboard` are type-checked against `entities`, so contract drift fails `typecheck`).
  Regenerate with `node e2e/fixtures/capture-api.mjs [http://localhost:8080]` while the API runs in demo mode.
- `draft-snapshot.ts` — REQ-2609-105 (detail + history) and the project 1 variables, captured from the API.
- `review-snapshot.ts` — list views, workload and request details of the 검수 / 승인 screens (seed requests
  only), regenerated with `node e2e/fixtures/capture-review.mjs [http://localhost:8080]`.
- `archive-snapshot.ts` — 콘텐츠 archive of project 1 as u1 (seed lineages only) and its campaign list,
  regenerated with `node e2e/fixtures/capture-archive.mjs [http://localhost:8080]`.
- `correction-snapshot.ts` — correction dataset labels of the seed requests the screens open and the check result of
  REQ-2609-101, regenerated with `node e2e/fixtures/capture-correction.mjs [http://localhost:8080]`.
- `mock-api.ts` — `mockApiAs(page, userId, { extra, onWrite })`: refresh returns that persona, GETs answer from
  the snapshot plus `extra` (query order ignored), writes go to `onWrite` (default 405). Unit tests import the
  same fixtures via `@fixtures/*`.

### Real-API flow (`e2e/real/draft-flow.mjs`)

Drives a dev server (default `BASE=http://localhost:3000`, proxied to the API in demo mode) as 김서연 and creates
real drafts: 새 요청 → 요청 정보 autosave → submit with missing fields (list + field errors) → fix → 알림톡 editing
with variable insertion and 미리보기 values → variable registration (format, duplicate and type errors) → add /
delete content → XLSX import (preview with error rows) → submit → cancel → resubmit → clone → 자유입력형 type
change, multi-file upload (accepted, rejected format, demo `UNSAFE`), range validation, download, delete → RCS
type change with confirmation, card count and image upload. Sample files live in `e2e/real/files`; screenshots
go to `e2e/real/out/` (gitignored).

### Real-API flow (`e2e/real/review-flow.mjs`)

One fresh request per run, five personas in separate browser contexts: 김서연 creates and submits → 이도현 assigns
박지훈 (primary) + 한가을 from 검수 › 배정 관리 (validation toast, auto primary) → 한가을 edits C1 (buffer + edit lock)
and saves v2, adds an opinion → 박지훈 saves on the stale v1 → "다른 사용자가 먼저 저장했습니다" → 최신 버전 불러오기 →
한가을's lock is shown to others, 이도현 releases it (잠금 해제 (대표 검수자)), 한가을's buffer can no longer be saved →
박지훈 adds an opinion and a 확인 요청 → 김서연 edits in 확인 요청, cannot answer before saving, saves v3 and answers
(round 2) → 이도현 changes the assignment (reason + handover) → recall rejected, recall approved (박지훈 lands on
검수) → resubmit (round 3) → assign again → 박지훈 completes (공동 검수 결과 with "(이전 담당)", confirmation) →
최민아 asks for a revision (round 4) → 박지훈 completes → 최민아 approves → 완료 결과. Screenshots `review-*.png` in
`e2e/real/out/`. Shared helpers (persona contexts, step runner, API client for setup steps) live in
`e2e/real/helpers.mjs`.

### Real-API flow (`e2e/real/result-flow.mjs`)

김서연 in the browser; assignment, completion and approval of setup requests go through the API (`API_ORIGIN`, default
`http://localhost:8080`). New 알림톡 request → 검수 요청 with a missing field (the `submit-check` list appears before the
confirmation) → two contents (C1 uses `#{customer_name}`) → submit → approved → 완료 결과: bundle and completion-time
variables, C1 복사 (the clipboard holds the substituted text, `copy-events` 204), XLSX export (file downloaded, `PK`
header) → 후속 요청 작성 (whole: new draft with both contents, `원본 {ID}` breadcrumb back) → C2 후속 요청 from the result
row → that follow-up is approved → 콘텐츠: the C2 line shows the follow-up as latest with the original as 과거 완료본 and
the whole follow-up (`이력 2` / `접기`), C1 copy and 새 탭, filters (campaign, type, status, completion date, 초기화, 더 보기
when present), 후속 요청 from a line → 자유입력형 uploads with the demo scan outcome (`FILE_UNSAFE` → 등록 차단,
`FILE_SCAN_FAILED` → 검사 실패, then a real PDF) → approved → ZIP export (file name, manifest and file entry) → a clone
of the seed REQ-2609-107 (seed file without a stored original) approved → ZIP shows `…시연용 파일의 원본이 없습니다` and
the dialog stays → recall approved on a follow-up → the submit confirmation says "검수 차수가 2차로 올라갑니다".
Screenshots `result-*.png` and the downloaded files go to `e2e/real/out/`.

### Real-API flow (`e2e/real/correction-flow.mjs`)

김서연 on the seed draft REQ-2609-105: 이 콘텐츠 검사 → `할수` card → `할 수` applies at once (toast `교정이 적용되었습니다.`,
the new text selected in the editor, autosaved, history `교정 적용` `body: 할수 → 할 수`) → 복원 (`교정이 취소되었습니다.`,
history `교정 복원`). A fresh draft built from sample-dataset phrases: 1:N swap without restoring (`가입 대상` → `가입대상` →
`가입 가능한 분`, card label/description follow), `소요됩니다` → `필요합니다` → `걸립니다` → 복원 = `소요됩니다` with indexes intact
after the earlier swap, `수령인` → `받는 사람` → `받는 분`, overlapping results (`첫번째 보장` applied disables `보장 받겠지만`
until restored), description-only `처리`, card click / Enter → editor selection, stale banner after typing, 전체 검사 (groups
per content, bottom bar counts, applying a C2 card switches the editor to C2, 교정 완료 closes) and 건의하기 (reason required,
history `교정 건의`). On REQ-2609-101 the requester can check but not apply or suggest; 박지훈 applies `되요 → 돼요` (edit lock +
revision buffer) and saves a new version — the seed text is then put back through the API (a second revision, so every
run raises C1 by two versions). A 자유입력형 draft drops its result once a file is attached (exclusion note, 전체 검사 lists
`C1 · 첨부파일로 제외`) and does not get it back after the file is removed. 문지아 (customer 2, no 자유입력형 dataset) sees
`배정 필요` and the server message on click. Screenshots `correction-*.png` in `e2e/real/out/`.

### Real-API flow (`e2e/real/admin-flow.mjs`)

강민호 (customer admin, 한빛카드): 프로젝트 추가 (required-field toasts, lead + approver) → 사용자 초대 of an external
address (warning banner, first click = confirmation toast, second click invites) → 초대 재발급 → the sample customer's
outbox shows the full `/invite/{token}` link → the invitee opens it in a fresh context, sets name + password and is
signed in (email login works afterwards) → 역할 관리 (requester/reviewer exclusivity, saved as reviewer) → 공지 작성
(customer scope; 김서연 sees and expands it, 문지아 of 도담생명 does not) → 수정 (`수정됨`) → 철회 (gone for 김서연) →
변수 등록 (type error toast) / 편집 / 삭제, `customer_name` in use: 삭제 disabled and the API refuses → 고객사 설정
(due-soon days and name with toasts, restored) → 비활성화 of 김서연 refused by the server with the details list →
the invitee made lead of the new project, 비활성화 asks for a substitute + handover, the lead moves to 박지훈 →
재활성화 → 접근·변경 기록 tab. A throwaway customer created through the ops API shows the masked outbox (`링크 가림`,
`••••`, `링크는 수신자에게만 전달됩니다`) to its admin signed in by email; that customer is deactivated. 이도현 opens
업무량·실적 (all projects, user filter, an invalid period shows the server error). Screenshots `admin-*.png`.

`e2e/real/admin-visual.mjs` captures the prototype and the app (same persona, live API data) for 업무량·실적, 공지, the five
admin pages and the project / variable / invite / role / notice modals as `visual-*.side-by-side.png` in `e2e/real/out`
(1440×900: 0.3–2.6% differing pixels where the data matches; the users table and role modal differ more once E2E runs
added projects). Intended differences: data, enum labels for variable types, no operator notices (Phase 2), the
`접근·변경 기록` sub tab and the outbox title.

### Real-API flow (`e2e/real/ops-flow.mjs`)

정우진 (solution operator, 15 steps): 운영 대시보드 (three KPIs, no 내 지원 접근, the project select reads 참여 프로젝트 없음) →
요청 / 콘텐츠 show the operator's no-content state → 고객사 생성 (required toast, `도메인 형식을 확인하세요`, duplicate domain of
한빛카드, the normalised domain shown under the field) → 초기 설정·시드 opens on the new customer with its 기본 프로젝트 and no
sample actions → 첫 고객사 관리자 초대 of an external address (warning, first click = confirmation toast, second click
invites, result modal with the queued mail) → 초기 업무 사용자 초대 (company domain, 요청자) → 발신 정보 (row validation, then a
template and a sender saved) → 유효 데이터셋 배정 for all four types (an older version first, then the newest — the
confirmation resets — and 확인 처리) → 미배정 + 최신 배포본 시드 (assign + confirm) → 유형 관리 RCS off (matrix select disabled)
and on → 데이터셋 등록: JSON rows refused with `{행}행: …` details, then the sample XLSX
(`api/src/main/resources/demo/correction-sample-dataset.xlsx`) as a new 자유입력형 version and its rules → 샘플 요청 생성 and
샘플만 초기화 on 한빛카드 → 운영 이력 (filtered by the test customer, paged), 설정 이력 and 메일 발송 대기함 → 시연 데이터 초기화
modal cancelled → 비활성 (reason required) as cleanup. Each run adds one dataset version and leaves an inactive test
customer; the content types are restored even when a step fails. Screenshots `ops-*.png`.

`admin-visual.mjs` also captures the operator screens and modals (`ops-*-u5`): 대시보드 2.2%, 유형 관리 0.3%, the other
screens and modals 3–6.5% differing pixels — dev DB data (more customers and versions, E2E leftovers). Intended
differences: no `내 지원 접근` KPI / panel (Phase 2); 고객사 관리 shows 상세 and 프로젝트·요청 side by side instead of the
reference's empty right column, plus a customer filter on 운영 이력; 초기 설정·시드 adds the 메일 발송 대기함 and 프로젝트
발신 정보 panels and a 데이터셋 등록 button, without the 공통 row (Phase 2); the assignment matrix has no 공통 column; the
dataset modal takes an XLSX upload or JSON in the contract's 7-column keys instead of the reference's `mode/p/s/r` JSON;
목업 시드 checkboxes are read-only (Phase 2).

Against the real API: `API_ORIGIN=http://localhost:8080 npm run dev`, then sign in with a demo persona.
If a dev server already runs, `VISUAL_PORT=3000 npm run e2e:visual` reuses it.

## Structure (Feature-Sliced Design)

```
src/
├─ app/            routing only: (auth)/login, (auth)/invite/[token], (auth)/reset/[token],
│                  (app)/layout.tsx + (app)/[[...slug]] (renders nothing; the shell renders views),
│                  globals.css (tokens), providers.tsx
├─ views/          login, token-password, dashboard, request-list, request-detail (+ content tab), review,
│                  approval, content-archive, performance, notices, admin-projects, admin-variables,
│                  admin-users, admin-customer, admin-notices, ops-home, ops-customers, ops-setup,
│                  ops-standards, profile
├─ widgets/        app-shell (sidebar, top bar, work tabs, popovers, tab store), auth-layout (login hero),
│                  workload-table (검수자별 업무량, shared by 검수 › 배정 관리 and 업무량·실적)
├─ features/       auth (login, demo personas, reset request, token password, session), profile-edit,
│                  request-create (new, clone, follow-up), request-workflow (submit/cancel, assignment, schedule, recall, opinions,
│                  asks/answers, completion, approval, unlock), completed-output (copy,
│                  XLSX/ZIP export), variable-picker, bulk-import, text-correction (panel, cards,
│                  apply/restore offsets, freshness, 건의하기), customer-admin (project, variable, invite, roles,
│                  deactivation, email, notice and settings forms; row actions), ops-admin (customer create /
│                  deactivate, setup project / invitations, templates and senders, dataset register / rules /
│                  seed, samples, demo reset, operator hand-offs)
├─ entities/       me, customer, project, user, request, variable, correction, dashboard,
│                  notification, notice, audit, ops — contract types + label maps (+ small queries)
└─ shared/         api (http client, XHR upload, blob GET, ApiError, query client/keys), config (env, routes), lib, ui (kit + icons)
```

### Styling

- All colors, radii, shadows and fonts are CSS variables defined once in `src/app/globals.css` (`:root`) and
  exposed to Tailwind through `@theme inline`. Tailwind preflight is not imported — the reference relies on
  browser defaults.
- Components use co-located CSS Modules that only reference tokens; per-instance values (status tone `--c`,
  avatar color, popover position) are passed as CSS variables.
- Breakpoints reproduce the reference (desktop first): `max-width: 1180px` and `max-width: 860px`
  (Tailwind variants `upto-work:` / `upto-nav:`).
- Font: IBM Plex Sans KR 400/500/600/700 from `@fontsource/ibm-plex-sans-kr` (no Google Fonts request),
  tabular numbers on `body`.

### Routing and work tabs

URL scheme (`src/shared/config/routes.ts`, `pathToTab` / `tabToPath`):
`/` 대시보드 · `/requests` · `/requests/{id}` · `/requests/{id}/contents/{key}` · `/review` · `/approval` ·
`/contents` · `/performance` · `/notices` · `/admin/{projects|variables|users|customer|notices}` ·
`/ops/{customers|setup|standards}` · `/profile`.

- The URL is the active tab. A direct address opens (or re-activates) its tab; clicking a tab is
  `router.push(path)`. Reuse: one tab per menu route, per request id, per request + content key.
- Max 10 tabs (`업무 탭은 최대 10개입니다. 기존 탭을 닫아 주세요.`). Closing the active tab activates the right
  neighbour, else the left one; a dirty tab asks for confirmation first.
- Every open tab's view stays mounted inside React `<Activity>` (hidden when inactive), so inputs, filters
  and per-tab scroll positions survive tab switches. Views receive `WorkViewProps`
  (`tab`, `active`, `setDirty`, `setTitle`).
- Only the tab list (`{ route, params }[]`) is persisted, per user, in `localStorage` (`txtms:tabs:{userId}`).
  The selected customer/project is remembered the same way (`txtms:context:{userId}`).
- Operators have no project context (the top bar offers member / admin projects only — reference `myProjects`), so
  요청 / 콘텐츠 / 공지 show their empty or no-content states; operator screens keep their own customer selection and do
  not wait for the top bar context. The add-tab popover lists work and customer admin menus only (reference).
- Menus show routes that are implemented (`ROUTES[key].enabled`) and allowed for the current
  customer/project (`canAccessRoute`). A disallowed direct URL shows the access-denied view.

### API client and session

- `shared/api/http-client.ts` — single client, base `/api`. The access token lives in memory only; on start
  the app calls `POST /api/auth/refresh` (httpOnly cookie). On 401 it refreshes once (shared between
  concurrent calls) and retries; if that fails it clears the session, shows
  `세션이 만료되었습니다. 다시 로그인하세요` and goes to `/login`.
- Errors are `ApiError { status, code, message, fieldErrors, details }`.
- Query keys: `[resource, 'list', params]` / `[resource, 'detail', id]`.

## Implemented pages

| Path | State |
|---|---|
| `/login` | done — hero, email/password (+ 로그인 유지), 비밀번호 재설정 request modal, demo personas (`GET /api/auth/demo-personas`, hidden when unavailable) |
| `/invite/[token]`, `/reset/[token]` | done — token check, set password + automatic sign-in, invalid-link state |
| app shell | done — sidebar, customer/project context, approval tag, notification popover, user/persona popover, work tabs |
| `/profile` | done — name/department (`PATCH /api/me`), 시연 데이터 초기화 for operators (`POST /api/ops/sample-reset`), logout |
| `/` | done — `+새 요청` (requesters), role dashboard (`GET /api/projects/{id}/dashboard`): today (KST), pipeline + stage modal (`status=`), KPI tiles + list modal (same `view`, `customerId` for customer views), 지금 처리할 일, 최근 요청, 검수자별 업무량 (lead), 공지 (static rows). Operators: the ops dashboard (below) |
| `/requests` | done — `+새 요청` (requesters), all reference filters (title/ID search debounced 250ms), table, recall/후속/긴급/지연 tags, empty / loading / error / no-permission states |
| `/review` | done — 내 검수 (진행 중 / 완료: `MY_ASSIGNED_ACTIVE` / `MY_ASSIGNED_DONE`, 내 역할 주담당 / 공동 검수, 검수량, 지연 / 임박) for reviewers; 배정 관리 for the lead (배정 대기 with 배정 → request tab + assignment modal, 지연, 납기 임박, workload table from `GET /api/projects/{id}/workload`) |
| `/approval` | done — 승인 대기 (`APPROVAL_QUEUE`, 처리 가능 = listed in `APPROVAL_PENDING`, else 본인 관여 요청), 내가 처리한 요청 (`APPROVAL_PROCESSED`), no-active-approver banner |
| `/requests/{id}` | draft authoring and review workflow (below) — header (breadcrumb, chips, round, tags, meta, status track, sub tabs), banners, work grid (content list with 편집 중 / 수정 중 markers, type editors, lock bars, guide drawer, version compare), side panel (교정 panel and result cards, 미리보기 mockups, 의견 + form, 확인 요청 thread + ask / answer forms), 요청 정보, 히스토리 (merged, round separators, filter), 완료 결과 (bundle, XLSX/ZIP export, copy, variables). Not-found / denied states |
| `/requests/{id}/contents/{key}` | content header + two-column work grid (draft autosave or review-time revision editing) |
| `/contents` | done — completed contents by lineage (`GET /api/archive/contents`, 20 per page + 더 보기), filters (text debounced 250ms, type, campaign from `GET /api/archive/campaigns`, status, completion date, 초기화), expand past completions / follow-ups, 복사, 새 탭, 후속 요청 (requesters), empty / loading / error / no-permission states |
| `/performance`, `/notices`, `/admin/*` | done — see "Work management and customer admin (M5 + M6)" |
| `/ops/customers`, `/ops/setup`, `/ops/standards` | done — see "Solution operator (M7)" |

### Request authoring (M1)

- Header buttons render only for actions that are in the request's `allowedActions` **and** in
  `IMPLEMENTED_ACTIONS` (`entities/request/model/actions.ts`: every contract action).
- **새 요청** (`features/request-create`): `POST /api/requests` (first active type), opens the tab on 요청 정보 (a
  titleless draft starts there). **복제** opens the copy. Repeated clicks are ignored while a call runs.
- **Draft session** (`views/request-detail/model/draft-session.ts` + `autosave.ts`): local edits (info fields,
  content title/payload, attachment ranges) sit on top of the cached detail and are saved 700ms after input
  stops, at once by 저장 / before submit, and every 30s while something is pending; failures retry 3 times 1s
  apart (network/5xx only), then `저장 실패…` and a danger banner. Content saves send the `savedAt` the edit
  started from (`expectedSavedAt`); a `VERSION_CONFLICT` opens "다른 곳에서 먼저 저장했습니다" (reload or keep
  editing). The session lives with the view state, so switching tabs never drops a pending save; it stops when
  its tab is closed. Unsaved edits mark the tab dirty (close confirmation) and arm the browser's leave warning.
- **요청 정보**: title, type (confirmation when contents would be reset → `PUT …/type`), hope due date, purpose,
  target, background, campaign; field errors from the submit answer, cleared once a value is typed.
- **Contents**: per-type editors with live counters (알림톡 characters, SMS bytes with notice lines), buttons up to
  5, RCS card count 1–5 and image upload per card (PNG/JPG → `imageKey`, shown through an authenticated blob URL),
  content title, add / delete selected (confirmation), XLSX import for 알림톡·문자 (`features/bulk-import`:
  template download, server preview with per-row errors, error rows not selectable, commit).
- **Variables** (`features/variable-picker`): 변수 삽입 popover (not for RCS) searches active project variables and
  inserts `#{key}` at the caret of the last focused field (else the end of 본문/텍스트); any project member can
  register a variable there (key/type/description/value; server messages under the fields). Previews substitute
  current values.
- **Attachments** (자유입력형): multi-file select, one upload per file with independent results (`업로드 중` →
  `파일 검사 중` → `업로드 완료` / `안전하지 않은 파일로 등록 차단` / `검사 실패` + the API message), range inputs
  autosaved (`PATCH …/files/{id}`, inline range hints), delete, download. Uploads use `shared/api` `uploadFile`
  (XHR: the "검사 중" step starts once the bytes are sent).
- **Demo accounts only**: a small "첨부 검사 결과 선택" panel under 자유입력형/RCS drafts sends
  `X-Demo-Scan-Outcome` with uploads (the server honours it only in demo mode).
- **Submit** (`features/request-workflow`): saves pending edits, runs `POST …/submit-check` and shows the
  missing-items list before asking (a server without the pre-check — 404/405 — still works: the confirmation
  opens and a `VALIDATION_FAILED` submit shows the same list), confirms (target lead reviewer; "검수 차수가 n차로 올라갑니다"
  when `nextSubmitRound` > `round`), then `POST …/submit` with `rowVersion` and an `Idempotency-Key`
  (확인 → 요청 정보 when info fields are missing). **요청 취소** with the reference confirmation.
- Denied requests: `DRAFT_PRIVATE` → "…아직 작성 중인 요청입니다…", `FORBIDDEN` → member-only text, 404 → not found.
- Display texts that depend on permissions (banners, read-only reason) are computed from `allowedActions`
  and the request state (`views/request-detail/model/banners.ts`, `entities/request/model/edit-reason.ts`).
- Binary endpoints (file versions, bundle exports) are fetched with the in-memory bearer token and saved
  through a blob URL (`downloadFile` in `shared/api`) — a plain link cannot carry the token.
- Shell: menu badges (`요청` = my drafts + my 확인 요청, `검수`, `승인`) from `view` list totals (`size=1`,
  refreshed every 60s); notification click loads the request + project, switches the customer/project
  context and opens the tab (403/404 → `이 요청을 볼 권한이 없습니다`, the notification stays unread);
  the add-tab popover lists the first 8 contents of the visible project requests.

### Assignment, review and approval (M2)

- **Header actions** → modals in `features/request-workflow` (every call sends the request `rowVersion`):
  검수자 배정 (reviewer checklist with `활성 n건`, primary segment — one reviewer becomes primary automatically —
  확정 납기 + 긴급도, 희망 납기 kept), 검수자 변경 (same picker + 변경 사유 + 인수인계, no-op refused), 납기·긴급도
  (also from 요청 정보 › 관리 정보), 회수 요청, 회수 승인 / 거절 (banner buttons, 처리 의견 required; after an
  approval the primary reviewer is taken to 검수), 검수 완료, 수정 요청 (이유, 위치, 세부 위치, 기대 내용), 승인.
  Input checks follow the server order and show the reference toast (`{항목}을(를) 입력하세요`, `검수자를 한 명 이상
  고르세요`, …). Errors: `REQUEST_STATE_CONFLICT` → "권한 또는 요청 상태가 변경되었습니다" + reload;
  `NO_ELIGIBLE_APPROVER` / `LOCKED_BY_OTHER` → server message + reload; `VALIDATION_FAILED` keeps the modal open.
- **검수 완료**: checks in the reference order — no eligible approver (approval customers) calls the server
  directly so it records the block and notifies, another reviewer's lock or my unsaved revision blocks with a
  toast — then "공동 검수 결과" (`coReviewers`: `(주담당)`, `(이전 담당)`, `검수 의견 n건`, per-round split when
  several), 대상 버전, open-lock warning and the required "공동 검수 결과와 대상 버전을 확인했습니다".
  `VALIDATION_FAILED` lists the server details.
- **Revision editing** outside drafts (`views/request-detail/model/revision-session.ts`, reference `mutF` /
  `saveRev` / `discard`): the first edit of a content opens a tab buffer from the current version and takes the
  edit lock (`POST …/lock`; refused → buffer dropped + server message); typing refreshes the lock at most once a
  minute. Bars: `{이름}님이 이 문안을 편집 중입니다…` (+ 잠금 해제 (대표 검수자|고객사 관리자) → confirmation →
  `force-release`), the read-only reason, `v{base}을 기준으로 수정 중입니다…`. 수정본 저장 → `POST …/revisions
  {baseVersion, payload, files?}` (attachment amounts are part of the buffer); `VERSION_CONFLICT` → "다른 사용자가
  먼저 저장했습니다" → 최신 버전 불러오기 (drop + reload); a lost lock → "편집 잠금이 만료되었습니다…". A refreshed
  detail (polled every 30s while 검수 중 / 확인 요청 and the tab is visible) that no longer shows my lock marks the
  buffer lost. 변경 취소, closing the tab (`watchTabClose`) and leaving the page (`keepalive` DELETE) release the
  locks. Reviewers can upload a file revision (same extension) per attachment while 검수 중; RCS images and
  variable insertion work on the buffer too. A buffer marks the tab dirty.
- **Threads**: 검수 의견 작성 (current content or 요청 전체), 확인 요청 보내기 (blocked while a revision is unsaved or
  a recall is pending), 답변하고 검수 재개 per open question (blocked while a revision is unsaved).
- 배정 from 검수 › 배정 관리 hands the request id + `ASSIGN` to the request tab (`useRequestActionIntent`), which
  opens the modal once it shows the request.

### Completion results, archive and follow-ups (M3)

- **완료 결과** (`views/request-detail/ui/result-tab.tsx`): bundle head (status, completion time, 처리자, item count),
  items (files as `{name} (v{n})`, else the text fields with variable chips), 완료 당시 변수 값. 복사 (text items) puts the
  message body (알림톡·문자 `body`, RCS card bodies, 자유입력형 `text`; no title or buttons) with `#{key}` replaced by
  the bundle variables on the clipboard first, then records `POST …/bundle/copy-events` (an audit failure does not undo
  the copy); toasts `문안을 복사했습니다` / `복사하지 못했습니다. 직접 선택해 복사하세요`. Exports (`EXPORT`) open the
  reference confirmations and download with the bearer token (`features/completed-output`); a refused export shows the
  server message — e.g. 404 `{파일명}: 시연용 파일의 원본이 없습니다` for seed files — and keeps the dialog open.
- **후속 요청** (`FOLLOW_UP`): header `후속 요청 작성` (whole bundle) and `후속 요청` per result row / archive line
  (`POST /api/requests/{id}/follow-up {contentKey}`) store the new draft, refresh lists and the archive, toast
  `완료본과 연결된 후속 요청을 만들었습니다` and open its tab. The breadcrumb of a follow-up links `원본 {ID}`.
- **콘텐츠** (`views/content-archive`): one row per lineage with the latest completion (title, version, request, type,
  status, date, campaign, server preview); the toggle reads `이력` without linked entries, else `이력 {n}` / `접기`;
  expanded rows list `과거 완료본` and open `후속 요청` with links to their requests. 복사 uses `latest.resolvedText`.
- Filter bars use `FilterBar` / `FilterField` / `DateRangeFilter` from `shared/ui` (request list and archive).

### Text correction (M4)

- **Panel** (`features/text-correction`, 교정 tab of the side panel): `이 콘텐츠 검사`, `전체 검사 {n}건` (2+ contents; n =
  contents without attachments), `교정 데이터셋 · {label}` from `GET …/corrections/dataset` + `교정 실행은 검수 요청·완료 조건이
  아닙니다.`. Unassigned dataset: the buttons look disabled (`aria-disabled`), the line says `배정 필요`, and a click still
  calls the check so the server message is shown. Checking is open to every viewer (`POST …/corrections/check` with the
  tab's current buffer — draft edits or the revision buffer — and `hasFiles`).
- **Results** live in tab memory per content (`useCorrection`) together with the normalized payload string and the
  `variablesRevision` they refer to. Freshness: a different payload, or a project `variablesRevision` newer than the
  result's (registering a variable refetches the project), shows `최신 내용과 불일치 · …` and disables apply / restore;
  apply / restore move the snapshot along, so a result stays valid while it is used. Attaching a file to a 자유입력형 drops
  its result (it does not come back after the file is removed); such contents show the exclusion note and are listed as
  `{key} · 첨부파일로 제외` by 전체 검사.
- **Cards** (result screen design, PNG 261007): header = 교정 유형 라벨 (`descriptionLabel`) + field + ④ 건의하기 (send icon);
  ① 기존 표현; ② one recommendation = button that applies at once (applied: navy fill, `aria-pressed`); 2-2 several = select
  `권장 표현 선택` that applies on choice and swaps directly between options (`before` = the applied text), label and reason
  follow the chosen option; ③ 복원 always shown, enabled once applied, always returns the original; ⑤ description-only rules
  show no recommendation area. Toasts `교정이 적용되었습니다.` / `교정이 취소되었습니다.`, then the new text is selected in the
  editor (`setSelectionRange` + a short highlight ring). Card click or Enter selects the expression too; a card of another
  content switches the request tab to it, or — in a content tab — opens that content's tab and hands the result over.
- **Offsets** (`model/run.ts`): a replacement shifts later groups of the same field by the length difference; partially
  overlapping groups (same field, not containing each other) never move — while one is applied the others are disabled
  with the reason shown, and they are valid again after its restore.
- **Editing**: drafts (author) write into the draft session (autosave); review-time edits (assigned reviewer in 검수 중,
  requester in 확인 요청) first open the revision buffer and take the edit lock (refused → nothing changes), then write the
  buffer (수정본 저장 as usual). Each apply / restore then records `POST …/corrections/events` (a failure only shows a toast).
  Viewers without editing rights see results read-only; 건의하기 needs `EDIT_CONTENT` or `REVIEW`.
- **전체 검사**: groups per content (`C1 · 제목 (n)`, collapsible, the shown content marked), bottom bar `콘텐츠 n · 교정 적용 n ·
  교정 결과 n` and `교정 완료` (closes the full-check view). In a content tab, cards of other contents are applied in their
  own tab.
- **건의하기** modal: content key, matched text and the current options, required `건의 이유` (2,000자) → `POST …/suggestions`
  (`ruleIds` = the group's rules) → `건의를 보냈습니다`.

### Work management and customer admin (M5 + M6)

- **업무량·실적** (`views/performance`, lead of the selected projects or customer admin): filters 기간 (접수일 KST: 이번 달 /
  최근 30일 / 최근 90일), 접수일 직접 지정 (two KST dates; a typed start wins over the preset, a missing end = today on the
  server, both ends inclusive), 프로젝트 (led projects, all customer projects for an admin, + `권한 있는 전체` = no
  `projectId`), 사용자 (active reviewers of the target projects) → `GET /api/performance`. KPI tiles 접수 요청 / 접수 집단
  완료율 (`–` when nothing was received, one decimal) / 기간 내 완료량 / 현재 진행, 개인 실적 table with bars, 현재 업무량
  (the server's workload of every target project, `widgets/workload-table`). A refused query (e.g. start after end) shows
  the server message.
- **공지** (`views/notices`): accordion of `GET /api/notices?customerId` (`{범위}  {작성자}  {M/D HH:mm}` + `수정됨`), admins
  get `공지 관리`. Dashboard notice rows open this tab with that notice expanded (`useViewIntent` hand-off in
  `shared/lib`); the dashboard admin banner's `접근 기록 보기` opens 사용자·권한 관리 on `접근·변경 기록`.
- **고객사 관리** menus (customer admins of the selected customer, also in the add-tab popover): 프로젝트 관리 (table with
  in-progress counts, 프로젝트 추가 / 편집 modal: lead, approver checklist on approval customers, 사용 중 + stop warning),
  변수 관리 (project select, 사용 = 활성/중지 + ` · 사용 중`, 이력 from the variable logs, 편집 / 삭제 — 삭제 disabled while in
  use, `PATCH` sends changed keys only), 사용자·권한 관리 (members with project role columns, pending invitations with 초대
  재발급, 역할 / 이메일 / 비활성화 / 재활성화; 사용자 초대 with the external-domain confirmation — a client warning plus a
  held first click, and a server `EXTERNAL_DOMAIN_CONFIRM_REQUIRED` also counts as that step so the next click resends
  with `externalDomainConfirmed: true`; 역할 관리 with live requester/reviewer exclusivity, the lead's reviewer locked,
  approver only on approval customers, only changed projects are sent; 비활성화 loads the deactivation impact first — a
  review in 확인 요청 / 승인 대기 is refused with the reference toast, otherwise the modal shows 진행 중 검수 / 대표 검수자 /
  승인 대기 이후 plus blocking rows, substitute + handover when reviews or lead projects move; 메일 발송 대기함 paged, `링크
  가림` on masked mails; `접근·변경 기록` sub tab = the customer audit log), 고객사 설정 (approval stage read-only; name saves
  on blur/Enter, channel and due-soon days at once, toasts as the reference), 공지 관리 (table with logs, 공지 작성 / 수정
  modal, 철회 confirmation).
- Modal errors: client checks toast the first problem (reference wording); a refused write toasts the server message,
  puts `fieldErrors` under their fields and shows `details` as a list in the modal (`ErrorDetails`); the modal stays open.
- Notification popover: `업무 처리 완료` only for a notification with a request and no pending work, plus `재통지`.
- Dashboard KPIs are drawn from the server array as they come (requesters also get 납기 임박, reviewers 확인 요청
  `MY_ASSIGNED_CONFIRMING`); the KPI list modal uses the same view. Correction freshness uses the newer of the request's
  and the project's `variablesRevision`.

### Solution operator (M7)

- **대시보드** (`views/ops-home`, `GET /api/ops/dashboard`): `{이름}님, 운영 현황입니다` + 고객사 생성, three KPI tiles (not
  clickable), 초기 설정에서 남은 일 (a row opens 초기 설정·시드 or 유효 데이터셋 배정 with that customer selected — a
  `useViewIntent` hand-off `{ customerId, sub }`), 고객사 (row → 고객사 관리 on that customer), 최근 운영 이력.
- **고객사 관리** (`views/ops-customers`): every customer (inactive included) with approval, counts, admins, unassigned
  types, state and 비활성 / 사용 재개; 상세 (domain, approval stage, admins, operation settings, state and reason) next to
  프로젝트·요청 (projects with lead, request counts, samples, 초기 설정 열기); 운영 이력 (`GET /api/ops/audit-logs`, 12 per
  page, all customers or one). 고객사 생성 shows the stored domain (`저장 값: …`), refuses format and duplicate domains
  client side, puts server `fieldErrors` (e.g. `DUPLICATE`) under the field, then switches the context and opens 초기
  설정·시드 on the new customer. 비활성화 shows the impact and needs a reason.
- **초기 설정·시드** (`views/ops-setup`; the customer select also switches the top bar like the reference, an inactive
  customer stays a local selection with a banner): 초기 프로젝트·사용자 steps (관리자 초대 / 프로젝트 생성 / 사용자 초대 /
  배정 화면), 유형별 교정 규칙 시드 (assigned vs newest version, 최신 배포본 시드 = assign + confirm, 데이터셋 등록), 메일
  발송 대기함 of every customer (`GET /api/ops/outbox`, 5 per page, `링크 가림` and the note that links show in demo mode
  only), 프로젝트 발신 정보 (알림톡 templates and 문자 senders per project; the editor validates rows like the API and puts
  `templates.{i}.code|name` / `senders.{i}` errors under the row; only changed lists are sent), 샘플 요청·콘텐츠 (sample
  customers only — others get the reason and no actions), 시드 실행 이력 (`GET /api/ops/setup-logs`, 20 per page).
  Invitations: first admin (`admin: true`) or business user (project + role) with the external-domain confirmation of
  사용자 초대, then a result modal with the queued mail.
- **유형·교정 기준** (`views/ops-standards`): 유형 관리 (사용 toggles at once, 목업 시드 read-only), 유효 데이터셋 배정
  (customer × 4 types; picking a version assigns or changes it — the confirmation resets —, 미배정 unassigns, 확인 처리
  confirms; stopped types are disabled; the effective datasets of a selectable customer), 데이터셋 시드 (every version,
  규칙 보기 = `GET /api/ops/datasets/{id}`, 데이터셋 등록 by XLSX upload — multipart `scope` + `file` — or JSON paste; row
  refusals are listed from `details`).
- Every operator write invalidates the `ops` query keys plus the shell lists (customers, projects, users, content types).

## shared/ui components

Button (default/pri/ok/warn/ghost, sm) · IconButton (badge) · Tag (hot/flag/recall/fill) · StatusChip ·
TypeChip · RoundBadge · Avatar · AvatarStack · Banner (ask/info/danger/done/appr/wait) · Panel/PanelHeader/
PanelBody · FilterBar/FilterField/DateRangeFilter (+ `filterClasses`) · Table (+ `tableClasses`) · KpiGrid/Kpi · SubTabs · Seg · ListItem (`nestedActions` for rows with buttons) · Empty (+ EmptyArt) · Field/
Label/Hint/ErrorMessage/Input/Select/Textarea/Checkbox · Modal (focus trap, Escape, scrim, busy-safe async
`onOk`, 560/900, ok variant default/pri/ok/warn) · Popover (+ header/body/section/item) · Drawer · Toaster/`toast()` (single, 2.8s,
`role=status`) · LockBar · ReadOnlyBox · KeyValueList · Bar · SaveIndicator · ProgressTrack · BrandMark ·
Page/PageHeader (`rawEyebrow` for the dashboard date) · Icon (all reference icons + `send` for 건의하기) · TypeGlyph ·
ErrorDetails (server refusal message + `details`) · Pager (이전 / 다음) · `useServerError` (modal refusals: toast,
field messages cleared on edit, details). ListItem takes `extra` / `expanded` (accordion rows), Kpi an omitted
`tone` (no accent stripe).

Accessibility fixes over the reference (no visual change): tab title button is the `role=tab`
(`aria-selected`) with the close button as a sibling, `aria-current` on the active menu, `aria-selected` /
`aria-pressed` on sub tabs and segments, modal focus trap + focus return, labelled popovers, unread count in
the bell's accessible name, Escape/outside click closes the mobile menu.

## Not implemented yet / stubs

- Operator support access to customer contents, common (공통) datasets, mock template management (Phase 2).
- Dark theme (light only).

## PR order

PR1 foundation (tokens, fonts, shared/ui, API client, entities) → PR2 shell + auth pages → PR3 dashboard +
request list + read-only request detail (M0 part 2) → PR4 request authoring (M1) → PR5 assignment, review and
approval (M2 + approval part of M3) → PR6 completion results, archive and follow-ups (M3) → PR7 correction (M4) → PR8 work management + customer admin (M5 + M6) →
PR9 ops.
