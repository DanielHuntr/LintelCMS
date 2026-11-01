import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { brandingSchema } from "./branding.schema.js";
import {
  describePublicBranding,
  findBrandingImage,
  readBranding,
  readBrandingSettings,
  resetBranding,
  saveBranding,
} from "./branding.service.js";

/**
 * HTTP only:
 *
 *   GET    /branding                (anyone)           -> the look every screen and the website use
 *   GET    /branding/images/:field  (anyone)           -> an uploaded logo, mark, favicon or background
 *   GET    /branding/settings       (branding:update)  -> { branding, defaults, defaultsFromDeployment }
 *   PUT    /branding                (branding:update)  { ...every field } -> the same as GET /branding/settings
 *   DELETE /branding                (branding:update)  -> back to the defaults, as GET /branding/settings
 *
 * GET /branding is public: the sign-in screen needs it before anyone signs in, and the
 * website needs `hideBuiltWithLintel`. It holds nothing that isn't shown on those screens.
 */
export async function brandingRoutes(server: FastifyInstance) {
  const deployment = () => server.deploymentBranding;

  server.get("/branding", async () =>
    describePublicBranding(await readBranding(server.database, deployment()), server.publicApiUrl),
  );

  server.get<{ Params: { field: string } }>("/branding/images/:field", async (request, reply) => {
    const branding = await readBranding(server.database, deployment());
    const image = findBrandingImage(branding, request.params.field);
    if ("address" in image) {
      return reply.redirect(image.address);
    }
    return (
      reply
        .header("content-type", image.type)
        // The address carries a fingerprint of the picture, so it can be cached for good.
        .header("cache-control", "public, max-age=31536000, immutable")
        .header("x-content-type-options", "nosniff")
        // An uploaded SVG opened on its own must not be able to run scripts.
        .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'")
        .header("cross-origin-resource-policy", "cross-origin")
        .send(image.bytes)
    );
  });

  server.get("/branding/settings", { preHandler: requirePermission("branding:update") }, async () =>
    readBrandingSettings(server.database, deployment()),
  );

  // Up to five pictures of 500 KB each, as base64.
  const bodyLimit = 4 * 1024 * 1024;
  server.put(
    "/branding",
    { preHandler: requirePermission("branding:update"), bodyLimit },
    async (request) => {
      const branding = parseRequest(brandingSchema, request.body);
      return saveBranding(server.database, deployment(), branding);
    },
  );

  server.delete("/branding", { preHandler: requirePermission("branding:update") }, async () =>
    resetBranding(server.database, deployment()),
  );
}
