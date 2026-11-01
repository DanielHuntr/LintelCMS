import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { contentDisposition } from "../media/content-disposition.js";
import type { FormsContext } from "./forms-context.js";
import { SubmissionNotFoundError } from "./forms.errors.js";
import { readFormId } from "./forms.routes.js";
import { exportSubmissionsAsCsv } from "./submissions-csv.js";
import {
  addNoteRequestSchema,
  listSubmissionsQuerySchema,
  noteParamsSchema,
  personRequestSchema,
  submissionParamsSchema,
  updateSubmissionRequestSchema,
} from "./submissions.schema.js";
import {
  addSubmissionNote,
  deleteSubmission,
  deleteSubmissionNote,
  erasePersonalData,
  exportPersonalData,
  findSubmission,
  listSubmissions,
  updateSubmission,
} from "./submissions.service.js";

/**
 * HTTP only. The inbox, and privacy requests:
 *
 *   GET    /forms/:id/submissions                         (forms:read)    ?search&filter&page&perPage
 *   GET    /forms/:id/export                              (forms:read)    -> text/csv
 *   GET    /forms/:id/submissions/:submissionId           (forms:read)    -> with notes
 *   PATCH  /forms/:id/submissions/:submissionId           (forms:update)  { isRead?, isStarred? }
 *   DELETE /forms/:id/submissions/:submissionId           (forms:delete)  -> 204
 *   POST   /forms/:id/submissions/:submissionId/notes     (forms:update)  { body } -> 201
 *   DELETE /forms/:id/submissions/:submissionId/notes/:noteId  (forms:update)
 *   POST   /forms/privacy/export                          (forms:read)    { email }
 *   POST   /forms/privacy/erase                           (forms:delete)  { email } -> { deleted }
 */
export async function submissionsRoutes(
  server: FastifyInstance,
  options: { context: () => FormsContext },
) {
  const read = { preHandler: requirePermission("forms:read") };
  const update = { preHandler: requirePermission("forms:update") };
  const remove = { preHandler: requirePermission("forms:delete") };
  const context = options.context;

  server.get("/forms/:id/submissions", read, async (request) => {
    const query = parseRequest(listSubmissionsQuerySchema, request.query);
    return listSubmissions(context(), readFormId(request.params), query);
  });

  server.get("/forms/:id/export", read, async (request, reply) => {
    const { filename, csv } = await exportSubmissionsAsCsv(context(), readFormId(request.params));
    return reply
      .type("text/csv; charset=utf-8")
      .header("content-disposition", contentDisposition("attachment", filename))
      .header("cache-control", "no-store")
      .send(csv);
  });

  server.get("/forms/:id/submissions/:submissionId", read, async (request) => {
    const { id, submissionId } = readSubmissionParams(request.params);
    return findSubmission(context(), id, submissionId);
  });

  server.patch("/forms/:id/submissions/:submissionId", update, async (request) => {
    const { id, submissionId } = readSubmissionParams(request.params);
    const changes = parseRequest(updateSubmissionRequestSchema, request.body ?? {});
    return updateSubmission(context(), id, submissionId, changes);
  });

  server.delete("/forms/:id/submissions/:submissionId", remove, async (request, reply) => {
    const { id, submissionId } = readSubmissionParams(request.params);
    await deleteSubmission(context(), id, submissionId);
    return reply.code(204).send();
  });

  server.post("/forms/:id/submissions/:submissionId/notes", update, async (request, reply) => {
    const { id, submissionId } = readSubmissionParams(request.params);
    const { body } = parseRequest(addNoteRequestSchema, request.body);
    const author = getSignedIn(request).user.id;
    return reply.code(201).send(await addSubmissionNote(context(), id, submissionId, body, author));
  });

  server.delete("/forms/:id/submissions/:submissionId/notes/:noteId", update, async (request) => {
    const parsed = noteParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new SubmissionNotFoundError();
    }
    const { id, submissionId, noteId } = parsed.data;
    return deleteSubmissionNote(context(), id, submissionId, noteId);
  });

  server.post("/forms/privacy/export", read, async (request, reply) => {
    const { email } = parseRequest(personRequestSchema, request.body);
    return reply
      .header("cache-control", "no-store")
      .send(await exportPersonalData(context(), email));
  });

  server.post("/forms/privacy/erase", remove, async (request) => {
    const { email } = parseRequest(personRequestSchema, request.body);
    return erasePersonalData(context(), email);
  });
}

function readSubmissionParams(params: unknown) {
  const parsed = submissionParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new SubmissionNotFoundError();
  }
  return parsed.data;
}
