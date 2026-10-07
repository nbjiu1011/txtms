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
| `./gradlew build` | compile + unit tests (policy and visibility, views, due dates, volume, password, session rules, submit validation, payload shape, SMS bytes, links, file signatures, malware stub, request ids, round/version rules, variable rules, XLSX row rules) | no |
| `./gradlew integrationTest` | `@Tag("integration")` tests against `txtms_test` (Flyway clean + migrate, demo seed, HTTP flows) | yes |

Write tests (`RequestAuthoringIntegrationTest`, `VariableIntegrationTest`, `BulkImportIntegrationTest`) create their own
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
- 5 consecutive failures for an email lock it for 15 minutes (`RATE_LIMITED`).

## Layout

```
com.txtms
├── global      config, security (JWT filter, session check), exception (ErrorCode, handler),
│               audit (AuditLogService), common (BaseEntity, paging, KST helpers, downloads),
│               storage (FileStorage + local-disk stub)
└── domain
    ├── auth          login, refresh, logout, Me, password reset, invitation tokens
    ├── customer      customers, customer users
    ├── project       projects, project/customer access scoping (ProjectAccess)
    ├── contenttype   content types, writing guides
    ├── request       requests, contents, versions, files, history; policy/RequestPolicy (allowedActions, views,
    │                 visibility); validation (payload shape, submit and XLSX rules); file (inspection, malware stub);
    │                 RequestCommandService / AttachmentService / BulkImportService (writes)
    ├── variable      project variables and their change log
    ├── dashboard     project dashboard, reviewer workload
    ├── notification  notifications (read vs. pending work)
    ├── notice        customer/project notices
    ├── mail          MailSender + outbox implementation
    └── demo          demo personas and seed data
```

The database schema for every planned feature is in `src/main/resources/db/migration/V1__init_schema.sql`;
`V2__request_authoring.sql` adds `requests.submit_idempotency_key`.

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
