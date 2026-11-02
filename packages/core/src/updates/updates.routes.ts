import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { requestOrigin } from "../security-log/security-log.service.js";
import { startRollback, startUpdate } from "./update-install.service.js";
import {
  startRollbackBodySchema,
  startUpdateBodySchema,
  type UpdateProgress,
  updatePreferencesBodySchema,
} from "./updates.schema.js";
import {
  checkForUpdatesNow,
  readUpdateProgress,
  readUpdatesOverview,
  readUpdateSummary,
  saveUpdatePreferences,
} from "./updates.service.js";

/** How often an idle progress stream says it's still there, so proxies don't close it. */
const KEEP_ALIVE_MILLISECONDS = 25_000;

/**
 * HTTP only. Seeing updates needs `updates:read` (owners and admins); installing and rolling
 * back are for owners only, which the service checks.
 *
 *   GET  /about                         (signed in)        -> { version }
 *   GET  /updates                       (updates:read)     -> UpdatesOverview
 *   GET  /updates/summary               (updates:read)     -> { count, securityCount, checkFailed }
 *   POST /updates/check                 (updates:read)     -> UpdatesOverview, after a fresh look
 *   PUT  /updates/preferences           (settings:update)  { channel } -> preferences
 *   POST /updates/install               (updates:read, owners) { version, confirmed } -> 202 progress
 *   POST /updates/rollback              (updates:read, owners) { version, restoreBackup, confirmed } -> 202
 *   GET  /updates/progress              (updates:read)     -> { progress, maintenance: false }
 *   GET  /updates/progress/stream       (updates:read)     -> text/event-stream of progress
 *   GET  /updates/status                (signed in)        -> { updating, version } for the banner
 */
export async function updatesRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("updates:read") };
  const signedIn = { preHandler: requireSignedIn };
  const openStreams = new Set<() => void>();
  server.addHook("onClose", async () => {
    openStreams.forEach((end) => end());
  });

  server.get("/about", signedIn, async () => ({ version: server.updates.currentVersion }));

  server.get("/updates", canRead, async (request) =>
    readUpdatesOverview(server, getSignedIn(request).user.id),
  );

  server.get("/updates/summary", canRead, async () => readUpdateSummary(server));

  server.post("/updates/check", canRead, async (request) => {
    await checkForUpdatesNow(server);
    return readUpdatesOverview(server, getSignedIn(request).user.id);
  });

  server.put(
    "/updates/preferences",
    { preHandler: requirePermission("settings:update") },
    async (request) =>
      saveUpdatePreferences(server, parseRequest(updatePreferencesBodySchema, request.body)),
  );

  server.post("/updates/install", canRead, async (request, reply) => {
    const { version } = parseRequest(startUpdateBodySchema, request.body);
    const { user } = getSignedIn(request);
    const progress = await startUpdate(server, user, version, requestOrigin(request));
    return reply.code(202).send(progress);
  });

  server.post("/updates/rollback", canRead, async (request, reply) => {
    const body = parseRequest(startRollbackBodySchema, request.body);
    const { user } = getSignedIn(request);
    const progress = await startRollback(server, user, body, requestOrigin(request));
    return reply.code(202).send(progress);
  });

  server.get("/updates/progress", canRead, async () => ({
    progress: await readUpdateProgress(server),
    maintenance: false,
  }));

  server.get("/updates/status", signedIn, async () => {
    const progress = server.updates.isBusy ? server.updates.currentProgress : null;
    return { updating: progress !== null, version: progress?.version ?? null };
  });

  server.get("/updates/progress/stream", canRead, async (request, reply) => {
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) {
        reply.raw.setHeader(name, value);
      }
    }
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    reply.hijack();
    const send = (progress: UpdateProgress | null) =>
      reply.raw.write(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`);
    send(await readUpdateProgress(server));
    const stopListening = server.updates.onProgress(send);
    const keepAlive = setInterval(
      () => reply.raw.write(": still here\n\n"),
      KEEP_ALIVE_MILLISECONDS,
    );
    const end = () => {
      clearInterval(keepAlive);
      stopListening();
      openStreams.delete(end);
      reply.raw.end();
    };
    openStreams.add(end);
    request.raw.on("close", end);
  });
}
