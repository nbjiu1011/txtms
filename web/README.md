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
  dashboard (u1, u3, u11), request list (u1), REQ-2609-101 as u2 (contents, preview, opinions, history),
  REQ-2609-103 as u4 (approval waiting), REQ-2609-088 as u1 (result tab). Prints the share of differing
  pixels per screen (1440×900: 0.4–2.3%). Intended differences are listed in the file header.

- `draft.visual.ts` — draft editing as 김서연 (REQ-2609-105): contents tab (0.67%), 요청 정보 (0.30%),
  미리보기 (0.33%), the submit missing-items modal (0.00%) and the submit confirmation (taller on purpose: it
  carries the "텍스트 교정은 선택 사항입니다" note). Other intended differences: menus of unbuilt screens, the
  correction check buttons, the prototype-only "첨부 검사 시연" panel.

API mocks for the harness come from `e2e/fixtures/`:
- `api-snapshot.ts` — contract-shaped responses captured from the demo API (generated; typed exports such as
  `dashboardU1: Dashboard` are type-checked against `entities`, so contract drift fails `typecheck`).
  Regenerate with `node e2e/fixtures/capture-api.mjs [http://localhost:8080]` while the API runs in demo mode.
- `draft-snapshot.ts` — REQ-2609-105 (detail + history) and the project 1 variables, captured from the API.
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

Against the real API: `API_ORIGIN=http://localhost:8080 npm run dev`, then sign in with a demo persona.
If a dev server already runs, `VISUAL_PORT=3000 npm run e2e:visual` reuses it.

## Structure (Feature-Sliced Design)

```
src/
├─ app/            routing only: (auth)/login, (auth)/invite/[token], (auth)/reset/[token],
│                  (app)/layout.tsx + (app)/[[...slug]] (renders nothing; the shell renders views),
│                  globals.css (tokens), providers.tsx
├─ views/          login, token-password, dashboard, request-list, request-detail (+ content tab), profile
├─ widgets/        app-shell (sidebar, top bar, work tabs, popovers, tab store), auth-layout (login hero)
├─ features/       auth (login, demo personas, reset request, token password, session), profile-edit,
│                  request-create, request-workflow (submit/cancel), variable-picker, bulk-import
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
| `/profile` | done — name/department (`PATCH /api/me`), logout |
| `/` | done — `+새 요청` (requesters), role dashboard (`GET /api/projects/{id}/dashboard`): today (KST), pipeline + stage modal (`status=`), KPI tiles + list modal (same `view`, `customerId` for customer views), 지금 처리할 일, 최근 요청, 검수자별 업무량 (lead), 공지 (static rows). Operators: placeholder until the ops dashboard |
| `/requests` | done — `+새 요청` (requesters), all reference filters (title/ID search debounced 250ms), table, recall/후속/긴급/지연 tags, empty / loading / error / no-permission states |
| `/requests/{id}` | draft authoring (below), other states read-only — header (breadcrumb, chips, round, tags, meta, status track, sub tabs), banners, work grid (content list, type editors in disabled state, lock bar / read-only reason, guide drawer, version compare), side panel (교정 frame, 미리보기 mockups, 의견, 확인 요청), 요청 정보 (read-only), 히스토리 (merged, round separators, filter), 완료 결과 (bundle, XLSX/ZIP export, copy, variables). Not-found / denied states |
| `/requests/{id}/contents/{key}` | content header + two-column work grid (draft content editable, autosave) |
| other routes | not listed in menus; direct URL shows "아직 제공되지 않는 화면입니다" |

### Request authoring (M1)

- Header buttons render only for actions that are in the request's `allowedActions` **and** in
  `IMPLEMENTED_ACTIONS` (`entities/request/model/actions.ts`: `EDIT_REQUEST`, `EDIT_CONTENT`, `SUBMIT`, `CANCEL`,
  `CLONE`). Editing is enabled for drafts only; revision editing during review comes with the review screens.
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
- **Submit** (`features/request-workflow`): saves pending edits, confirms (target lead reviewer), then
  `POST …/submit` with `rowVersion` and an `Idempotency-Key`; `VALIDATION_FAILED` shows the missing-items list
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

## shared/ui components

Button (default/pri/ok/warn/ghost, sm) · IconButton (badge) · Tag (hot/flag/recall/fill) · StatusChip ·
TypeChip · RoundBadge · Avatar · AvatarStack · Banner (ask/info/danger/done/appr/wait) · Panel/PanelHeader/
PanelBody · Table (+ `tableClasses`) · KpiGrid/Kpi · SubTabs · Seg · ListItem · Empty (+ EmptyArt) · Field/
Label/Hint/ErrorMessage/Input/Select/Textarea/Checkbox · Modal (focus trap, Escape, scrim, busy-safe async
`onOk`, 560/900) · Popover (+ header/body/section/item) · Drawer · Toaster/`toast()` (single, 2.8s,
`role=status`) · LockBar · ReadOnlyBox · KeyValueList · Bar · SaveIndicator · ProgressTrack · BrandMark ·
Page/PageHeader (`rawEyebrow` for the dashboard date) · Icon (all reference icons) · TypeGlyph.

Accessibility fixes over the reference (no visual change): tab title button is the `role=tab`
(`aria-selected`) with the close button as a sibling, `aria-current` on the active menu, `aria-selected` /
`aria-pressed` on sub tabs and segments, modal focus trap + focus return, labelled popovers, unread count in
the bell's accessible name, Escape/outside click closes the mobile menu.

## Not implemented yet / stubs

- Review-stage mutations (assignment, edit lock + revisions, opinions, asks, recall, completion, approval).
- Correction engine and result cards (panel frame only) — M4.
- Review, approval, contents archive, performance, notices, admin and ops screens.
- Dark theme (light only).

## PR order

PR1 foundation (tokens, fonts, shared/ui, API client, entities) → PR2 shell + auth pages → PR3 dashboard +
request list + read-only request detail (M0 part 2) → PR4 request authoring (M1) → PR5… review / approval.
