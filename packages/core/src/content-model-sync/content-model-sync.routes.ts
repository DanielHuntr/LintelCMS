import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import type { ModelEvent } from "./model-events.js";
import { contentModelStatus } from "./model-sync.service.js";

const noticeParamsSchema = z.object({ noticeId: z.string() });

/** How often an idle event stream says it's still there, so proxies don't close it. */
const KEEP_ALIVE_MILLISECONDS = 25_000;

/**
 * HTTP only:
 *
 *   GET    /content-model/status              (blueprints:read)   -> ModelSyncStatus
 *   GET    /content-model/events              (blueprints:read)   -> text/event-stream
 *   POST   /content-model/pending/apply       (blueprints:update) -> ModelSyncStatus
 *   DELETE /content-model/notices/:noticeId   (blueprints:read)   -> 204
 */
export async function contentModelSyncRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("blueprints:read") };
  const canUpdate = { preHandler: requirePermission("blueprints:update") };
  // Open event streams, ended when the server closes so it doesn't wait for browsers.
  const openStreams = new Set<() => void>();
  server.addHook("onClose", async () => {
    openStreams.forEach((end) => end());
  });

  server.get("/content-model/status", canRead, async () =>
    contentModelStatus(server.contentModelSync),
  );

  server.post("/content-model/pending/apply", canUpdate, async () => {
    const sync = server.contentModelSync;
    return sync ? sync.applyPending() : contentModelStatus(sync);
  });

  server.delete("/content-model/notices/:noticeId", canRead, async (request, reply) => {
    const { noticeId } = parseRequest(noticeParamsSchema, request.params);
    server.contentModelSync?.dismissNotice(noticeId);
    return reply.code(204).send();
  });

  server.get("/content-model/events", canRead, (request, reply) => {
    // Headers set by hooks so far (CORS for the admin) go out with the stream.
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
    const send = (event: ModelEvent) => reply.raw.write(`event: ${event}\ndata: {}\n\n`);
    reply.raw.write(": connected\n\n");
    const stopListening = server.contentModelEvents.subscribe(send);
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
