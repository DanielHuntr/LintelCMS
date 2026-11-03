import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { requireEntryPermission } from "../entries/entry-access.js";
import { changeContext } from "../entries/entries.routes.js";
import { entryIdParamsSchema } from "../entries/entries.schema.js";
import { actorOf } from "../events/event-actor.js";
import { parseRequest } from "../http/http-errors.js";
import { requireEntrySiteAccess } from "../sites/request-site.js";
import {
  clientEditingSettingsSchema,
  listReviewsQuerySchema,
  reviewIdParamsSchema,
  sendBackRequestSchema,
  sendForReviewRequestSchema,
} from "./client-editing.schema.js";
import {
  findEntryReviewState,
  readClientEditingSettings,
  sendForReview,
  updateClientEditingSettings,
} from "./client-editing.service.js";
import {
  approveClientReview,
  listClientReviews,
  sendBackClientReview,
} from "./client-reviews.service.js";
import { findClientReviewRow } from "./client-reviews.repository.js";
import { ClientReviewNotFoundError } from "./client-editing.errors.js";

/**
 * HTTP only:
 *
 *   GET   /client-editing/settings          (entries:read)     -> { clientChanges }
 *   PATCH /client-editing/settings          (settings:update)  { clientChanges }
 *   GET   /entries/:id/review               (entries:read)     -> { needsApproval, mustSendForReview, review }
 *   POST  /entries/:id/review               (edit this entry)  { note? } -> 201, the same
 *   GET   /client-reviews                   (entries:read)     ?status=waiting -> { reviews }
 *   POST  /client-reviews/:id/approve       (entries:publish and builder:design) -> the review
 *   POST  /client-reviews/:id/send-back     (entries:publish and builder:design) { note }
 */
export async function clientEditingRoutes(server: FastifyInstance) {
  const reviewer = {
    preHandler: [requirePermission("entries:publish"), requirePermission("builder:design")],
  };

  server.get(
    "/client-editing/settings",
    { preHandler: requirePermission("entries:read") },
    async () => readClientEditingSettings(server.database),
  );

  server.patch(
    "/client-editing/settings",
    { preHandler: requirePermission("settings:update") },
    async (request) =>
      updateClientEditingSettings(
        server.database,
        parseRequest(clientEditingSettingsSchema, request.body),
      ),
  );

  server.get(
    "/entries/:id/review",
    { preHandler: [requirePermission("entries:read"), requireEntrySiteAccess] },
    async (request) => {
      const { id } = parseRequest(entryIdParamsSchema, request.params);
      return findEntryReviewState(server.database, id, getSignedIn(request).permissions);
    },
  );

  server.post(
    "/entries/:id/review",
    { preHandler: [requireEntryPermission("update"), requireEntrySiteAccess] },
    async (request, reply) => {
      const { id } = parseRequest(entryIdParamsSchema, request.params);
      const { note } = parseRequest(sendForReviewRequestSchema, request.body ?? {});
      return reply
        .code(201)
        .send(await sendForReview(server.database, id, note, getSignedIn(request)));
    },
  );

  server.get(
    "/client-reviews",
    { preHandler: requirePermission("entries:read") },
    async (request) => {
      const { status } = parseRequest(listReviewsQuerySchema, request.query);
      return listClientReviews(server.database, status);
    },
  );

  server.post("/client-reviews/:id/approve", reviewer, async (request) => {
    const { id } = parseRequest(reviewIdParamsSchema, request.params);
    const review = await findClientReviewRow(server.database, id);
    if (!review) throw new ClientReviewNotFoundError();
    const before = await describeEntryForEvent(server.database, review.entryId);
    await server.events.runChecks("entry.publishing", {
      entry: before,
      actor: actorOf(request),
      permissions: getSignedIn(request).permissions,
    });
    const answered = await approveClientReview(server.database, id, {
      ...changeContext(request),
      authorId: getSignedIn(request).user.id,
    });
    const entry = await describeEntryForEvent(server.database, review.entryId);
    await announceContentEvent(server, { name: "entry.published", entry }, actorOf(request));
    return answered;
  });

  server.post("/client-reviews/:id/send-back", reviewer, async (request) => {
    const { id } = parseRequest(reviewIdParamsSchema, request.params);
    const { note } = parseRequest(sendBackRequestSchema, request.body ?? {});
    return sendBackClientReview(server.database, id, note, getSignedIn(request).user.id);
  });
}
