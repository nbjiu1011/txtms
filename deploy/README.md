# 배포

GitLab CI/CD가 브랜치에 따라 서버에 배포합니다.

| 브랜치 | 환경 | 서버 | 실행 |
|---|---|---|---|
| `dev` | development | 개발 서버 112.160.125.11 (러너 태그 `txtms-dev`) | push 시 자동 |
| `main` | production | 운영 서버 (러너 태그 `txtms-prod`) | 파이프라인에서 ▶ 버튼으로 수동 |

## 파이프라인 동작

잡은 환경마다 하나(`deploy:dev` / `deploy:prod`)입니다.

1. GitLab File 변수 `ENV_FILE` → `deploy/.env` (필수 키 확인, 비밀이 아닌 값만 로그에 출력)
2. `docker compose build` — api·web 이미지를 서버에서 병렬로 빌드
3. `docker compose up -d --wait` — 바뀐 컨테이너만 교체하고, 헬스체크(API는 DB 연결 포함)가 통과할 때까지 대기. 실패하면 로그를 남기고 잡이 실패합니다.
4. 롤백용 SHA 태그를 붙이고 오래된 이미지를 정리 (서비스별 최근 3개 유지)

빠르게 끝나도록 다음을 뺐습니다.

- 별도 검증(verify)·빌드 단계와 CI 안의 테스트 실행 — **push 전에 로컬에서 검증합니다** (아래).
- 레지스트리 push/pull — 이미지를 배포 서버에서 바로 빌드합니다.

그리고 캐시를 씁니다.

- 바뀌지 않은 서비스는 도커 레이어 캐시로 빌드를 건너뜁니다. 웹만 바꾼 커밋은 API를 다시 빌드하지 않고, 테스트 파일만 바꾼 커밋은 아무것도 다시 빌드하지 않습니다.
- Gradle·npm·Next 빌드 캐시는 BuildKit 캐시 마운트로 서버에 남습니다.

### push 전 검증

```bash
cd api && ./gradlew test integrationTest
cd web && npm run lint && npm run typecheck && npm run test
```

## 서버 최초 세팅 (서버마다 1회)

필요한 것: Docker Engine 24 이상(Compose v2 플러그인 포함), GitLab Runner, Apache. 서버에 JDK·Node는 필요 없습니다(빌드는 컨테이너 안에서 합니다).

### 1. GitLab Runner

GitLab 프로젝트의 `Settings > CI/CD > Runners`에서 러너를 만들고 토큰을 받아 서버에서 등록합니다.

```bash
# 개발 서버(112.160.125.11)는 txtms-dev, 운영 서버는 txtms-prod
sudo gitlab-runner register \
  --url <GitLab 주소> \
  --token <러너 토큰> \
  --executor shell
# 태그는 러너를 만들 때 GitLab 화면에서 지정합니다 (txtms-dev / txtms-prod).

sudo usermod -aG docker gitlab-runner
sudo systemctl restart gitlab-runner
```

### 2. GitLab 변수 `ENV_FILE`

`Settings > CI/CD > Variables > Add variable`에서 같은 키를 환경 범위별로 두 번 등록합니다.

| Key | Type | Environment scope | Protect | 내용 |
|---|---|---|---|---|
| `ENV_FILE` | File | `development` | 끔 | [`.env.example`](.env.example)을 개발 값으로 채운 것 |
| `ENV_FILE` | File | `production` | 켬 | 같은 형식을 운영 값으로 채운 것 |

- **Type은 File**이어야 합니다. Variable 타입이면 잡이 "파일 경로가 아니다"로 멈춥니다.
- **Protected 변수는 보호 브랜치에만 주입됩니다.** `dev`가 보호 브랜치가 아니면 개발용 변수의 Protect를 꺼야 합니다. 켜 두면 등록 화면에는 보이지만 잡에는 빈 값으로 넘어옵니다. `main`은 보호 브랜치로 두고 운영 변수는 Protect를 켭니다.
- 환경 범위를 쓸 수 없는 GitLab이면 범위 `*`로 하나만 등록하고 브랜치 보호로 나눕니다.
- `COMPOSE_PROJECT_NAME`·포트는 적지 않습니다. 파이프라인이 붙입니다.
- 값에 따옴표를 쓰지 않습니다. `$`는 `$$`로 적습니다.
- 개발 서버는 `DEMO_ENABLED=true`로 데모 계정 로그인을 켭니다. 운영은 `false`입니다.

### 3. Apache (리버스 프록시 + TLS)

컨테이너 포트는 127.0.0.1에만 열립니다. 바깥 요청은 Apache가 받아 넘깁니다.

```bash
sudo a2enmod proxy proxy_http headers ssl
sudo cp apache/txtms-web.conf apache/txtms-api.conf /etc/apache2/sites-available/
sudo a2ensite txtms-web txtms-api
sudo apachectl configtest && sudo systemctl reload apache2
sudo certbot --apache -d txtms.tagoplus.co.kr -d txtms-api.tagoplus.co.kr
```

이미 같은 도메인의 vhost가 있으면 `ProxyPass` 대상이 `127.0.0.1:4246`(웹) / `127.0.0.1:4245`(API)인지, `retry=0`이 있는지만 확인합니다. 운영 도메인은 파일의 `ServerName`을 바꿔서 씁니다.

## 운영

배포 디렉터리는 러너 작업 폴더의 `deploy/`입니다. 스택 이름은 개발 `txtms-dev`, 운영 `txtms`입니다.

```bash
docker compose -p txtms-dev ps
docker compose -p txtms-dev logs -f --tail=200 api

# 롤백: 남겨 둔 SHA 태그로 되돌린 뒤 같은 스택을 다시 올립니다 (deploy/ 에서)
docker images txtms-dev-api
docker tag txtms-dev-api:<sha> txtms-dev-api:latest
docker compose up -d --no-build
```

- 첨부파일은 도커 볼륨 `<스택>_storage`에 저장되어 재배포해도 유지됩니다.
- API 메모리 상한은 기본 1 GB, 웹은 768 MB입니다. `ENV_FILE`에 `API_MEM_LIMIT`·`WEB_MEM_LIMIT`로 바꿉니다.
