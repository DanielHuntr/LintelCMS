import { buildEntryUrl } from "../delivery/entry-urls.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSlugsStartingWith, insertEntry } from "../entries/entries.repository.js";
import { validateForCollection } from "../entries/entries.service.js";
import type { EntryStatus } from "../entries/entries.table.js";
import { insertRevision } from "../entries/revisions.repository.js";
import { firstFreeSlug, slugify } from "../entries/slugs.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { placeEntryUrl } from "../content-roots/content-roots.service.js";
import { findRedirectFrom, insertRedirect } from "../seo/redirects.repository.js";
import { normaliseRedirectPath } from "../seo/redirects.schema.js";
import { plainText, splitWordPressContent } from "./wordpress-content.js";
import {
  alreadyImported,
  type CollectionTarget,
  done,
  failed,
  type ItemContext,
  type ItemResult,
  skipped,
} from "./wordpress-import-context.js";
import { assetAddress, importFile, safeDecode } from "./wordpress-item-handlers.js";
import { findEntryFromEarlierImport, insertItemIfMissing } from "./wordpress-import.repository.js";
import { convertCustomField } from "./wordpress-custom-fields.js";
import { piecesToRichText } from "./wordpress-rich-text.js";
import type { WordPressItem } from "./wxr-parser.js";

/**
 * A WordPress post or page becomes an entry: its title, content as rich text, excerpt,
 * featured image, categories and tags go into the fields wordpress-fields.ts found, its
 * date and status are kept, and a page keeps its parent. The old address becomes a
 * suggested redirect to the new one.
 */
export async function importEntry(context: ItemContext, item: WordPressItem): Promise<ItemResult> {
  const target = item.type === "page" ? context.pages : context.posts;
  if (!target) {
    return skipped(
      `${item.type === "page" ? "Pages" : "Posts"} were left out on the mapping screen.`,
    );
  }
  const earlier = await findEntryFromEarlierImport(
    context.database,
    context.importId,
    context.siteAddress,
    { kind: item.type, sourceId: item.id },
  );
  if (earlier) {
    return alreadyImported(earlier);
  }
  const publishing = choosePublishing(item, context.mapping.drafts === "import");
  if ("skip" in publishing) {
    return skipped(publishing.skip);
  }

  const content = await convertContent(context, target, item);
  const custom = convertCustomFields(context, target, item);
  const checked = await checkValues(context, target, { ...content.data, ...custom.values });
  if ("problem" in checked) {
    return failed(checked.problem);
  }
  const data = checked.data;
  const fieldsLeftOut = [...custom.leftOut, ...checked.leftOut];

  const scope = {
    collectionId: target.collection.id,
    siteId: context.siteId,
    locale: context.locale,
  };
  const wanted = slugify(safeDecode(item.slug)) || slugify(item.title) || "entry";
  const slug = firstFreeSlug(
    wanted,
    new Set(await findSlugsStartingWith(context.database, scope, wanted)),
  );
  const author = context.targets.get(`author:${item.authorLogin}`) ?? null;
  const date = item.date ? new Date(item.date) : new Date();
  const isPublished = publishing.status === "published";

  const entry = await insertEntry(context.database, {
    ...scope,
    slug,
    parentId:
      item.type === "page" && target.collection.structure === "tree"
        ? (context.targets.get(`page:${item.parentId}`) ?? null)
        : null,
    status: publishing.status,
    publishedAt: isPublished ? date : null,
    scheduledFor: publishing.status === "scheduled" ? date : null,
    data,
    publishedData: isPublished ? data : null,
    sortOrder: item.menuOrder,
    createdBy: author,
    updatedBy: author,
    createdAt: date,
  });
  await insertRevision(context.database, {
    entryId: entry.id,
    authorId: author,
    kind: isPublished ? "published" : "edited",
    data,
  });

  const redirected =
    isPublished && context.mapping.redirects
      ? await suggestRedirect(context, target, item.link, entry.id, slug, date)
      : false;
  return done(entry.id, {
    title: item.title,
    keptAsHtml: content.keptAsHtml,
    ...(slug !== wanted ? { renamedFrom: wanted, renamedTo: slug } : {}),
    ...(content.droppedBody ? { droppedBody: true } : {}),
    ...(fieldsLeftOut.length > 0 ? { fieldsLeftOut } : {}),
    redirected,
  });
}

/**
 * Checks the values against the content type. A custom field the content type refuses
 * (a value too long, a choice it doesn't offer) is left out and listed, rather than losing
 * the whole post; a problem with the post's own parts fails it.
 */
async function checkValues(
  context: ItemContext,
  target: CollectionTarget,
  values: Record<string, unknown>,
): Promise<{ data: Record<string, unknown>; leftOut: string[] } | { problem: string }> {
  const customHandles = new Set(Object.values(mappedCustomFields(context, target)));
  let attempt = values;
  const leftOut: string[] = [];
  for (let round = 0; round < 2; round += 1) {
    try {
      const data = await validateForCollection(context.database, target.collection, attempt, {
        assetExists: context.assetExists,
      });
      return { data, leftOut };
    } catch (error) {
      if (!(error instanceof InvalidFieldsError)) {
        throw error;
      }
      const refused = Object.keys(error.fields).map((key) => key.split(".")[0] ?? key);
      if (round === 1 || refused.some((handle) => !customHandles.has(handle))) {
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

/** Custom field key → field handle, for the content type this item goes into. */
function mappedCustomFields(context: ItemContext, target: CollectionTarget) {
  const chosen = target === context.pages ? context.mapping.pageFields : context.mapping.postFields;
  const handles = new Set(target.fields.map((field) => field.handle));
  return Object.fromEntries(
    Object.entries(chosen ?? {}).filter(
      (pair): pair is [string, string] => pair[1] !== null && handles.has(pair[1]),
    ),
  );
}

function convertCustomFields(context: ItemContext, target: CollectionTarget, item: WordPressItem) {
  const values: Record<string, unknown> = {};
  const leftOut: string[] = [];
  for (const [key, handle] of Object.entries(mappedCustomFields(context, target))) {
    const raw = item.customFields[key];
    const field = target.fields.find((candidate) => candidate.handle === handle);
    if (raw === undefined || !field || raw.trim() === "") {
      continue;
    }
    const value =
      field.type === "richText"
        ? piecesToRichText(splitWordPressContent(raw), () => null).document
        : convertCustomField(raw, field, {
            attachment: (attachmentId) => context.targets.get(`attachment:${attachmentId}`),
          });
    if (value === undefined) {
      leftOut.push(handle);
    } else {
      values[handle] = value;
    }
  }
  return { values, leftOut };
}

type Publishing = { status: EntryStatus } | { skip: string };

function choosePublishing(item: WordPressItem, importDrafts: boolean): Publishing {
  switch (item.status) {
    case "publish":
      return { status: "published" };
    case "future":
      return item.date && new Date(item.date) > new Date()
        ? { status: "scheduled" }
        : { status: "published" };
    case "trash":
      return { skip: "It was in the WordPress bin." };
    default:
      return importDrafts
        ? { status: "draft" }
        : { skip: "Drafts were left out on the mapping screen." };
  }
}

async function convertContent(context: ItemContext, target: CollectionTarget, item: WordPressItem) {
  const fields = target.fieldMapping;
  const data: Record<string, unknown> = { [fields.title]: item.title.trim() || "Untitled" };
  let keptAsHtml: string[] = [];

  if (fields.body) {
    const pieces = splitWordPressContent(item.content);
    const addresses = new Map<string, string>();
    for (const piece of pieces) {
      if (piece.kind === "image" && !addresses.has(piece.url)) {
        const address = await findImageAddress(context, piece.url, piece.alt);
        if (address) {
          addresses.set(piece.url, address);
        }
      }
    }
    const converted = piecesToRichText(pieces, (url) => addresses.get(url) ?? null);
    data[fields.body] = converted.document;
    keptAsHtml = converted.keptAsHtml;
  }
  if (fields.excerpt && item.excerpt) {
    data[fields.excerpt] = plainText(item.excerpt);
  }
  const featured =
    item.featuredImageId && context.targets.get(`attachment:${item.featuredImageId}`);
  if (fields.featuredImage && featured) {
    data[fields.featuredImage] = featured;
  }
  if (fields.categories) {
    data[fields.categories] = termIds(context, "category", item.categories);
  }
  if (fields.tags) {
    data[fields.tags] = termIds(context, "tag", item.tags);
  }
  return { data, keptAsHtml, droppedBody: !fields.body && item.content.trim() !== "" };
}

function termIds(context: ItemContext, kind: "category" | "tag", slugs: string[]) {
  const ids = slugs.flatMap((slug) => context.targets.get(`${kind}:${slug}`) ?? []);
  return ids.length > 0 ? ids : null;
}

/**
 * An image in the content: the attachment it is (WordPress adds "-1024x768" to resized
 * copies), or else a file of its own, brought in once and remembered as an "image" item.
 */
async function findImageAddress(
  context: ItemContext,
  url: string,
  alt: string,
): Promise<string | null> {
  const original = url.replace(/-\d+x\d+(\.[a-z0-9]+)(\?.*)?$/i, "$1");
  const known = context.targets.get(`url:${url}`) ?? context.targets.get(`url:${original}`);
  if (known) {
    return assetAddress(context, known);
  }
  const result = await importFile(context, { url, title: "", alt });
  await insertItemIfMissing(context.database, {
    importId: context.importId,
    kind: "image",
    sourceId: url,
    position: 0,
    payload: { url },
    status: result.status,
    targetId: result.targetId,
    message: result.message,
  });
  if (!result.targetId) {
    return null;
  }
  context.targets.set(`url:${url}`, result.targetId);
  return assetAddress(context, result.targetId);
}

async function suggestRedirect(
  context: ItemContext,
  target: CollectionTarget,
  oldAddress: string,
  entryId: string,
  slug: string,
  publishedAt: Date,
): Promise<boolean> {
  if (!oldAddress) {
    return false;
  }
  const fromPath = normaliseRedirectPath(oldAddress);
  // Placed as the site shows it: under its site start, following the page tree.
  const toPath = await placeEntryUrl(
    context.database,
    entryId,
    buildEntryUrl(target.collection.routePattern, { slug, publishedAt }),
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
