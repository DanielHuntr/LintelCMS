import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { connectAdobeProject, disconnectAdobeProject } from "./adobe-fonts.service.js";
import { addGoogleFont, findGoogleFontPreview, searchGoogleFonts } from "./google-fonts.service.js";
import {
  addGoogleFontRequestSchema,
  addUploadedFontRequestSchema,
  adobeProjectParamsSchema,
  connectAdobeProjectRequestSchema,
  googleFontParamsSchema,
  inspectFontFilesRequestSchema,
  searchGoogleFontsQuerySchema,
  siteFontParamsSchema,
  updateSiteFontRequestSchema,
} from "./site-fonts.schema.js";
import {
  addUploadedFont,
  inspectFontFiles,
  listSiteFonts,
  removeSiteFont,
  updateSiteFont,
} from "./site-fonts.service.js";

/**
 * HTTP only. Fonts belong to the admin's current site. Anyone who can edit pages can see
 * them (the page builder lists them); changing them is part of the site's design, so it
 * needs `settings:update`, and uploaded files also need `media:upload`.
 *
 *   GET    /site-fonts                    (entries:read)    -> { fonts, adobeProjects }
 *   POST   /site-fonts/inspect            (media:upload)    { assetIds } -> { files }
 *   POST   /site-fonts/uploaded           (settings:update) { family, category, files, licenceConfirmed } -> 201 font
 *   GET    /site-fonts/google             (settings:update) ?search=&category= -> { fonts, total }
 *   GET    /site-fonts/google/:id/preview (settings:update) -> a small WOFF2 file
 *   POST   /site-fonts/google             (settings:update) { id, weights, italic } -> 201 font
 *   POST   /site-fonts/adobe              (settings:update) { projectId } -> { fonts, adobeProjects }
 *   DELETE /site-fonts/adobe/:projectId   (settings:update) -> { fonts, adobeProjects }
 *   PATCH  /site-fonts/:id                (settings:update) { category } -> font
 *   DELETE /site-fonts/:id                (settings:update) -> 204
 */
export async function siteFontsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("entries:read") };
  const canChange = { preHandler: requirePermission("settings:update") };
  const context = () => server.siteFonts.context();

  server.get("/site-fonts", canRead, async (request) =>
    listSiteFonts(context(), await resolveEditingSite(request)),
  );

  server.post(
    "/site-fonts/inspect",
    { preHandler: requirePermission("media:upload") },
    async (request) => {
      const { assetIds } = parseRequest(inspectFontFilesRequestSchema, request.body);
      return { files: await inspectFontFiles(context(), assetIds) };
    },
  );

  server.post(
    "/site-fonts/uploaded",
    { preHandler: [requirePermission("settings:update"), requirePermission("media:upload")] },
    async (request, reply) => {
      const body = parseRequest(addUploadedFontRequestSchema, request.body);
      const site = await resolveEditingSite(request);
      const font = await addUploadedFont(context(), site, body, getSignedIn(request).user.id);
      return reply.code(201).send(font);
    },
  );

  server.get(
    "/site-fonts/google",
    { ...canChange, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) =>
      searchGoogleFonts(context(), parseRequest(searchGoogleFontsQuerySchema, request.query)),
  );

  server.get("/site-fonts/google/:id/preview", canChange, async (request, reply) => {
    const { id } = parseRequest(googleFontParamsSchema, request.params);
    const file = await findGoogleFontPreview(context(), id);
    return reply
      .type("font/woff2")
      .header("cache-control", "private, max-age=86400")
      .header("x-content-type-options", "nosniff")
      .send(file);
  });

  server.post("/site-fonts/google", canChange, async (request, reply) => {
    const body = parseRequest(addGoogleFontRequestSchema, request.body);
    const site = await resolveEditingSite(request);
    const font = await addGoogleFont(context(), site, body, getSignedIn(request).user.id);
    return reply.code(201).send(font);
  });

  server.post("/site-fonts/adobe", canChange, async (request) => {
    const { projectId } = parseRequest(connectAdobeProjectRequestSchema, request.body);
    return connectAdobeProject(context(), await resolveEditingSite(request), projectId);
  });

  server.delete("/site-fonts/adobe/:projectId", canChange, async (request) => {
    const { projectId } = parseRequest(adobeProjectParamsSchema, request.params);
    return disconnectAdobeProject(context(), await resolveEditingSite(request), projectId);
  });

  server.patch("/site-fonts/:id", canChange, async (request) => {
    const { id } = parseRequest(siteFontParamsSchema, request.params);
    const changes = parseRequest(updateSiteFontRequestSchema, request.body);
    return updateSiteFont(context(), await resolveEditingSite(request), id, changes);
  });

  server.delete("/site-fonts/:id", canChange, async (request, reply) => {
    const { id } = parseRequest(siteFontParamsSchema, request.params);
    await removeSiteFont(context(), await resolveEditingSite(request), id);
    return reply.code(204).send();
  });
}
