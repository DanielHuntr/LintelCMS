import type { FastifyInstance } from "fastify";
import { refuseWhenReviewNeeded } from "./client-editing.service.js";

/**
 * While clients' changes wait for approval, publishing (and scheduling) by a client is
 * refused wherever it is asked for: one entry, the content tree's bulk actions.
 */
export function registerClientEditing(server: FastifyInstance): void {
  server.events.addCheck("entry.publishing", (question) =>
    refuseWhenReviewNeeded(server.database, question.permissions),
  );
}
