import type { FastifyInstance } from "fastify";
import { requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import {
  addLocaleRequestSchema,
  localeParamsSchema,
  renameLocaleRequestSchema,
} from "./locales.schema.js";
import { addLocale, listLocales, removeLocale, renameLocale } from "./locales.service.js";
import { requireDeliveryAccess } from "../delivery/require-delivery-access.js";
import { resolveDeliverySite, resolveEditingSite } from "./request-site.js";

/**
 * HTTP only:
 *
 *   GET    /locales           (signed in)        -> { defaultLocale, locales: [Locale] }
 *   POST   /locales           (settings:update)  { code, name? } -> 201 Locale
 *   PATCH  /locales/:code     (settings:update)  { name } -> Locale
 *   DELETE /locales/:code     (settings:update)  -> 204, or 409 DEFAULT_LOCALE / LOCALE_IN_USE
 *   GET    /delivery/locales  (public)           -> { defaultLocale, locales: [{ code, name }] }
 *
 * Anyone signed in can list the languages: editors need them to write translations.
 * Each site has its own; these are the current site's (see request-site.ts).
 */
export async function localesRoutes(server: FastifyInstance) {
  // Published content, open to websites unless delivery needs a token (Settings → API access).
  const publicContent = { preHandler: requireDeliveryAccess };
  const canUpdate = { preHandler: requirePermission("settings:update") };

  server.get("/locales", { preHandler: requireSignedIn }, async (request) =>
    listLocales(server.database, await resolveEditingSite(request)),
  );

  server.post("/locales", canUpdate, async (request, reply) => {
    const locale = parseRequest(addLocaleRequestSchema, request.body);
    const site = await resolveEditingSite(request);
    return reply.code(201).send(await addLocale(server.database, locale, site));
  });

  server.patch("/locales/:code", canUpdate, async (request) => {
    const { code } = parseRequest(localeParamsSchema, request.params);
    const changes = parseRequest(renameLocaleRequestSchema, request.body);
    return renameLocale(server.database, code, changes, await resolveEditingSite(request));
  });

  server.delete("/locales/:code", canUpdate, async (request, reply) => {
    const { code } = parseRequest(localeParamsSchema, request.params);
    await removeLocale(server.database, code, await resolveEditingSite(request));
    return reply.code(204).send();
  });

  server.get("/delivery/locales", publicContent, async (request, reply) => {
    const site = await resolveDeliverySite(request, reply);
    const { defaultLocale, locales } = await listLocales(server.database, site);
    return reply.header("cache-control", "public, max-age=60").send({
      defaultLocale,
      locales: locales.map(({ code, name }) => ({ code, name })),
    });
  });
}
