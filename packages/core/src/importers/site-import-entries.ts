import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { findCollectionByHandle } from "../collections/collections.repository.js";
import type { Collection } from "../collections/collections.table.js";
import { placeEntryUrl } from "../content-roots/content-roots.service.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import {
  findEntryById,
  findSlugsStartingWith,
  insertEntry,
} from "../entries/entries.repository.js";
import { validateForCollection } from "../entries/entries.service.js";
import { insertRevision } from "../entries/revisions.repository.js";
import { firstFreeSlug, slugify } from "../entries/slugs.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { findRedirectFrom, insertRedirect } from "../seo/redirects.repository.js";
import { normaliseRedirectPath } from "../seo/redirects.schema.js";
import {
  alreadyImported,
  done,
  failed,
  type ItemResult,
  skipped,
} from "../wordpress-import/wordpress-import-context.js";
import { designedPageFromHtml, type PlacedPicture } from "./designed-pages.js";
import { convertValue, isDesignValue, type ValueLookups } from "./imported-values.js";
import type { SiteItemContext } from "./site-import-context.js";
import { findAllowedChildren, findEntryFromEarlierImport } from "./site-import.repository.js";
import { assetUrl } from "./site-import-steps.js";
import type { SourceEntry, SourceFieldKind, SourceValue } from "./source-site.js";

/**
 * An entry from another system becomes an entry in the collection its content type went
 * into: each mapped field's value converted for the field it goes into, its publish state
 * and date kept, a page keeping its parent and place among its siblings, and its old
 * address a suggested redirect to the new one (worked out the way the site shows it, under
 * its site start and down the page tree). Nothing already here is changed: a slug that is
 * taken gets a number, and the report says so.
 */
export async function importSiteEntry(
  context: SiteItemContext,
  entry: SourceEntry,
): Promise<ItemResult> {
  const chosen = context.mapping.contentTypes[entry.typeKey];
  if (!chosen?.collection) {
    return skipped("This kind of content was left out on the mapping screen.");
  }
  if (!entry.published && context.mapping.drafts === "skip") {
    return skipped("Drafts were left out on the mapping screen.");
  }
  const earlier = await findEntryFromEarlierImport(
    context.database,
    context.importId,
    { source: context.source, siteAddress: context.siteAddress },
    { kind: "entry", sourceId: entry.key },
  );
  if (earlier) {
    return alreadyImported(earlier);
  }
  const collection = await findCollectionByHandle(
    context.database,
    DEFAULT_TENANT_ID,
    chosen.collection,
  );
  if (!collection) {
    return failed(`The collection “${chosen.collection}” isn't here.`);
  }
  const blueprint = await findBlueprintByIdOrFail(context.database, collection.blueprintId);
  const kinds = new Map(
    (context.found.contentTypes.find((type) => type.key === entry.typeKey)?.fields ?? []).map(
      (field) => [field.key, field.kind],
    ),
  );
  const converted = await convertEntryValues(
    context,
    entry,
    chosen.fields,
    blueprint.fields,
    kinds,
  );
  const checked = await checkValues(context, collection, converted.data);
  if ("problem" in checked) {
    return failed(checked.problem);
  }

  const scope = { collectionId: collection.id, siteId: context.siteId, locale: context.locale };
  const wanted = slugify(entry.slug) || slugify(entry.title) || "entry";
  const slug = firstFreeSlug(
    wanted,
    new Set(await findSlugsStartingWith(context.database, scope, wanted)),
  );
  const date = entry.date ? new Date(entry.date) : new Date();
  const created = await insertEntry(context.database, {
    ...scope,
    slug,
    parentId: await parentFor(context, collection, entry),
    status: entry.published ? "published" : "draft",
    publishedAt: entry.published ? date : null,
    data: checked.data,
    publishedData: entry.published ? checked.data : null,
    sortOrder: entry.order,
    createdAt: date,
  });
  await insertRevision(context.database, {
    entryId: created.id,
    authorId: null,
    kind: entry.published ? "published" : "edited",
    data: checked.data,
  });
  const redirected =
    entry.published && context.mapping.redirects && entry.oldPath
      ? await suggestRedirect(context, collection, entry.oldPath, created.id, slug, date)
      : false;
  const fieldsLeftOut = [...converted.leftOut, ...checked.leftOut];
  return done(created.id, {
    title: entry.title,
    ...(slug !== wanted ? { renamedFrom: wanted, renamedTo: slug } : {}),
    ...(converted.designed ? { designedPage: true } : {}),
    ...(converted.keptAsHtml.length > 0 ? { keptAsHtml: converted.keptAsHtml } : {}),
    ...(fieldsLeftOut.length > 0 ? { fieldsLeftOut } : {}),
    redirected,
  });
}

async function convertEntryValues(
  context: SiteItemContext,
  entry: SourceEntry,
  chosenFields: Record<string, string | null>,
  fields: readonly FieldDefinition[],
  kinds: Map<string, SourceFieldKind>,
) {
  const data: Record<string, unknown> = { title: entry.title.trim().slice(0, 500) || "Untitled" };
  const leftOut: string[] = [];
  const keptAsHtml: string[] = [];
  let designed = false;
  const lookups = await lookupsFor(context, Object.values(entry.values));
  for (const [key, handle] of Object.entries(chosenFields)) {
    const value = entry.values[key];
    const field = fields.find((candidate) => candidate.handle === handle);
    if (!handle || handle === "title" || !field || value === undefined || value === null) {
      continue;
    }
    if (isDesignValue(value)) {
      if (field.type !== "page") {
        leftOut.push(handle);
        continue;
      }
      const page = designedPageFromHtml(value.html, value.css, (address) =>
        placedPicture(context, value.pictures[address], lookups),
      );
      data[handle] = page.document;
      designed = true;
      continue;
    }
    const result = convertValue(value, kinds.get(key) ?? "text", field, lookups.values);
    if (result === undefined) {
      leftOut.push(handle);
    } else {
      data[handle] = result.value;
      keptAsHtml.push(...(result.keptAsHtml ?? []));
    }
  }
  return { data, leftOut, keptAsHtml, designed };
}

function placedPicture(
  context: SiteItemContext,
  mediaKey: string | undefined,
  lookups: Awaited<ReturnType<typeof lookupsFor>>,
): PlacedPicture | null {
  const assetId = mediaKey ? context.targets.get(`media:${mediaKey}`) : undefined;
  const src = assetId ? lookups.urls.get(assetId) : undefined;
  return assetId && src ? { src, assetId, alt: "" } : null;
}

/**
 * The lookups values need. Picture addresses are worked out first (they need the
 * database), so converting stays synchronous.
 */
async function lookupsFor(context: SiteItemContext, sourceValues: readonly SourceValue[]) {
  const urls = new Map<string, string>();
  const remember = async (assetId: string | undefined) => {
    if (assetId && !urls.has(assetId)) urls.set(assetId, await assetUrl(context, assetId));
  };
  for (const value of sourceValues) {
    if (isDesignValue(value)) {
      for (const mediaKey of Object.values(value.pictures)) {
        await remember(context.targets.get(`media:${mediaKey}`));
      }
    } else if (typeof value === "string") {
      for (const match of value.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
        await remember(context.targets.get(`url:${match[1]}`));
      }
    }
  }
  const lookups: ValueLookups = {
    asset: (key) => context.targets.get(`media:${key}`),
    term: (key) => context.targets.get(`term:${key}`),
    entry: (key) => context.targets.get(`entry:${key}`),
    pictureAddress: (address) => {
      const assetId = context.targets.get(`url:${address}`);
      return assetId ? (urls.get(assetId) ?? null) : null;
    },
  };
  return { urls, values: lookups };
}

/**
 * A page keeps its parent when the parent came into the same tree collection, or into one
 * whose content type allows this kind under it (an Umbraco home page with blog posts).
 */
async function parentFor(
  context: SiteItemContext,
  collection: Collection,
  entry: SourceEntry,
): Promise<string | null> {
  if (collection.structure !== "tree" || !entry.parentKey) {
    return null;
  }
  const parentId = context.targets.get(`entry:${entry.parentKey}`);
  const parent = parentId ? await findEntryById(context.database, parentId) : undefined;
  if (!parent) return null;
  if (parent.collectionId === collection.id) return parent.id;
  const allowed = await findAllowedChildren(context.database, parent.collectionId);
  return allowed.includes(collection.handle) ? parent.id : null;
}

/**
 * Checks the values against the content type. A value the field refuses is left out and
 * listed, rather than losing the whole entry; only a problem with the title fails it.
 */
async function checkValues(
  context: SiteItemContext,
  collection: Collection,
  values: Record<string, unknown>,
): Promise<{ data: Record<string, unknown>; leftOut: string[] } | { problem: string }> {
  let attempt = values;
  const leftOut: string[] = [];
  for (let round = 0; round < 3; round += 1) {
    try {
      const data = await validateForCollection(context.database, collection, attempt, {
        assetExists: context.assetExists,
      });
      return { data, leftOut };
    } catch (error) {
      if (!(error instanceof InvalidFieldsError)) throw error;
      const refused = [
        ...new Set(Object.keys(error.fields).map((key) => key.split(".")[0] ?? key)),
      ];
      if (refused.includes("title") || refused.length === 0) {
        return { problem: Object.values(error.fields).join(" ") };
      }
      attempt = Object.fromEntries(
        Object.entries(attempt).filter(([handle]) => !refused.includes(handle)),
      );
      leftOut.push(...refused);
    }
  }
  return { problem: "Its values couldn't be saved." };
}

async function suggestRedirect(
  context: SiteItemContext,
  collection: Collection,
  oldPath: string,
  entryId: string,
  slug: string,
  publishedAt: Date,
): Promise<boolean> {
  const fromPath = normaliseRedirectPath(oldPath);
  const toPath = await placeEntryUrl(
    context.database,
    entryId,
    buildEntryUrl(collection.routePattern, { slug, publishedAt }),
  );
  if (fromPath === "/" || !toPath || fromPath === toPath) {
    return false;
  }
  if (await findRedirectFrom(context.database, DEFAULT_TENANT_ID, fromPath)) {
    return false;
  }
  await insertRedirect(context.database, {
    fromPath,
    toPath,
    statusCode: 301,
    status: "suggested",
    source: "import",
    entryId,
  });
  return true;
}
