import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import type { FormsContext } from "./forms-context.js";
import { updateFormsSettingsRequestSchema } from "./forms-settings.schema.js";
import { readFormsSettings, updateFormsSettings } from "./forms-settings.service.js";
import { FormNotFoundError } from "./forms.errors.js";
import {
  createFormRequestSchema,
  formIdParamsSchema,
  updateFormRequestSchema,
} from "./forms.schema.js";
import { createForm, deleteForm, findForm, listForms, updateForm } from "./forms.service.js";

/**
 * HTTP only. The form builder:
 *
 *   GET    /forms           (forms:read)       -> { forms: [Form] }
 *   POST   /forms           (forms:update)     { name, handle?, template? } -> 201 Form
 *   GET    /forms/:id       (forms:read)       -> Form
 *   PATCH  /forms/:id       (forms:update)     any of Form's settings -> Form
 *   DELETE /forms/:id       (forms:delete)     -> 204, with every submission and file
 *   GET    /forms/settings  (forms:read)       -> { turnstileSiteKey, hasTurnstileSecret }
 *   PUT    /forms/settings  (settings:update)  { turnstileSiteKey, turnstileSecretKey? }
 */
export async function formsRoutes(
  server: FastifyInstance,
  options: { context: () => FormsContext },
) {
  const read = { preHandler: requirePermission("forms:read") };
  const update = { preHandler: requirePermission("forms:update") };
  const remove = { preHandler: requirePermission("forms:delete") };

  server.get("/forms", read, async () => listForms(server.database));

  server.post("/forms", update, async (request, reply) => {
    const form = parseRequest(createFormRequestSchema, request.body);
    const { user } = getSignedIn(request);
    const created = await createForm(server.database, form, { id: user.id, email: user.email });
    return reply.code(201).send(created);
  });

  server.get("/forms/settings", read, async () => readFormsSettings(server.database));

  server.put(
    "/forms/settings",
    { preHandler: requirePermission("settings:update") },
    async (request) =>
      updateFormsSettings(
        server.database,
        parseRequest(updateFormsSettingsRequestSchema, request.body),
      ),
  );

  server.get("/forms/:id", read, async (request) =>
    findForm(server.database, readFormId(request.params)),
  );

  server.patch("/forms/:id", update, async (request) => {
    const changes = parseRequest(updateFormRequestSchema, request.body ?? {});
    return updateForm(server.database, readFormId(request.params), changes);
  });

  server.delete("/forms/:id", remove, async (request, reply) => {
    await deleteForm(options.context(), readFormId(request.params));
    return reply.code(204).send();
  });
}

/** A malformed id can't match any form, so it's a 404 like any other missing one. */
export function readFormId(params: unknown): string {
  const parsed = formIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new FormNotFoundError();
  }
  return parsed.data.id;
}
