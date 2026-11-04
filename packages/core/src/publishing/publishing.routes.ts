import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { findPublishRun, startPublish } from "./publish-runs.service.js";
import {
  FolderDestinationNeedsOwnerError,
  PublishRunNotFoundError,
  PublishTargetNotFoundError,
} from "./publishing.errors.js";
import type { PublishTargetKind } from "./publishing.table.js";
import {
  createPublishTargetRequestSchema,
  publishRequestSchema,
  runParamsSchema,
  targetIdParamsSchema,
  updatePublishTargetRequestSchema,
} from "./publishing.schema.js";
import {
  createPublishTarget,
  deletePublishTarget,
  describeTarget,
  findPublishTargetRow,
  listPublishRuns,
  listPublishTargets,
  testPublishTarget,
  updatePublishTarget,
} from "./publishing.service.js";
import { buildZipDownload } from "./zip-download.service.js";

/**
 * HTTP only. Publishing destinations are site settings, so they need the settings
 * permissions; publishing itself needs `settings:update` too.
 *
 *   GET    /publishing/targets                      (settings:read)
 *   POST   /publishing/targets                      (settings:update) -> 201
 *   GET    /publishing/targets/:id                  (settings:read)
 *   PATCH  /publishing/targets/:id                  (settings:update)
 *   DELETE /publishing/targets/:id                  (settings:update) -> 204
 *   POST   /publishing/targets/:id/test             (settings:update) { ok, message }
 *   POST   /publishing/targets/:id/publish          (settings:update) { dryRun?, confirmDeletions? } -> 202 run
 *   GET    /publishing/targets/:id/runs             (settings:read)   the last 30
 *   GET    /publishing/targets/:id/runs/:runId      (settings:read)   with progress while it runs
 *   GET    /publishing/targets/:id/download         (settings:update) the website as a ZIP
 *
 * Passwords and keys are accepted in `secrets` and never sent back. A folder on this server
 * can be seen with `settings:read`; everything else about it is for Owners.
 */
export async function publishingRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("settings:read") };
  const update = { preHandler: requirePermission("settings:update") };
  const context = () => server.publishing;

  /** A folder writes straight to the server's disk, so all of it is for Owners. */
  const refuseFolderUnlessOwner = (request: FastifyRequest, kind: PublishTargetKind) => {
    if (kind === "folder" && !getSignedIn(request).permissions.includes("*")) {
      throw new FolderDestinationNeedsOwnerError();
    }
  };
  const refuseSavedFolderUnlessOwner = async (request: FastifyRequest) => {
    const target = await findPublishTargetRow(server.database, readTargetId(request.params));
    refuseFolderUnlessOwner(request, target.kind);
  };

  server.get("/publishing/targets", read, async () => listPublishTargets(context()));

  server.post("/publishing/targets", update, async (request, reply) => {
    const target = parseRequest(createPublishTargetRequestSchema, request.body);
    refuseFolderUnlessOwner(request, target.kind);
    return reply.code(201).send(await createPublishTarget(context(), target));
  });

  server.get("/publishing/targets/:id", read, async (request) =>
    describeTarget(
      context().secretBox(),
      await findPublishTargetRow(server.database, readTargetId(request.params)),
    ),
  );

  server.patch("/publishing/targets/:id", update, async (request) => {
    await refuseSavedFolderUnlessOwner(request);
    return updatePublishTarget(
      context(),
      readTargetId(request.params),
      parseRequest(updatePublishTargetRequestSchema, request.body),
    );
  });

  server.delete("/publishing/targets/:id", update, async (request, reply) => {
    await refuseSavedFolderUnlessOwner(request);
    await deletePublishTarget(context(), readTargetId(request.params));
    return reply.code(204).send();
  });

  server.post("/publishing/targets/:id/test", update, async (request) => {
    await refuseSavedFolderUnlessOwner(request);
    return testPublishTarget(context(), readTargetId(request.params));
  });

  server.post("/publishing/targets/:id/publish", update, async (request, reply) => {
    await refuseSavedFolderUnlessOwner(request);
    const options = parseRequest(publishRequestSchema, request.body ?? {});
    const started = await startPublish(context(), readTargetId(request.params), {
      trigger: "manual",
      ...options,
    });
    // The publish goes on after the answer; the admin follows it through runs/:runId.
    started.finished.catch((error: unknown) => server.log.error(error, "Publishing failed"));
    return reply.code(202).send(started.run);
  });

  server.get("/publishing/targets/:id/runs", read, async (request) =>
    listPublishRuns(server.database, readTargetId(request.params)),
  );

  server.get("/publishing/targets/:id/runs/:runId", read, async (request) => {
    const parsed = runParamsSchema.safeParse(request.params);
    if (!parsed.success) throw new PublishRunNotFoundError();
    return findPublishRun(context(), parsed.data.id, parsed.data.runId);
  });

  server.get("/publishing/targets/:id/download", update, async (request, reply) => {
    const zip = await buildZipDownload(context(), readTargetId(request.params));
    return reply
      .type("application/zip")
      .header("content-disposition", `attachment; filename="${zip.filename}"`)
      .send(Buffer.from(zip.content));
  });
}

function readTargetId(params: unknown): string {
  const parsed = targetIdParamsSchema.safeParse(params);
  if (!parsed.success) throw new PublishTargetNotFoundError();
  return parsed.data.id;
}
