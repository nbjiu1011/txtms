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

API mocks for the harness come from `e2e/fixtures/`:
- `api-snapshot.ts` — contract-shaped responses captured from the demo API (generated; typed exports such as
  `dashboardU1: Dashboard` are type-checked against `entities`, so contract drift fails `typecheck`).
  Regenerate with `node e2e/fixtures/capture-api.mjs [http://localhost:8080]` while the API runs in demo mode.
- `mock-api.ts` — `mockApiAs(page, userId)`: refresh returns that persona, GETs answer from the snapshot
  (query order ignored), anything else is 404/405. Unit tests import the same fixtures via `@fixtures/*`.

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
├─ features/       auth (login, demo personas, reset request, token password, session), profile-edit
├─ entities/       me, customer, project, user, request, variable, correction, dashboard,
│                  notification, notice, audit, ops — contract types + label maps (+ small queries)
└─ shared/         api (http client, ApiError, query client/keys), config (env, routes), lib, ui (kit + icons)
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
| `/` | done — role dashboard (`GET /api/projects/{id}/dashboard`): today (KST), pipeline + stage modal (`status=`), KPI tiles + list modal (same `view`, `customerId` for customer views), 지금 처리할 일, 최근 요청, 검수자별 업무량 (lead), 공지 (static rows). Operators: placeholder until the ops dashboard |
| `/requests` | done — all reference filters (title/ID search debounced 250ms), table, recall/후속/긴급/지연 tags, empty / loading / error / no-permission states |
| `/requests/{id}` | done (read-only) — header (breadcrumb, chips, round, tags, meta, status track, sub tabs), banners, work grid (content list, type editors in disabled state, lock bar / read-only reason, guide drawer, version compare), side panel (교정 frame, 미리보기 mockups, 의견, 확인 요청), 요청 정보 (read-only), 히스토리 (merged, round separators, filter), 완료 결과 (bundle, XLSX/ZIP export, copy, variables). Not-found / denied states |
| `/requests/{id}/contents/{key}` | done (read-only) — content header + two-column work grid |
| other routes | not listed in menus; direct URL shows "아직 제공되지 않는 화면입니다" |

### Read-only workflow (M0)

- Header buttons render only for actions that are in the request's `allowedActions` **and** in
  `IMPLEMENTED_ACTIONS` (`entities/request/model/actions.ts`, empty in M0). Later milestones add actions
  there together with their flows; nothing pretends to succeed.
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

- All request mutations (create, edit, workflow actions, opinions, asks, uploads) — M1–M3.
- Correction engine and result cards (panel frame only) — M4.
- Variable values in previews until `GET /api/projects/{id}/variables` exists (tokens shown as chips).
- Review, approval, contents archive, performance, notices, admin and ops screens.
- Dark theme (light only).

## PR order

PR1 foundation (tokens, fonts, shared/ui, API client, entities) → PR2 shell + auth pages → PR3 dashboard +
request list + read-only request detail (M0 part 2) → PR4… workflow screens.
