# Lintel in one small image: the API, the built admin and the website in one Node process.
#
#   docker build -t lintel .
#   docker run -p 4000:4000 -v lintel-data:/data -e PUBLIC_URL=http://localhost:4000 lintel
#
# For a real server, use deploy/docker-compose.yml (Postgres, and Caddy for HTTPS).
# Everything Lintel keeps (the built-in database, uploads, saved settings) is in /data.

ARG NODE_VERSION=22

# ---- Build: install everything, build the API and the admin, keep only what runs ----
FROM node:${NODE_VERSION}-bookworm-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0 \
    CI=true
RUN corepack enable
WORKDIR /repo

# The manifests first, so a code change doesn't reinstall every package.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/admin/package.json packages/admin/
COPY packages/docs/package.json packages/docs/
COPY starters/nextjs/package.json starters/nextjs/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@lintel/admin..." --filter "@lintel/core..."

COPY . .
RUN pnpm --filter @lintel/core build && pnpm --filter @lintel/admin build

# The API with its production dependencies only, then the built files it runs.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @lintel/core deploy --prod --legacy /out
RUN cp -r packages/core/dist packages/core/migrations /out/ \
 && cp -r packages/admin/dist /out/admin

# ---- Run: Node and the built files, as an ordinary user ----
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    LINTEL_FOLDER=/data \
    ADMIN_BUILD_FOLDER=/app/admin
WORKDIR /app

COPY --from=build --chown=node:node /out /app
# Made here so new volumes mounted over them start out owned by the node user.
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4000

# /health answers while the process runs; it never touches the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Lintel finishes requests in progress on SIGTERM, then exits (SHUTDOWN_TIMEOUT_SECONDS).
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
