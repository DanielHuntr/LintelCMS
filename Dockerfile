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

# The manifests first, so a code change doesn't reinstall every package. Every workspace
# package is listed: the API and the admin are built from several of them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/admin/package.json packages/admin/
COPY packages/builder/package.json packages/builder/
COPY packages/builder-model/package.json packages/builder-model/
COPY packages/cli/package.json packages/cli/
COPY packages/field-conditions/package.json packages/field-conditions/
COPY packages/motion/package.json packages/motion/
COPY packages/motion-editor/package.json packages/motion-editor/
COPY packages/site-components/package.json packages/site-components/
COPY packages/addon-example/package.json packages/addon-example/
COPY packages/plugin-example-bookings/package.json packages/plugin-example-bookings/
COPY packages/docs/package.json packages/docs/
COPY starters/nextjs/package.json starters/nextjs/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store     pnpm install --frozen-lockfile --filter "@lintel/admin..." --filter "@lintel/core..."

COPY . .
# The API and the admin, after the packages they are built from (turbo works out the order).
RUN pnpm turbo run build --filter "@lintel/core..." --filter "@lintel/admin..."

# The API with its production dependencies only, then the built files it runs. Linking
# workspace packages keeps pnpm from looking for Lintel's own packages on npm.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --config.link-workspace-packages=true --filter @lintel/core deploy --prod --legacy /out
RUN cp -r packages/core/dist packages/core/migrations /out/ \
 && cp -r packages/admin/dist /out/admin

# ---- Run: Node and the built files; Lintel runs as the ordinary `node` user ----
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    LINTEL_DOCKER=1 \
    HOST=0.0.0.0 \
    PORT=4000 \
    LINTEL_FOLDER=/data \
    ADMIN_BUILD_FOLDER=/app/admin
WORKDIR /app

COPY --from=build --chown=node:node /out /app
COPY --chown=node:node deploy/docker-start.mjs /app/docker-start.mjs
# Made here so new Docker volumes mounted over them start out owned by the node user.
RUN mkdir -p /data/uploads && chown -R node:node /data
VOLUME ["/data"]
EXPOSE 4000

# /health answers while the process runs; it never touches the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Lintel finishes requests in progress on SIGTERM, then exits (SHUTDOWN_TIMEOUT_SECONDS).
STOPSIGNAL SIGTERM
# Starts as root only to hand a platform's root-owned volume to `node`, then becomes `node`
# before Lintel loads (see deploy/docker-start.mjs).
CMD ["node", "docker-start.mjs"]
