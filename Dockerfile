# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.8.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
# git and ssh fetch the design system from GitHub; python, make and g++ build better-sqlite3 if no prebuilt binary fits.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git openssh-client python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

FROM base AS development-dependencies-env
COPY package.json package-lock.json ./
RUN --mount=type=ssh npm ci --no-audit --no-fund

FROM base AS production-dependencies-env
COPY package.json package-lock.json ./
RUN --mount=type=ssh npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

FROM base AS build-env
COPY . .
COPY --from=development-dependencies-env /app/node_modules ./node_modules
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
  PORT=3000 \
  DATABASE_PATH=/app/data/app.sqlite

COPY --from=production-dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/build ./build
# Applied at startup; the built server finds them under the working directory.
COPY db/migrations ./db/migrations

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]
