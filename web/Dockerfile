# txtms-web — Next.js 16 (standalone server)
#
# Built on the deploy server by the CI job. The dependency layer is reused while package-lock.json is
# unchanged, and the npm cache and the Next build cache are BuildKit cache mounts.
# `next build` type-checks; lint and tests are not run here, run them before pushing (README).

# ─── dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=txtms-npm,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund

# ─── build ──────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The browser calls `/api/*` on its own origin and the Next server forwards them to the API.
# Rewrites are fixed at build time, so the API address is a build argument. `api` is the service
# name in deploy/docker-compose.yml, which keeps the same image valid for every environment.
ARG API_ORIGIN=http://api:4245
ENV API_ORIGIN=$API_ORIGIN \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=cache,id=txtms-next,target=/app/.next/cache \
    npm run build \
 && mkdir -p public

# ─── runtime ────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4246 \
    HOSTNAME=0.0.0.0

# `node` is the non-root user that ships with the image.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 4246

HEALTHCHECK --interval=5s --timeout=5s --start-period=30s --retries=6 \
  CMD wget -q -O /dev/null http://127.0.0.1:4246/login || exit 1

CMD ["node", "server.js"]
