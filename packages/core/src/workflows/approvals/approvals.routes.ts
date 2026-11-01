import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission, requireSignedIn } from "../../auth/require-permission.js";
import { readEntryId } from "../../entries/entries.routes.js";
import { parseRequest } from "../../http/http-errors.js";
import { ApprovalNotFoundError } from "../workflows.errors.js";
import {
  approvalDecisionRequestSchema,
  approvalIdParamsSchema,
  collectionParamsSchema,
  contentApprovalSettingRequestSchema,
  reviewRequestSchema,
} from "../workflows.schema.js";
import { decideApproval, listApprovalsForPerson } from "./approvals.service.js";
import {
  findEntryReview,
  listContentApprovalSettings,
  setContentApproval,
  submitForReview,
} from "./content-approval.service.js";

/**
 * HTTP only:
 *
 *   GET  /workflow-approvals                        (signed in)          requests this person can answer
 *   POST /workflow-approvals/:approvalId/decision   (signed in, the role) { decision, comment? }
 *   GET  /content-approval                          (workflows:read)     each collection's setting
 *   PUT  /content-approval/:handle                  (workflows:update)   { required, reviewerRole?, publishWhenApproved? }
 *   GET  /entries/:id/review                        (entries:read)       where the entry's review stands
 *   POST /entries/:id/review                        (entries:update)     { note? } submit for review
 */
export async function approvalsRoutes(server: FastifyInstance) {
  const signedIn = { preHandler: requireSignedIn };

  server.get("/workflow-approvals", signedIn, async (request) =>
    listApprovalsForPerson(server.database, getSignedIn(request)),
  );

  server.post("/workflow-approvals/:approvalId/decision", signedIn, async (request) => {
    const params = approvalIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ApprovalNotFoundError();
    }
    const decision = parseRequest(approvalDecisionRequestSchema, request.body);
    const answered = await decideApproval(
      server.database,
      params.data.approvalId,
      getSignedIn(request),
      decision,
    );
    server.workflows.runSoon();
    return answered;
  });

  server.get("/content-approval", { preHandler: requirePermission("workflows:read") }, async () =>
    listContentApprovalSettings(server.database),
  );

  server.put(
    "/content-approval/:handle",
    { preHandler: requirePermission("workflows:update") },
    async (request) => {
      const { handle } = parseRequest(collectionParamsSchema, request.params);
      const setting = parseRequest(contentApprovalSettingRequestSchema, request.body);
      return setContentApproval(server.database, handle, setting, getSignedIn(request).user.id);
    },
  );

  server.get(
    "/entries/:id/review",
    { preHandler: requirePermission("entries:read") },
    async (request) =>
      findEntryReview(server.database, readEntryId(request.params), getSignedIn(request)),
  );

  server.post(
    "/entries/:id/review",
    { preHandler: requirePermission("entries:update") },
    async (request) => {
      const { note } = parseRequest(reviewRequestSchema, request.body ?? {});
      const review = await submitForReview(
        server.database,
        server.events,
        readEntryId(request.params),
        note,
        getSignedIn(request),
      );
      server.workflows.runSoon();
      return review;
    },
  );
}
