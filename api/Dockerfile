# txtms-api — Spring Boot 4 / Java 21
#
# Built on the deploy server by the CI job. Speed comes from two things:
#   - only src/main is copied, so a test-only commit leaves this image untouched (full layer cache hit);
#   - the Gradle home is a BuildKit cache mount, so dependencies and the wrapper distribution are
#     downloaded once per server, not once per build.
# Tests are not run here; run them before pushing (README).

# ─── build ──────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
COPY src/main ./src/main

# `sh gradlew`: the execute bit can be lost when the repository is touched on Windows.
RUN --mount=type=cache,id=txtms-gradle,target=/root/.gradle \
    sh gradlew bootJar --no-daemon --quiet \
 && cp "$(ls build/libs/*.jar | grep -v -- '-plain\.jar$')" /src/app.jar

# ─── runtime ────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Non-root user. The storage directory is created and handed over here: /app is root-owned, so the
# user could not create it on the first upload.
RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /app/storage && chown app:app /app/storage

COPY --from=build --chown=app:app /src/app.jar app.jar

USER app

ENV SERVER_PORT=4245 \
    STORAGE_ROOT=/app/storage

EXPOSE 4245

# Includes the database check: an API that cannot reach the database must not count as deployed.
# A short interval keeps `docker compose up --wait` quick.
HEALTHCHECK --interval=5s --timeout=5s --start-period=120s --retries=6 \
  CMD wget -q -O /dev/null http://127.0.0.1:4245/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
