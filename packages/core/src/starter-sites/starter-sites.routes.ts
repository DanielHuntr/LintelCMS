import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { parseRequest } from "../http/http-errors.js";
import { resolveEditingSite } from "../sites/request-site.js";
import {
  addPagesToMenuRequestSchema,
  applyStarterSiteRequestSchema,
  starterSiteParamsSchema,
} from "./starter-sites.schema.js";
import { addPagesToMainMenu, applyStarterSite } from "./starter-sites.service.js";

/**
 * HTTP only:
 *
 *   POST /starter-sites/:id/apply  (entries:create)  { useTheme?, publish? }
 *        -> 201 { starterSiteId, pages: [{ entryId, title, slug, wantedSlug, published }],
 *                 themeApplied, menuFilled, menuHasLinks }
 *   POST /starter-sites/menu       (navigation:update)  { entryIds } -> { added }
 *        links the pages at the end of the main menu, when it already had links
 *
 * Both work on the site the editor is working on (see src/sites/request-site.ts).
 * The templates themselves are plain data in `@lintel/builder-model` (starterSites), which
 * the admin reads directly.
 */
export async function starterSitesRoutes(server: FastifyInstance) {
  server.post(
    "/starter-sites/:id/apply",
    { preHandler: requirePermission("entries:create") },
    async (request, reply) => {
      const { id } = parseRequest(starterSiteParamsSchema, request.params);
      const options = parseRequest(applyStarterSiteRequestSchema, request.body ?? {});
      const signedIn = getSignedIn(request);
      const applied = await applyStarterSite(server.database, id, options, {
        authorId: signedIn.user.id,
        assetExists: server.assetExists,
        permissions: signedIn.permissions,
        templates: server.website.templates,
        builtInSiteUrl: server.website.builtInSiteUrl,
        site: await resolveEditingSite(request),
      });
      for (const page of applied.pages.filter(({ published }) => published)) {
        const entry = await describeEntryForEvent(server.database, page.entryId);
        await announceContentEvent(server, { name: "entry.published", entry });
      }
      return reply.code(201).send(applied);
    },
  );

  server.post(
    "/starter-sites/menu",
    { preHandler: requirePermission("navigation:update") },
    async (request) => {
      const { entryIds } = parseRequest(addPagesToMenuRequestSchema, request.body);
      const added = await addPagesToMainMenu(
        server.database,
        entryIds,
        await resolveEditingSite(request),
      );
      return { added };
    },
  );
}
