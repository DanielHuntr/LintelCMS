import type { FastifyInstance } from "fastify";
import type { MediaContext } from "../media/index.js";
import { createAdobeFontsClient } from "./adobe-fonts-client.js";
import { createFontNetwork, type FetchFunction } from "./font-network.js";
import { createGoogleFontsClient } from "./google-fonts-client.js";
import type { SiteFontsContext } from "./site-fonts.service.js";

declare module "fastify" {
  interface FastifyInstance {
    /** What the site fonts routes need besides the request (see src/site-fonts). */
    siteFonts: { context: () => SiteFontsContext };
  }
}

export interface SiteFontsOptions {
  /** How Lintel asks Google Fonts and Adobe Fonts for things. Tests pass a stand-in. */
  fetch?: FetchFunction;
}

/**
 * The font services' clients, made once so their caches (the Google Fonts list, preview
 * files) last as long as the server runs.
 */
export function registerSiteFonts(
  server: FastifyInstance,
  options: SiteFontsOptions,
  media: () => MediaContext,
): void {
  const network = createFontNetwork(options.fetch);
  const google = createGoogleFontsClient(network);
  const adobe = createAdobeFontsClient(network);
  server.decorate("siteFonts", {
    context: () => ({ database: server.database, media: media(), google, adobe }),
  });
}
