import type { FastifyCorsOptions } from "@fastify/cors";
import type { FastifyRequest } from "fastify";
import { isAllowedSiteOrigin } from "../delivery/delivery-access.service.js";

/**
 * Which browser pages may call the API (CORS), decided per request:
 *
 *   - the admin's origin may call everything, with its session cookie;
 *   - websites listed in Settings → API access may call the public content APIs
 *     (/delivery, /graphql and /openapi.json), without cookies.
 *
 * Anything else gets no CORS headers, so the browser keeps the response from the page.
 * Servers and scripts don't use CORS at all, so they're unaffected either way.
 */
const ADMIN_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
// POST is for GraphQL queries; everything public is read-only.
const PUBLIC_METHODS = ["GET", "HEAD", "POST"];

export function isPublicContentPath(url: string): boolean {
  const path = url.split("?")[0] ?? "";
  return (
    path === "/delivery" ||
    path.startsWith("/delivery/") ||
    path === "/graphql" ||
    path === "/openapi.json"
  );
}

export function crossOriginOptions(adminOrigin: string) {
  const adminOptions: FastifyCorsOptions = {
    origin: adminOrigin,
    credentials: true,
    // The plugin's default is GET, HEAD and POST only; the admin also updates and deletes.
    methods: ADMIN_METHODS,
  };

  return async function decideCrossOrigin(request: FastifyRequest): Promise<FastifyCorsOptions> {
    const origin = request.headers.origin;
    if (!origin || origin === adminOrigin || !isPublicContentPath(request.url)) {
      return adminOptions;
    }
    if (await isAllowedSiteOrigin(request.server.database, origin)) {
      return {
        origin,
        credentials: false,
        methods: PUBLIC_METHODS,
        allowedHeaders: ["authorization", "content-type"],
        maxAge: 600,
      };
    }
    return adminOptions;
  };
}
