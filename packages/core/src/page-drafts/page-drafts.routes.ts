import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { readSetting } from "../settings/settings.service.js";
import {
  draftJobParamsSchema,
  draftPageRequestSchema,
  rewriteRequestSchema,
} from "./page-drafts.schema.js";
import { readDraftingStatus, startPageDraft, startRewrite } from "./page-drafts.service.js";

/**
 * HTTP only. Setting the model up is an admin's job (`settings:*`); drafting needs
 * `drafts:use`. Request bodies hold people's words, so nothing here logs them.
 *
 *   GET    /drafts/model                 -> the model, its state and this server's room
 *   POST   /drafts/model/download        start or resume the download (202)
 *   POST   /drafts/model/download/cancel stop it, keeping what arrived
 *   POST   /drafts/model/check           check files copied into the folder (202)
 *   DELETE /drafts/model                 remove the model's files
 *   GET    /drafts/status                -> { ready, busy }, for the builder
 *   POST   /drafts/page                  { purpose, audience, tone, sections } -> 202 job
 *   POST   /drafts/rewrite               { text, style } -> 202 job
 *   GET    /drafts/jobs/:jobId           -> the job, with its result once done
 *   POST   /drafts/jobs/:jobId/stop      -> the job
 */
export async function pageDraftsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("settings:read") };
  const canChange = { preHandler: requirePermission("settings:update") };
  const canDraft = { preHandler: requirePermission("drafts:use") };
  const drafts = () => server.pageDrafts;

  server.get("/drafts/model", canRead, async () => drafts().setup.status());

  server.post("/drafts/model/download", canChange, async (_request, reply) => {
    await drafts().setup.startDownload();
    return reply.code(202).send(await drafts().setup.status());
  });

  server.post("/drafts/model/download/cancel", canChange, async () => {
    drafts().setup.cancel();
    await drafts().setup.finished;
    return drafts().setup.status();
  });

  server.post("/drafts/model/check", canChange, async (_request, reply) => {
    await drafts().setup.startCheck();
    return reply.code(202).send(await drafts().setup.status());
  });

  server.delete("/drafts/model", canChange, async () => {
    await drafts().runner.unload();
    await drafts().setup.remove();
    return drafts().setup.status();
  });

  server.get("/drafts/status", canDraft, async () => readDraftingStatus(drafts()));

  server.post("/drafts/page", canDraft, async (request, reply) => {
    const body = parseRequest(draftPageRequestSchema, request.body);
    const siteName = await readSetting(server.database, "siteName");
    const job = await startPageDraft(drafts(), body, siteName, getSignedIn(request).user.id);
    return reply.code(202).send(job);
  });

  server.post("/drafts/rewrite", canDraft, async (request, reply) => {
    const body = parseRequest(rewriteRequestSchema, request.body);
    const job = await startRewrite(drafts(), body, getSignedIn(request).user.id);
    return reply.code(202).send(job);
  });

  server.get("/drafts/jobs/:jobId", canDraft, async (request) => {
    const { jobId } = parseRequest(draftJobParamsSchema, request.params);
    return drafts().desk.find(jobId, getSignedIn(request).user.id);
  });

  server.post("/drafts/jobs/:jobId/stop", canDraft, async (request) => {
    const { jobId } = parseRequest(draftJobParamsSchema, request.params);
    return drafts().desk.stop(jobId, getSignedIn(request).user.id);
  });
}
