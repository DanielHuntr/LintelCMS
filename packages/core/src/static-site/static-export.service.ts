import { mkdir } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { RenderedPagesCache, type SiteResponse } from "../website/rendered-pages-cache.js";
import {
  FORM_SCRIPT_PATH,
  type FormEndpoints,
  formTokenScript,
} from "../website/site-forms.service.js";
import {
  readSiteContext,
  renderStandalonePage,
  respondToSitePath,
  type SiteDependencies,
} from "../website/site-pages.service.js";
import {
  buildHtaccess,
  buildMediaHtaccess,
  buildWebConfig,
  HTACCESS_FILE,
  WEB_CONFIG_FILE,
} from "./host-settings.js";
import { ExportBuilder, injectMediaFetcher } from "./export-builder.js";
import { fileForPath, readManifest } from "./static-files.js";
import { type PageJob, planStaticPages, signatureOf } from "./static-pages.service.js";
import {
  buildSearchIndex,
  SEARCH_INDEX_FILE,
  SEARCH_PATH,
  SEARCH_SCRIPT_FILE,
  searchPageView,
  searchScript,
} from "./static-search.js";
import { redirectPage } from "./redirect-page.js";

/**
 * The website as a folder of files any web host can serve: every page drawn by the same
 * code as the live site, pictures copied in, and settings files for Apache and IIS.
 *
 * Exports are incremental. The folder's manifest remembers what each page was built from
 * (see static-pages.service.ts); a page whose inputs haven't changed, and whose file is
 * still there untouched, is left alone. Files no longer part of the site are removed.
 */

export interface ExtraFile {
  path: string;
  content: string | Uint8Array;
}

/** A page of the export's own (such as a shop's product page), rebuilt when `signature` changes. */
export interface ExtraPage {
  path: string;
  signature: string;
  render: (dependencies: SiteDependencies) => Promise<SiteResponse>;
}

export type MediaFetcher = (
  requestPath: string,
) => Promise<{ body: Buffer; contentType: string } | null>;

export interface StaticExportOptions {
  api: FastifyInstance;
  folder: string;
  /** Where forms post; Lintel's API when left out. */
  formEndpoints?: FormEndpoints;
  /** The published site's address, when Settings → Your website has none. */
  siteAddress?: string | null;
  extraFiles?: ExtraFile[];
  extraPages?: ExtraPage[];
  fetchMedia?: MediaFetcher;
  onProgress?: (progress: { done: number; total: number }) => void;
  now?: () => Date;
}

export interface StaticExportResult {
  /** Addresses drawn again this time. */
  rebuilt: string[];
  /** Addresses left as they were. */
  unchanged: string[];
  removed: string[];
  /** Every file, with the SHA-256 of its contents. */
  files: Record<string, string>;
  /** Things that didn't stop the export but someone should know, in plain English. */
  warnings: string[];
}

export async function exportStaticSite(options: StaticExportOptions): Promise<StaticExportResult> {
  const { api, folder } = options;
  await mkdir(folder, { recursive: true });
  const previous = await readManifest(folder);
  const dependencies: SiteDependencies = {
    database: api.database,
    assetLookup: api.assetLookup,
    templates: api.website.templates,
    builtInSiteUrl: options.siteAddress ?? api.website.builtInSiteUrl,
    cache: new RenderedPagesCache(),
    publicApiUrl: api.publicApiUrl,
    formEndpoints: options.formEndpoints,
    now: options.now,
  };
  const plan = await planStaticPages(dependencies);
  const context = await readSiteContext(dependencies);
  const builder = new ExportBuilder(folder, previous, {
    publicApiUrl: api.publicApiUrl,
    siteAddress: context.siteAddress,
    fetchMedia: options.fetchMedia ?? injectMediaFetcher(api),
  });

  const jobs: Array<PageJob & { signature: string; render?: ExtraPage["render"] }> = [
    ...plan.jobs.map((job) => ({ ...job, signature: signatureOf(job, plan.signatures) })),
    {
      path: SEARCH_PATH,
      dependsOn: ["site"],
      signature: signatureOf({ path: SEARCH_PATH, dependsOn: ["site"] }, plan.signatures),
      render: (site) => renderStandalonePage(site, SEARCH_PATH, searchPageView(), "Search"),
    },
    ...(options.extraPages ?? []).map((page) => ({
      path: page.path,
      dependsOn: [],
      signature:
        signatureOf({ path: page.path, dependsOn: ["site"] }, plan.signatures) + page.signature,
      render: page.render,
    })),
  ];
  const total = jobs.length;
  for (const [index, job] of jobs.entries()) {
    await builder.buildPage(job, () =>
      job.render ? job.render(dependencies) : respondToSitePath(dependencies, job.path, undefined),
    );
    options.onProgress?.({ done: index + 1, total });
  }

  for (const redirect of plan.redirects) {
    const file = fileForPath(redirect.from);
    if (!builder.has(file)) await builder.writeFile(file, redirectPage(redirect.to));
  }
  await builder.writeFile(context.stylesheet.path.replace(/^\//, ""), context.stylesheet.css);
  await builder.writeFile(FORM_SCRIPT_PATH.replace(/^\//, ""), formTokenScript);
  await builder.writeFile(SEARCH_SCRIPT_FILE, searchScript);
  await builder.writeFile(SEARCH_INDEX_FILE, buildSearchIndex(builder.searchRecords()));
  await builder.writeFile(HTACCESS_FILE, buildHtaccess(plan.redirects));
  await builder.writeFile(WEB_CONFIG_FILE, buildWebConfig(plan.redirects));
  if (builder.hasMedia()) await builder.writeFile("media/.htaccess", buildMediaHtaccess());
  for (const extra of options.extraFiles ?? []) {
    await builder.writeFile(extra.path, extra.content);
  }
  return builder.finish();
}
