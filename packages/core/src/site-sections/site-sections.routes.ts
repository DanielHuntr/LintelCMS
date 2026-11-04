import { z } from "zod";
import { siteSectionsChangeSchema } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { hasPermission } from "../roles/permissions.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { PermissionDeniedError } from "../auth/auth.errors.js";
import {
  changeSiteSections,
  publishSiteSections,
  readSiteSectionsDraft,
  withRevisions,
  restorePreviousSiteSections,
} from "./site-sections.service.js";

/**
 * HTTP only, for the site being edited (the `Lintel-Site` header):
 *
 *   GET /website/sections  (entries:read)    -> { navigation, footer, unpublished }
 *   PUT /website/sections  (builder:blocks)  { navigation?, footer? } -> the same, as saved
 *   POST /website/sections/publish  (builder:blocks and entries:publish) -> { published }
 *   POST /website/sections/restore-previous  (builder:blocks)  -> both, as brought back
 *
 * GET and PUT are the builder's draft: a PUT changes what the builder shows, and the website
 * keeps the published sections until a publish (the page's Publish button sends one too).
 * `unpublished` says the draft differs from the website. A slot left out of a PUT stays as
 * it is; null takes it off the site. Changing them changes every page, like changing a
 * block, so it needs the same permission; publishing them needs both.
 */
const baseRevisionsSchema = z.object({
  baseRevisions: z
    .object({ navigation: z.string().max(64).optional(), footer: z.string().max(64).optional() })
    .optional(),
});

export async function siteSectionsRoutes(server: FastifyInstance) {
  server.get(
    "/website/sections",
    { preHandler: requirePermission("entries:read") },
    async (request) =>
      withRevisions(
        await readSiteSectionsDraft(server.database, await resolveEditingSite(request)),
      ),
  );

  server.put(
    "/website/sections",
    { preHandler: requirePermission("builder:blocks") },
    async (request) => {
      const change = parseRequest(siteSectionsChangeSchema, request.body ?? {});
      const { baseRevisions } = parseRequest(baseRevisionsSchema, request.body ?? {});
      const saved = await changeSiteSections(
        server.database,
        await resolveEditingSite(request),
        change,
        { mayEditCode: hasPermission(getSignedIn(request).permissions, "builder:code") },
        baseRevisions,
      );
      return withRevisions(saved);
    },
  );

  server.post(
    "/website/sections/publish",
    { preHandler: requirePermission("entries:publish") },
    async (request) => {
      if (!hasPermission(getSignedIn(request).permissions, "builder:blocks")) {
        throw new PermissionDeniedError("builder:blocks");
      }
      const published = await publishSiteSections(
        server.database,
        await resolveEditingSite(request),
      );
      return { published };
    },
  );

  // A starter template that replaced the site's navigation and footer kept them: this
  // brings them back (and keeps the template's, so it can be undone the same way).
  server.post(
    "/website/sections/restore-previous",
    { preHandler: requirePermission("builder:blocks") },
    async (request) =>
      withRevisions(
        await restorePreviousSiteSections(server.database, await resolveEditingSite(request)),
      ),
  );
}
