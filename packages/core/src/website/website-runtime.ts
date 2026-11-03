import type { SiteTemplate } from "@lintel/site-components";
import type { FastifyInstance } from "fastify";
import {
  LiquidTemplates,
  type LiquidTemplatesOptions,
} from "../liquid-templates/liquid-templates.service.js";
import { RenderedPagesCache } from "./rendered-pages-cache.js";
import { listSiteTemplates } from "./site-templates.js";

/** What the API server keeps for the built-in website (`server.website`). */
export interface WebsiteRuntime {
  /** The templates Settings, Site offers: the built-in ones and any the install adds. */
  templates: SiteTemplate[];
  /** The built-in site's address, or null when this install doesn't serve one. */
  builtInSiteUrl: string | null;
  renderedPages: RenderedPagesCache;
  /** Liquid page templates from the templates folder; null when this install has none set. */
  liquidTemplates: LiquidTemplates | null;
}

export interface WebsiteOptions {
  builtInSiteUrl?: string | null;
  /** Templates of your own, offered beside Clean and Journal (one with the same id wins). */
  templates?: SiteTemplate[];
  /** The templates folder for Liquid page templates (see src/liquid-templates). */
  liquidTemplates?: LiquidTemplatesOptions;
}

export function createWebsiteRuntime(options: WebsiteOptions = {}): WebsiteRuntime {
  const renderedPages = new RenderedPagesCache();
  return {
    templates: listSiteTemplates(options.templates),
    builtInSiteUrl: options.builtInSiteUrl ?? null,
    renderedPages,
    // A changed template file changes pages, so the rendered ones go.
    liquidTemplates: options.liquidTemplates
      ? new LiquidTemplates(options.liquidTemplates, () => renderedPages.clear())
      : null,
  };
}

/** Paths whose successful writes can't change what the website shows. */
const unrelatedWrites = ["/auth/", "/entries/preview", "/preview", "/setup/code"];

/**
 * Empties the rendered pages after any successful change made through the API: a menu, a
 * global, a setting, a page's SEO, a picture's alt text. Publishing is also announced as a
 * content event (see src/content-events), which covers the scheduler too.
 */
export function clearRenderedPagesAfterChanges(server: FastifyInstance): void {
  server.addHook("onResponse", async (request, reply) => {
    const isWrite =
      request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS";
    if (!isWrite || reply.statusCode >= 400) {
      return;
    }
    const path = request.url.split("?")[0] ?? "";
    if (unrelatedWrites.some((prefix) => path.startsWith(prefix)) || path.endsWith("/preview")) {
      return;
    }
    server.website.renderedPages.clear();
  });
}
