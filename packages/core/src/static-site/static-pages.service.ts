import { createHash } from "node:crypto";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { listDeliveredRedirects } from "../seo/redirects.service.js";
import { POSTS_PER_PAGE } from "../website/site-lists.service.js";
import { localiseUrl } from "../website/site-chrome.service.js";
import { FEED_FILE } from "../website/site-feed.service.js";
import {
  readSiteChrome,
  readSiteContext,
  type SiteDependencies,
} from "../website/site-pages.service.js";
import { HOME_SLUG, listBase, listPath, localisedPath } from "../website/site-routing.js";
import {
  findReferencedVersions,
  listFormVersions,
  listPublishedEntryRows,
  listTermRows,
  type PublishedEntryRow,
} from "./static-site.repository.js";

/**
 * Which addresses the exported site has, and what each one is built from. Every page
 * names the things it depends on; a page is rebuilt only when one of them changed:
 *
 *   site                     the look, header and footer, menus, redirects, forms
 *   entry:<id>               one entry (and the pictures and entries it points at)
 *   collection:<handle>:<locale>  every entry of a collection in one language
 *   everything               every entry: the sitemap and the search index
 */

export interface PageJob {
  /** The address, as the live site serves it. */
  path: string;
  dependsOn: string[];
  /** Entry pages go into the search index. */
  searchable?: boolean;
}

export interface StaticPagePlan {
  jobs: PageJob[];
  /** One fingerprint per dependency key. */
  signatures: Map<string, string>;
  /** Redirects from the SEO plugin, written as files and into the server settings. */
  redirects: Array<{ from: string; to: string; statusCode: number }>;
}

/** An address that matches nothing, rendered as the site's "page not found". */
export const NOT_FOUND_PROBE = "/.lintel-not-found";

export async function planStaticPages(dependencies: SiteDependencies): Promise<StaticPagePlan> {
  const database = dependencies.database;
  const context = await readSiteContext(dependencies);
  const entries = await listPublishedEntryRows(database, DEFAULT_TENANT_ID);
  const terms = await listTermRows(database, DEFAULT_TENANT_ID);
  const redirects = context.seoEnabled
    ? (await listDeliveredRedirects(database)).redirects.map(({ from, to, statusCode }) => ({
        from,
        to,
        statusCode,
      }))
    : [];

  const chromes = await Promise.all(
    context.locales.map((locale) => readSiteChrome(dependencies, context, locale.code)),
  );
  const signatures = new Map<string, string>();
  signatures.set(
    "site",
    fingerprint({
      context: { ...context, stylesheet: context.stylesheet.path },
      chromes,
      redirects,
      forms: await listFormVersions(database, DEFAULT_TENANT_ID),
      formActions: dependencies.formEndpoints?.action("form") ?? dependencies.publicApiUrl ?? "",
    }),
  );
  const entrySignatures = await signEntries(dependencies, entries);
  for (const [id, signature] of entrySignatures) signatures.set(`entry:${id}`, signature);
  for (const collection of context.collections) {
    for (const locale of context.locales) {
      const inCollection = entries.filter(
        (entry) => entry.collectionHandle === collection.handle && entry.locale === locale.code,
      );
      signatures.set(
        `collection:${collection.handle}:${locale.code}`,
        fingerprint({
          entries: inCollection.map((entry) => entrySignatures.get(entry.id)),
          terms: terms.filter((term) => collection.taxonomyHandles.includes(term.taxonomyHandle)),
        }),
      );
    }
  }
  signatures.set("everything", fingerprint([...entrySignatures.values()]));

  const jobs: PageJob[] = [{ path: NOT_FOUND_PROBE, dependsOn: ["site"] }];
  if (context.seoEnabled) {
    jobs.push({ path: "/robots.txt", dependsOn: ["site"] });
    if (context.siteAddress) {
      jobs.push({ path: "/sitemap.xml", dependsOn: ["site", "everything"] });
    }
  }
  for (const locale of context.locales) {
    const allCollections = context.collections.map(
      (collection) => `collection:${collection.handle}:${locale.code}`,
    );
    jobs.push({
      path: localisedPath("/", locale.code, context.defaultLocale),
      dependsOn: ["site", ...allCollections],
      searchable: true,
    });
    jobs.push(...entryJobs(entries, locale.code, context.defaultLocale, context.collections));
    for (const collection of context.collections) {
      if (collection.structure !== "dated" || listBase(collection.routePattern) === "") continue;
      jobs.push(
        ...(await listJobs(dependencies, collection, locale.code, context.defaultLocale, terms)),
      );
    }
  }
  return { jobs: uniqueByPath(jobs), signatures, redirects };
}

function entryJobs(
  entries: readonly PublishedEntryRow[],
  locale: string,
  defaultLocale: string,
  collections: ReadonlyArray<{ handle: string; routePattern: string }>,
): PageJob[] {
  return entries.flatMap((entry) => {
    if (entry.locale !== locale) return [];
    const collection = collections.find(({ handle }) => handle === entry.collectionHandle);
    if (!collection) return [];
    // The home page is shown at "/", and its own address redirects there.
    if (collection.routePattern === "/{slug}" && entry.slug === HOME_SLUG) return [];
    const url = buildEntryUrl(collection.routePattern, entry);
    if (url === null) return [];
    const translations = entries.filter(
      (other) =>
        other.id !== entry.id &&
        (other.originId === (entry.originId ?? entry.id) || other.id === entry.originId),
    );
    return [
      {
        path: localiseUrl(url, locale, defaultLocale),
        dependsOn: ["site", `entry:${entry.id}`, ...translations.map(({ id }) => `entry:${id}`)],
        searchable: true,
      },
    ];
  });
}

/** A dated collection's list pages, its archives' pages and its feed. */
async function listJobs(
  dependencies: SiteDependencies,
  collection: { handle: string; routePattern: string; taxonomyHandles: string[] },
  locale: string,
  defaultLocale: string,
  terms: ReadonlyArray<{ taxonomyHandle: string; slug: string }>,
): Promise<PageJob[]> {
  const base = listBase(collection.routePattern);
  const dependsOn = ["site", `collection:${collection.handle}:${locale}`];
  const localise = (path: string) => localisedPath(path, locale, defaultLocale);
  const pagesOf = async (filter: { taxonomy?: string; term?: string }) => {
    const { total } = await listDeliveredEntries(
      dependencies.database,
      collection.handle,
      { page: 1, perPage: 1, locale, ...filter },
      dependencies.assetLookup,
    );
    return Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  };
  const jobs: PageJob[] = [{ path: localise(`${base}/${FEED_FILE}`), dependsOn }];
  for (let page = 1, last = await pagesOf({}); page <= last; page += 1) {
    jobs.push({ path: localise(listPath(base, page)), dependsOn });
  }
  for (const term of terms) {
    if (!collection.taxonomyHandles.includes(term.taxonomyHandle)) continue;
    const termBase = `${base}/${term.taxonomyHandle}/${term.slug}`;
    const last = await pagesOf({ taxonomy: term.taxonomyHandle, term: term.slug });
    for (let page = 1; page <= last; page += 1) {
      jobs.push({ path: localise(listPath(termBase, page)), dependsOn });
    }
  }
  return jobs;
}

async function signEntries(
  dependencies: SiteDependencies,
  entries: readonly PublishedEntryRow[],
): Promise<Map<string, string>> {
  const referencedIds = new Set<string>();
  const referencesOf = new Map<string, string[]>();
  for (const entry of entries) {
    const ids = [...JSON.stringify(entry.publishedData).matchAll(UUID_PATTERN)].map(([id]) => id);
    referencesOf.set(entry.id, ids);
    ids.forEach((id) => referencedIds.add(id));
  }
  const versions = await findReferencedVersions(dependencies.database, [...referencedIds]);
  return new Map(
    entries.map((entry) => [
      entry.id,
      fingerprint({
        entry,
        references: (referencesOf.get(entry.id) ?? []).map((id) => [id, versions.get(id) ?? null]),
      }),
    ]),
  );
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

function uniqueByPath(jobs: readonly PageJob[]): PageJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => (seen.has(job.path) ? false : (seen.add(job.path), true)));
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

/** One fingerprint for a page, from those of everything it depends on. */
export function signatureOf(job: PageJob, signatures: ReadonlyMap<string, string>): string {
  return fingerprint(job.dependsOn.map((key) => [key, signatures.get(key) ?? null]));
}
