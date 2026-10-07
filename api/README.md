# TX TMS API

Spring Boot 4.1 · Java 21 · MySQL 8 · Flyway · Spring Security (JWT access token + server session).

## Requirements

- JDK 21
- MySQL 8.0 binaries (default `C:\laragon\bin\mysql\mysql-8.0.31-winx64`; override with the `TXTMS_MYSQL_HOME` environment variable)

## Local database

A project-only MySQL instance runs on `127.0.0.1:3317` with its data in `api/.localdb/` (git-ignored).

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 start   # start (first run initializes it)
powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 status
powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 stop
powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 reset   # wipe and recreate
```

The first start creates the databases `txtms` (development) and `txtms_test` (integration tests), an application
account, and `api/.env` with random secrets:

| Variable | Meaning |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Development database |
| `TEST_DB_URL` | Integration test database |
| `JWT_SECRET` | HS256 signing key (base64, at least 256 bits) |

`application.yml` imports `.env` as properties; real deployments pass the same names as environment variables.

## Run

```bash
./gradlew bootRun            # dev profile: demo data, Swagger UI, CORS for http://localhost:3000
```

or

```bash
./gradlew bootJar
java -jar build/libs/api-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev
```

- Health: `GET http://localhost:8080/actuator/health`
- API docs (dev profile only): `http://localhost:8080/swagger-ui.html`, `http://localhost:8080/v3/api-docs`
- Flyway migrates the schema on start (`ddl-auto: validate`).

### Demo data

With `app.demo.enabled=true` (dev profile) an empty database is seeded with two sample customers (한빛카드 with
approval, 도담생명 without), three projects, twelve users and twelve requests covering every workflow state. All
dates are relative to the seeding moment, so "due soon" and "overdue" examples stay current. To reseed, recreate the
database (`dev-db.ps1 reset`, or drop and recreate `txtms`).

Correction datasets (`DemoDatasets`): one dataset per content type = the client sample dataset
(`src/main/resources/demo/correction-sample-dataset.xlsx`, a copy of `docs/교정엔진 샘플 데이터셋.xlsx`, 48 rules, not
type specific) + the prototype rules P1–P6 (all types) and the type's own (alimtalk P7–P8, SMS P9, RCS P10, free-form
P11). Assignments: 한빛카드 all four types (confirmed), 도담생명 alimtalk (confirmed), SMS and RCS (not confirmed);
도담생명 free-form stays unassigned to demonstrate `DATASET_NOT_ASSIGNED`.

The seeder only runs on an empty database (its bean always exists; the full seed checks `app.demo.enabled` at start,
and the operator's sample reset reuses it to write the seed requests again, see M7). To bring the datasets of an **existing** dev database up to the current
seed without recreating it, start the API once with `--app.demo.refresh-datasets=true` (demo mode only; any free port,
the running dev server can keep running), then stop it:

```bash
java -jar build/libs/api-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev --server.port=8091 --app.demo.refresh-datasets=true
```

`DemoDatasetRefresher` never changes or deletes dataset versions: per type it adds a new version when the latest one
differs from the seed, points the demo customers at the latest versions as planned (confirming where planned),
removes their `COMMON` and unplanned assignments, and audits every change as the demo operator. A second run changes
nothing. The shared dev database `txtms` was refreshed this way on 2026-10-07 (알림톡 v4, 문자/RCS/자유입력형 v2; the
old COMMON and type versions stay, unassigned).

Demo accounts log in without a password through `GET /api/auth/demo-personas` + `POST /api/auth/demo-login`.
For email login tests the dev profile also gives every demo account the password `Txtms!2026`
(`app.demo.default-password`). Example: `seoyeon.kim@hanbitcard.co.kr` (requester), `dohyun.lee@hanbitcard.co.kr`
(lead reviewer), `mina.choi@hanbitcard.co.kr` (approver), `minho.kang@hanbitcard.co.kr` (customer admin),
`woojin.jung@txtms.io` (operator). Demo mode must stay off in production; demo accounts cannot log in when it is off.

### Smoke test

```bash
curl -s http://localhost:8080/actuator/health
curl -s http://localhost:8080/api/auth/demo-personas
curl -s -c cookies.txt -H "Content-Type: application/json" -d '{"userId":1}' http://localhost:8080/api/auth/demo-login
# use the returned accessToken:
curl -s -H "Authorization: Bearer <accessToken>" "http://localhost:8080/api/requests?projectId=1"
curl -s -b cookies.txt -X POST http://localhost:8080/api/auth/refresh
```

## Tests

| Command | What runs | Needs the database |
|---|---|---|
| `./gradlew build` | compile + unit tests (operator customer rules, ops dashboard aggregation, project sending rules, outbox masking, policy and visibility, views, due dates, volume, password, session rules, submit validation, payload shape, SMS bytes, links, file signatures, malware stub, request ids, round/version rules, variable rules, XLSX row rules, review transitions, edit lock states, revision decisions, notification recipients and texts, completion/approval transitions, eligible approvers, bundle snapshot, export rows, lineage, archive filters, co-review summary, correction engine rules and every scenario of the client test-case sheet, dataset XLSX reader and row validation, correction fields, demo datasets, autosave conflict rule, performance statistics, re-notification rules, project role rules, deactivation rules) | no |
| `./gradlew integrationTest` | `@Tag("integration")` tests against `txtms_test` (Flyway clean + migrate, demo seed, HTTP flows) | yes |

Write tests (`RequestAuthoringIntegrationTest`, `VariableIntegrationTest`, `BulkImportIntegrationTest`, `ReviewWorkflowIntegrationTest`,
`CompletionIntegrationTest`, `CorrectionIntegrationTest`) create their own
customer, project and users with `IntegrationTestBase.newTenant()`, so the demo tenants that read tests count on stay
unchanged. Uploaded files of integration tests go to `build/it-storage`.

Integration tests wipe `txtms_test` at start. `TEST_DB_URL` can be overridden with an environment variable; the
task is never considered up to date, so it always runs against the current database.

## Authentication

- `POST /api/auth/login` returns `{ accessToken, me }` and sets the `txtms_refresh` cookie (httpOnly,
  SameSite=Strict, Path=/api/auth, Secure unless `app.auth.refresh-cookie-secure=false`).
- Access tokens live 15 minutes and are sent as `Authorization: Bearer`. `POST /api/auth/refresh` issues a new one.
- The server session is the source of truth: idle timeout 30 minutes, or 14 days from login with `remember`.
  Every authenticated request validates the session and the account/customer state.
- 5 consecutive failures for an email lock it for 15 minutes (`RATE_LIMITED`). `remember` is optional in the login
  body; over-long input (email > 255, password > 1,000 characters) is `VALIDATION_FAILED` and not counted.
- CSRF posture: every API call except refresh needs the bearer token (kept in memory by the web app), so a cookie
  alone cannot act. The refresh cookie is SameSite=Strict and `POST /api/auth/refresh` additionally refuses
  cross-site calls (`RefreshRequestGuard`: `Sec-Fetch-Site` other than `same-origin`/`none`, or a foreign/`null`
  `Origin`, unless the origin is `app.web-base-url`, a CORS origin or the API itself) with 403 and keeps the cookie.
  Login and the token endpoints accept JSON only (a cross-site form post gets 400).
- Invitation and reset links are single use even when submitted twice at once (token row read with a write lock).

## Layout

```
com.txtms
├── global      config, security (JWT filter, session check), exception (ErrorCode, handler),
│               audit (AuditLogService), common (BaseEntity, paging, KST helpers, downloads),
│               storage (FileStorage + local-disk stub)
└── domain
    ├── auth          login, refresh, logout, Me, password reset, invitation tokens (InvitationService)
    ├── customer      customers, customer users; CustomerAdminAccess (admin gate), settings, outbox, audit log
    ├── project       projects, project/customer access scoping (ProjectAccess), project admin and role rules
    ├── contenttype   content types, writing guides
    ├── request       requests, contents, versions, files, history; policy/RequestPolicy (allowedActions, views,
    │                 visibility); validation (payload shape, submit and XLSX rules); file (inspection, malware stub);
    │                 RequestCommandService / AttachmentService / BulkImportService (writes),
    │                 CompletionService / BundleExportService / ArchiveService (completion, exports, archive)
    ├── correction    text correction: engine/ (CorrectionEngine, CorrectionFields — pure), datasets and
    │                 assignments (DatasetService, XLSX reader, row validation), suggestions; ops controller
    ├── user          users; member admin (roles, invitations, email) and deactivation
    ├── variable      project variables and their change log
    ├── dashboard     project dashboard, reviewer workload, performance statistics
    ├── notification  notifications (read vs. pending work); re-notifications are written by request/ReminderService
    ├── notice        customer/project notices (reading and admin management)
    ├── mail          MailSender + outbox implementation, OutboxMasking (token links in listings)
    ├── ops           solution operator: customers, initial setup, setup log, samples, dashboard (OperatorAccess +
    │                 OpsAccessInterceptor on /api/ops/**)
    └── demo          demo personas and seed data (DemoDataSeeder also restores the seed requests for the sample reset)
```

The database schema for every planned feature is in `src/main/resources/db/migration/V1__init_schema.sql`;
`V2__request_authoring.sql` adds `requests.submit_idempotency_key`. The review milestone needs no migration (it uses
`request_assignment_changes`, `request_reminders`, `contents.lock_*` and `requests.answer_changed` from V1), nor does
the completion milestone (`completion_bundles`, `completion_bundle_items` and the per-content lineage columns
`contents.parent_request_id` / `parent_content_key` are in V1), nor does text correction (`datasets`, `dataset_rules`
with the seven engine columns, `dataset_assignments`, `correction_suggestions` are in V1).

## Not implemented yet (stubs)

- Mail delivery: `OutboxMailSender` only stores mails in `outbound_emails` (status `PENDING`).
- File storage: `LocalDiskFileStorage` writes attachments and card images to `app.storage.local-root` (default
  `storage/` under the working directory, git-ignored). Replace with object storage before production.
- Malware scanning: `DemoMalwareScanner` only flags the EICAR test string as `UNSAFE`. In demo mode the header
  `X-Demo-Scan-Outcome: SAFE|FAILED|UNSAFE` forces a result. It logs a warning at startup; replace with a real
  antivirus engine before production.

## Request authoring (M1)

| Area | Endpoints |
|---|---|
| Requests | `POST /api/requests`, `PATCH /api/requests/{id}`, `PUT /api/requests/{id}/type`, `POST /api/requests/{id}/clone` |
| Contents | `POST /api/requests/{id}/contents`, `DELETE`/`PUT /api/requests/{id}/contents/{key}` (draft autosave) |
| Workflow | `POST /api/requests/{id}/submit` (`rowVersion`, optional `Idempotency-Key`), `POST /api/requests/{id}/cancel` |
| Attachments | `POST .../contents/{key}/files`, `POST .../files/{fileId}/versions`, `PATCH`/`DELETE .../files/{fileId}`, `GET .../files/{fileId}/versions/{v}/download` |
| RCS images | `POST .../contents/{key}/images`, `GET /api/requests/{id}/images/{imageKey}` |
| XLSX bulk | `GET /api/content-types/{type}/bulk-template`, `POST /api/requests/{id}/bulk-import/preview`, `.../commit` (Apache POI) |
| Variables | `GET`/`POST /api/projects/{projectId}/variables`, `PATCH`/`DELETE /api/variables/{id}`, `GET /api/variables/{id}/logs` |

- Every request mutation locks the request row (`SELECT … FOR UPDATE`), re-checks visibility and the action with
  `RequestPolicy`, then writes history/notifications in the same transaction. Same-customer requests the user cannot
  see are `FORBIDDEN` (someone else's draft: `DRAFT_PRIVATE`); other customers and operators get `NOT_FOUND`.
- Validation lives in `domain/request/validation` (pure classes): `PayloadNormalizer` (strict payload shape + server
  caps on every autosave), `SubmitValidator` (submit rules with the screen wording), `BulkRowValidator`, `SmsBytes`,
  `Links`, `VariableTokens`. Limits are settings under `app.content`, `app.attachment`, `app.bulk`, `app.sms`.
- Request ids come from one atomic upsert on `request_sequences` (`REQ-{YYMM KST}-{seq}`, global counter).
- Blocked uploads are not stored but leave a `파일 등록 차단` history entry (written in its own transaction).

Smoke test (write path):

```bash
TOKEN=$(curl -s -H "Content-Type: application/json" \
  -d '{"email":"seoyeon.kim@hanbitcard.co.kr","password":"Txtms!2026","remember":false}' \
  http://localhost:8080/api/auth/login | jq -r .accessToken)
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"projectId":1,"type":"SMS"}' http://localhost:8080/api/requests        # 201, DRAFT with C1
# PATCH the request information and PUT /contents/C1 (send UTF-8 bodies from a file on Windows: --data-binary @body.json)
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: k1" \
  -d '{"rowVersion":1}' http://localhost:8080/api/requests/<id>/submit         # 200 WAITING or 400 with details
```

## Assignment and review (M2)

| Area | Endpoints |
|---|---|
| Assignment | `POST /api/requests/{id}/assignment` (lead, WAITING → IN_REVIEW), `PUT /api/requests/{id}/assignment` (lead, IN_REVIEW: reason + handover) |
| Schedule | `PATCH /api/requests/{id}/schedule` (`EDIT_DUE`: admin, lead, project approver; approval waiting: eligible approvers only) |
| Review | `POST /api/requests/{id}/opinions`, `POST /api/requests/{id}/asks` (IN_REVIEW → CONFIRMING), `POST /api/requests/{id}/asks/{askId}/answer` (→ IN_REVIEW) |
| Recall | `POST /api/requests/{id}/recall` (requester), `POST /api/requests/{id}/recall/decision` (`{ approve, comment }`, primary reviewer) |
| Locks | `POST`/`DELETE /api/requests/{id}/contents/{key}/lock`, `POST .../lock/force-release` (lead or customer admin) |
| Revisions | `POST /api/requests/{id}/contents/{key}/revisions` (`{ baseVersion, title?, payload, files? }`) |

- Services: `ReviewWorkflowService` (assignment, schedule, opinions, questions, recall), `ContentLockService` (locks),
  `ContentRevisionService` (revisions). Each locks the request row, re-checks `RequestPolicy` and `rowVersion`, and
  writes history (with the round), notifications and, for customer admins, audit records in the same transaction.
- State changes live on the `Request` entity (`assign`, `changeAssignment`, `requestRecall`, `approveRecall`,
  `rejectRecall`, `startConfirming`, `markAnswerChanged`, `resumeAfterAnswer`, `reschedule`). Pure rules:
  `EditLocks` (lock states), `RevisionPlanner` (version/round decision), `ReviewRecipients` (who is notified),
  `ReviewTexts` (history and notification wording).
- Rounds and versions: a revision opens a new content version only when title, payload or attachments (current file
  version and amounts) differ from the latest snapshot. A file revision upload keeps the content version; the next
  saved revision captures it. While the requester answers, a revision that changes the title or payload marks the
  answer, and the answer opens round + 1 (`재검수 시작`). `answer_changed` is excluded from optimistic locking so a
  saved revision does not invalidate the `rowVersion` the requester answers with.
- Locks expire 30 minutes after the last refresh. `LockExpiryJob` runs every minute and writes `편집 잠금 자동 해제`
  (system actor); disable it with `app.lock.release-job-enabled=false` (integration tests do, and call
  `ContentLockService.releaseExpired()` directly). Reads already hide expired locks.
- Asking releases every reviewer lock, answering releases the requester's locks, a reviewer change releases the
  removed reviewers' locks (all logged as `편집 잠금 해제`), an approved recall releases every lock.

## Completion, approval and archive (M3)

| Area | Endpoints |
|---|---|
| Workflow | `POST /api/requests/{id}/complete` (primary reviewer), `POST .../approve`, `POST .../revise` (`{ reason, contentKey, location?, expectation }`, eligible approver) |
| Results | `RequestDetail.bundle`, `GET /api/requests/{id}/bundle/export.xlsx`, `GET .../bundle/attachments.zip`, `POST .../bundle/copy-events` (`{ contentKey }`) |
| Follow-up | `POST /api/requests/{id}/follow-up` (`{ contentKey }` or empty for the whole bundle) |
| Archive | `GET /api/archive/contents?projectId=…` (`q`, `type`, `campaign`, `status`, `completedFrom`, `completedTo`, paging), `GET /api/archive/campaigns?projectId=…` |
| Review info | `GET /api/requests/{id}/assignment-changes`, `RequestDetail.coReviewers` (completion dialog) |

- `CompletionService` runs complete/approve/revise. Completion checks, in order: eligible approver (approval
  customers), other users' valid locks (`LOCKED_BY_OTHER`), the submit rules on the final contents, then releases the
  remaining locks. Without approval the request is final (`REVIEW_COMPLETED`); with approval it waits
  (`APPROVAL_WAITING`) and an eligible approver approves (`APPROVED`) or sends it back (`IN_REVIEW`, round + 1).
- No eligible approver: the completion transaction writes `승인 대기 전환 차단` and the notifications (admins: approver
  needed, requester + lead: delay), **commits**, and only then the API answers 409 `NO_ELIGIBLE_APPROVER`
  (`TransactionTemplate` in the service; the row lock is released at that commit). Every attempt is logged, but a
  recipient who already got the same notice about the request within 24 hours is skipped
  (`NotificationService.notifyOnce`, `CompletionService.NO_APPROVER_NOTICE_WINDOW`).
- Final completion freezes the bundle (`CompletionBundles`): every current content with its version, payload and the
  FileMeta array of its current attachments, plus the project's active variables. Previews, exports and the archive
  resolve variables with these frozen values.
- Exports (`BundleExportService`): XLSX (`BundleSheet`, 10 columns, sheet `완료본`, `{id}_완료본.xlsx`), ZIP streamed
  file by file (`{key}/v{n}_{name}` + `완료_버전_명세.json` with sizes and SHA-256, `{id}_첨부_완료본.zip`). A ZIP whose
  frozen file has no stored object (seeded demo files) is refused as a whole with `NOT_FOUND`. Audits: `완료본 반출`
  (`XLSX`, `문안 복사 {key}`) and `첨부 반출` (`ZIP`) with the customer id. Copy events are accepted for finally
  completed requests only (`EXPORT`, otherwise 409). XLSX cells that start with `= + - @`, tab or CR get the
  quote-prefix style (stay text when edited; value unchanged); ZIP entry names drop separators and control characters.
- Follow-ups copy the bundle items (frozen file version → new file v1 sharing the stored object, card images copied)
  and record the source of each new content in `contents.parent_request_id` / `parent_content_key`. The archive
  (`ArchiveService`, pure rules in `ContentLineage` and `ArchiveLines`) groups completed contents by the root of that
  lineage, shows the latest completion first and applies the filters to it.

Smoke test (completion path, approval not used; send UTF-8 bodies from files on Windows):

```bash
curl -s -H "Authorization: Bearer $REVIEWER_TOKEN" -H "Content-Type: application/json" \
  -d '{"rowVersion":5}' http://localhost:8080/api/requests/<id>/complete          # 200 REVIEW_COMPLETED + bundle
curl -s -o out.xlsx -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/requests/<id>/bundle/export.xlsx
curl -s -o out.zip  -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/requests/<id>/bundle/attachments.zip
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/archive/contents?projectId=1"
```

## Text correction and datasets (M4)

| Area | Endpoints |
|---|---|
| Request | `GET /api/requests/{id}/corrections/dataset`, `POST .../corrections/check` (`{ contents: [{ contentKey, payload, hasFiles }] }`), `POST .../corrections/events` (`APPLY`/`RESTORE` history), `POST .../corrections/suggestions` |
| Operator | `GET`/`POST /api/ops/datasets` (JSON `{ scope, rules }` or multipart `scope` + XLSX `file`), `GET /api/ops/datasets/{id}`, `GET /api/ops/dataset-assignments`, `PUT`/`DELETE /api/ops/customers/{id}/dataset-assignments/{type}`, `POST .../{type}/confirm` |
| Contract §14 | `POST /api/requests/{id}/submit-check`, `RequestDetail.nextSubmitRound`, autosave `expectedSavedAt` absent/null/value, `FILE_UNSAFE` / `FILE_SCAN_FAILED` |

- `CorrectionEngine` (pure, `domain/correction/engine`) implements the engine specification V0.5 as summarized in
  actions.md §6.7: ① original expressions ② recommended expressions (protectors) ③ patterns → drop candidates
  properly contained in a longer span (equal spans stay) → drop candidates equal to their recommendation → group by
  span (1:N). Case-sensitive, Java `Pattern` without flags, `$N`/`\N` references, `-`/empty = description only,
  blank text not run, UTF-16 indices, 200 ms budget per pattern rule and field (`app.correction.rule-timeout`).
  Engines are compiled once per dataset version and cached (versions never change).
- One dataset per customer × content type (Phase 1; `COMMON` stays in the enum but is neither registered nor assigned).
  A new registration is always a new version of the scope; assignment changes clear the confirmation. All operator
  writes are audited (`교정 데이터셋 시드 등록`, `유효 데이터셋 배정/변경/해제/확인`).
- Check: view permission (any viewer may run the read-only check, as in the prototype; operators and other
  customers `NOT_FOUND`), buffer payload checked like an autosave, free-form contents with attachments (buffer flag or
  stored files) are `excluded`, results are not stored. Events need `EDIT_CONTENT`; suggestions `EDIT_CONTENT` or
  `REVIEW` (stored in `correction_suggestions` with the optional `suggestedExpr` ≤ 200, Phase 2 processing). Events
  take an optional `ruleId` (≤ 50) appended to the history detail as ` ({ruleId})`. `RequestDetail.variablesRevision`
  carries the project's variables revision (contract §14.4).
- Tests: `CorrectionEngineTest` (spec rules one by one), `CorrectionScenarioTest` (every scenario of
  `docs/텍스트 교정 테스트 케이스&시나리오_260714.xlsx` against the sample dataset; deviations noted per case),
  `DatasetImportTest`, `CorrectionFieldsTest`, `CorrectionIntegrationTest`, `DemoDatasetRefresherIntegrationTest`.

Smoke test (correction path, send UTF-8 bodies from files on Windows):

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/requests/REQ-2609-105/corrections/dataset
# {"assigned":true,"datasetLabel":"알림톡 v4"}
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @check.json \
  http://localhost:8080/api/requests/REQ-2609-105/corrections/check     # groups: 할수 → 할 수 (P3)
curl -s -H "Authorization: Bearer $OPERATOR_TOKEN" -F scope=SMS -F file=@rules.xlsx http://localhost:8080/api/ops/datasets
```

## Work management (M5)

| Area | Endpoints |
|---|---|
| Performance | `GET /api/performance?customerId=…` (`projectId`, `from`, `to` KST dates inclusive, `userId`) |
| Notices | `GET /api/notices?customerId=…` (reading), `GET /api/customers/{id}/notices/manage`, `POST /api/customers/{id}/notices`, `PATCH /api/notices/{id}`, `POST /api/notices/{id}/withdraw` |
| Locks (contract §14.2) | `POST …/contents/{key}/lock` answers `{ userId, lockedAt, expiresAt, version }`, `GET /api/requests/{id}/locks`, `RequestSummary.approvable` |

- `PerformanceService` picks the projects (lead: projects they lead; customer admin: every project of the customer;
  one `projectId` must be led or administered), `PerformanceCalculator` (pure) applies the rules: demo, cancelled and
  current drafts excluded; received = `submittedAt` in the KST period (a recalled request keeps its first submission,
  so it is one request); rate = final now ÷ received with one decimal, `null` for zero; people rows use both period
  bounds; the workload covers every selected project (`DashboardService.workloadRows` takes several projects).
- Re-notification: `ReminderService` (rules in the pure `ReminderRules`, actions.md §8.3) runs every minute through
  `ReminderJob` (`app.reminder.job-enabled`, `interval` 24h, `max-count` 3). Each request is handled in its own
  transaction under its row lock; state lives in `request_reminders` (a due date change deletes it). The third urgent
  reminder is also mailed when the customer's channel is `IN_APP_EMAIL`. Integration tests disable the job and call
  `ReminderService.run(filter)` with the adjustable clock.
- Audit retention: `AuditRetentionService.purgeExpired()` deletes access/export records (`요청 조회`, `파일 다운로드`,
  `완료본 반출`, `첨부 반출`) older than `app.audit.retention.days` (1095). The daily `AuditRetentionJob`
  (`app.audit.retention.cron`, KST) is off by default (`app.audit.retention.enabled=false`, client agreement 17).
- Notices: every admin write is audited (`공지 게시`, `공지 수정`, `공지 철회`); edits and withdrawals keep the full
  previous snapshot (scope, project, title, body) and the actor in `notice_logs`. Lists are capped at 500.
- Due soon / urgent: KST calendar days — a due date at most `dueSoonDays` days after today's KST date (D-3 이내 =
  D-3…D-day) and not yet overdue (`DueStatus.dueSoon`, `ReminderRules.urgent` includes overdue). Dashboards: the
  requester KPI row ends with `DUE_SOON` (own requests); reviewers have `MY_ASSIGNED_CONFIRMING` (기획서 8.3).
- Scale limits (documented, not paged in the database): the request list, dashboard, archive, performance and
  deactivation impact load the visible requests of the project (or customer) and filter in memory so KPI counts and
  lists share one predicate. Responses are paged (size ≤ 100) or capped (todos 100, recent 6, small lists 500); the
  scan itself is fine up to a few thousand requests per project. Beyond that, move the predicates to queries
  (docs/IMPROVEMENTS.md P2).

## Customer admin (M6)

| Area | Endpoints |
|---|---|
| Projects | `POST /api/customers/{id}/projects`, `PATCH /api/projects/{id}` (`name`, `leadUserId`, `approverIds`, `active`) |
| Members and roles | `GET /api/customers/{id}/members`, `PUT /api/customers/{id}/users/{userId}/project-roles` |
| Invitations | `POST /api/customers/{id}/invitations`, `POST …/users/{userId}/invitation/reissue`, `PATCH …/users/{userId}/email` |
| Deactivation | `GET …/users/{userId}/deactivation-impact`, `POST …/users/{userId}/deactivate` (`substituteUserId`, `handover`), `POST …/users/{userId}/reactivate` |
| Customer | `PATCH /api/customers/{id}/settings`, `GET /api/customers/{id}/outbox`, `GET /api/customers/{id}/audit-logs` |

- `CustomerAdminAccess` is the single gate: admins of the customer only; same-customer users and operators get
  `FORBIDDEN` ("고객사 관리자 권한이 필요합니다"), anyone else `NOT_FOUND`.
- Services: `ProjectAdminService`, `MemberAdminService` (roles, invitations, email), `UserDeactivationService`,
  `CustomerSettingsService`, `InvitationService` (auth domain: revoke unused links, 7-day token stored as SHA-256,
  outbox mail `TX TMS 초대` with `{web}/invite/{token}`; acceptance is the existing token endpoint). Pure rules:
  `ProjectRoleRules` (requester/reviewer exclusivity, lead keeps the reviewer role, assigned reviewers and the last
  active approver keep their roles) and `DeactivationRules` (self, last admin, confirming/approval assignments,
  own requests in progress, last approver, substitute and handover).
- Invitations and email changes outside the customer's domain need `externalDomainConfirmed: true`, otherwise 409
  `EXTERNAL_DOMAIN_CONFIRM_REQUIRED`.
- Deactivation runs in one transaction: in-review assignments go to the substitute
  (`ReviewWorkflowService.handOverOnDeactivation`: history `검수자 변경`, locks released and logged, substitute and
  requester notified), led projects get the substitute as lead, the account becomes inactive and its sessions end.
- Every admin write is audited: `프로젝트 생성/변경`, `역할 변경`, `사용자 초대`, `초대 재발급`, `사용자 이메일 변경`,
  `사용자 비활성화`, `사용자 재활성화`, `고객사 설정 변경`.
- Outbox listings mask invitation and reset links (`…/invite/••••` + `링크는 수신자에게만 전달됩니다`, `masked: true`):
  a customer admin could otherwise take over the recipient's account. The stored mail keeps the full body. Full links
  are listed only in demo mode for a sample customer's admin (demo invitation flow) and, in demo mode, for the
  operator (`OutboxMasking`). Tests read tokens from `outbound_emails`, like a mailbox.
- Tests: `PerformanceCalculatorTest`, `ReminderRulesTest`, `ProjectRoleRulesTest`, `DeactivationRulesTest` (unit);
  `CustomerAdminIntegrationTest`, `NoticeIntegrationTest`, `PerformanceIntegrationTest`, `ReminderIntegrationTest`,
  `LockStateIntegrationTest` (each on its own tenant).

Smoke test (customer admin, send UTF-8 bodies from files on Windows):

```bash
ADMIN=$(curl -s -H "Content-Type: application/json" \
  -d '{"email":"minho.kang@hanbitcard.co.kr","password":"Txtms!2026","remember":false}' \
  http://localhost:8080/api/auth/login | jq -r .accessToken)
curl -s -H "Authorization: Bearer $ADMIN" http://localhost:8080/api/customers/1/members
curl -s -H "Authorization: Bearer $ADMIN" "http://localhost:8080/api/performance?customerId=1&from=2026-09-01&to=2026-10-31"
curl -s -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" --data-binary @invite.json \
  http://localhost:8080/api/customers/1/invitations                  # 201 Member (pending), mail in the outbox
curl -s -H "Authorization: Bearer $ADMIN" "http://localhost:8080/api/customers/1/outbox?size=1"
curl -s -H "Authorization: Bearer $ADMIN" "http://localhost:8080/api/customers/1/audit-logs?size=5"
```

## Solution operator (M7)

| Area | Endpoints |
|---|---|
| Dashboard | `GET /api/ops/dashboard` (KPIs, remaining setup steps with web route keys, customer rows, 6 newest audits) |
| Customers | `GET`/`POST /api/ops/customers`, `POST /api/ops/customers/{id}/deactivate` (`{ reason }`), `POST …/reactivate` |
| Initial setup | `POST /api/ops/customers/{id}/projects` (`{ name, leadUserId? }`), `POST …/invitations` (`{ email, name, dept, admin, projectId, role, externalDomainConfirmed }`), `PUT /api/ops/projects/{id}/templates` (`[{ code, name }]`), `PUT /api/ops/projects/{id}/senders` (`[string]`), `GET /api/ops/setup-logs?customerId=` |
| Content types | `GET /api/ops/content-types`, `PATCH /api/ops/content-types/{type}` (`{ active }`) |
| Sample data | `GET`/`POST /api/ops/customers/{id}/sample-requests`, `DELETE …/sample-data`, `POST /api/ops/sample-reset` |
| Logs | `GET /api/ops/audit-logs` (`customerId`, paging), `GET /api/ops/outbox` (paging) |
| Datasets (M4) | `/api/ops/datasets`, `/api/ops/dataset-assignments`, `/api/ops/customers/{id}/dataset-assignments/{type}` |

- Access: `OpsAccessInterceptor` checks every `/api/ops/**` handler (403 `운영 담당자 권한이 필요합니다`, the reset
  `시연 데이터 초기화는 솔루션 운영 담당자만 실행할 수 있습니다`); services check again with `OperatorAccess`.
  Operators still get `NOT_FOUND` on request APIs; the operator API gives request counts only.
- Services (`domain/ops/service`): `OpsCustomerService` (list, dashboard, create with the default project
  `기본 프로젝트`, deactivate/reactivate), `OpsSetupService` (projects, invitations via
  `MemberAdminService.inviteForSetup`, templates/senders via `ProjectAdminService`, content types),
  `OpsSampleService` (samples, cleanup, reset), `OpsLogService`, `SetupLogService` (`setup_logs`). Pure rules:
  `CustomerRules` (name, normalized domain, reason), `OpsDashboardRules` (KPIs and steps), `ProjectSendingRules`
  (template codes, Korean sender numbers).
- Deactivation refuses customers with requests in progress, ends the sessions of the customer's users (next call
  401) and blocks sign-in until reactivation. Setup writes need an active customer.
- `admin: true` invitations grant the customer admin right at once; it takes effect when the invitation is accepted
  (pending accounts cannot sign in). External domains need `externalDomainConfirmed`.
- New projects get Alimtalk templates and SMS sender numbers only from the operator; the submit check compares
  contents with these lists (audit `프로젝트 발신 정보 변경`).
- Samples (`requests.demo`): sample customers only. A sample is a draft `[샘플] {유형} 작성 연습` whose author is
  the project's first active requester (else the operator); clones and follow-ups of samples are samples too.
  `SampleRequestService.purge` deletes requests with every child row and, after the commit, stored objects no
  remaining row references. The reset (`POST /api/ops/sample-reset`) purges every request of every sample customer and
  `DemoDataSeeder.reseedSampleRequests` writes the 12 seed requests of 한빛카드/도담생명 again (fixed ids, now-relative
  times, history, bundles, seed notifications) in one transaction; customers that are not samples are never selected.
- Audits: `고객사 생성/비활성/사용 재개`, `프로젝트 생성`, `사용자 초대`, `프로젝트 발신 정보 변경`, `콘텐츠 유형 변경`,
  `샘플 요청 생성`, `샘플 데이터 초기화`, `샘플 초기화`. `AuditLog` entries carry `actorName`.
- Tests: `CustomerRulesTest`, `OpsDashboardRulesTest`, `ProjectSendingRulesTest`, `OutboxMaskingTest` (unit);
  `OpsIntegrationTest` (onboarding up to an Alimtalk submission, deactivation, content types, sample cleanup with a
  shared stored object, the reset with a dedicated sample tenant and a non-sample tenant that must stay unchanged).
  The reset test restores the demo tenants to their seed, which the read tests count on.

Smoke test (operator, send UTF-8 bodies from files on Windows):

```bash
OP=$(curl -s -H "Content-Type: application/json" \
  -d '{"email":"woojin.jung@txtms.io","password":"Txtms!2026","remember":false}' \
  http://localhost:8080/api/auth/login | jq -r .accessToken)
curl -s -H "Authorization: Bearer $OP" http://localhost:8080/api/ops/dashboard
curl -s -H "Authorization: Bearer $OP" -H "Content-Type: application/json" --data-binary @customer.json \
  http://localhost:8080/api/ops/customers                               # 201 OpsCustomer + 기본 프로젝트
curl -s -H "Authorization: Bearer $OP" -H "Content-Type: application/json" --data-binary @admin-invite.json \
  http://localhost:8080/api/ops/customers/<id>/invitations             # 201 Member (admin, pending)
curl -s -X PUT -H "Authorization: Bearer $OP" -H "Content-Type: application/json" -d '["1588-0000"]' \
  http://localhost:8080/api/ops/projects/<projectId>/senders
```
