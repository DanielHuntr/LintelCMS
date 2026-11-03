import { randomUUID } from "node:crypto";
import { createBlueprint } from "../blueprints/blueprints.service.js";
import { findBlueprintByHandle } from "../blueprints/blueprints.repository.js";
import { findCollectionByHandle } from "../collections/collections.repository.js";
import { createCollectionRequestSchema } from "../collections/collections.schema.js";
import { createCollection } from "../collections/collections.service.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { slugify } from "../entries/slugs.js";
import { createGlobalSet, saveGlobalValues } from "../globals/globals.service.js";
import { findGlobalSetByHandle } from "../globals/global-sets.repository.js";
import { HttpError, InvalidFieldsError } from "../http/http-errors.js";
import { getAsset, updateAsset, uploadAsset } from "../media/media.service.js";
import { findTaxonomyByHandle } from "../taxonomies/taxonomies.repository.js";
import { createTaxonomyRequestSchema } from "../taxonomies/taxonomies.schema.js";
import { createTaxonomy } from "../taxonomies/taxonomies.service.js";
import {
  done,
  failed,
  type ItemResult,
  skipped,
} from "../wordpress-import/wordpress-import-context.js";
import { MediaNotAllowedError } from "../wordpress-import/wordpress-import.errors.js";
import { findTermInTaxonomy, insertTerm } from "../wordpress-import/wordpress-import.repository.js";
import { defineImportedField, type ImportedFieldDefinition } from "./imported-fields.js";
import { type ImportedMenuLink, saveImportedMenu } from "./imported-menus.js";
import { convertValue } from "./imported-values.js";
import type { SiteItemContext } from "./site-import-context.js";
import type {
  SourceContentType,
  SourceField,
  SourceGlobalSet,
  SourceMedia,
  SourceMenu,
  SourceMenuLink,
  SourceTerm,
} from "./source-site.js";

/**
 * Bringing in the things entries point at: taxonomies and terms, content types, pictures,
 * then menus and global values. Entries are in site-import-entries.ts. Each handler
 * returns how it went rather than throwing, so one bad item never stops an import.
 */

export async function importTaxonomy(
  context: SiteItemContext,
  taxonomy: { key: string; name: string },
): Promise<ItemResult> {
  const handle = context.mapping.taxonomies[taxonomy.key];
  if (!handle) {
    return skipped("This taxonomy was left out on the mapping screen.");
  }
  const existing = await findTaxonomyByHandle(context.database, DEFAULT_TENANT_ID, handle);
  if (existing) {
    return done(existing.id, { alreadyHere: true });
  }
  const created = await createTaxonomy(
    context.database,
    createTaxonomyRequestSchema.parse({ handle, name: taxonomy.name.slice(0, 100) || handle }),
  );
  return done(created.id, { createdType: `${created.name} (taxonomy)` });
}

export async function importTerm(
  context: SiteItemContext,
  term: SourceTerm & { taxonomyKey: string },
): Promise<ItemResult> {
  const handle = context.mapping.taxonomies[term.taxonomyKey];
  if (!handle) {
    return skipped("This taxonomy was left out on the mapping screen.");
  }
  const slug = slugify(term.slug) || slugify(term.title) || "term";
  const found = await findTermInTaxonomy(context.database, DEFAULT_TENANT_ID, handle, slug);
  if (!found) {
    return failed(`The taxonomy “${handle}” isn't here.`);
  }
  if (found.id) {
    return done(found.id, { alreadyHere: true });
  }
  const termId = await insertTerm(context.database, {
    taxonomyId: found.taxonomyId,
    title: term.title.slice(0, 200) || slug,
    slug,
    description: term.description.slice(0, 2000),
  });
  return done(termId);
}

/**
 * A content type becomes a content type and collection here, with a field for each field
 * the mapping keeps, or goes into a collection that is already here.
 */
export async function importContentType(
  context: SiteItemContext,
  type: SourceContentType,
): Promise<ItemResult> {
  const chosen = context.mapping.contentTypes[type.key];
  if (!chosen?.collection) {
    return skipped("This kind of content was left out on the mapping screen.");
  }
  const existing = await findCollectionByHandle(
    context.database,
    DEFAULT_TENANT_ID,
    chosen.collection,
  );
  if (existing) {
    return done(existing.id, { alreadyHere: true });
  }
  if (!chosen.create) {
    return failed(`There is no collection “${chosen.collection}” here any more.`);
  }
  const fields = fieldsFor(context, type, chosen.fields);
  const blueprintHandle = await freeBlueprintHandle(context, chosen.collection);
  try {
    await createBlueprint(context.database, {
      handle: blueprintHandle,
      name: chosen.name,
      fields: [{ handle: "title", label: "Title", type: "text", options: {} }, ...fields],
    });
    const collection = await createCollection(
      context.database,
      createCollectionRequestSchema.parse({
        handle: chosen.collection,
        name: chosen.name,
        blueprintHandle,
        structure: type.structure,
        routePattern: `${type.routePrefix}/{slug}`,
        ...(type.structure === "tree" && type.allowedChildren
          ? {
              allowedChildren: type.allowedChildren.flatMap(
                (typeKey) => context.mapping.contentTypes[typeKey]?.collection ?? [],
              ),
            }
          : {}),
        ...(type.allowedAtRoot === false ? { allowedAtRoot: false } : {}),
      }),
    );
    return done(collection.id, { createdType: chosen.name });
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return failed(Object.values(error.fields).join(" "));
    }
    if (error instanceof HttpError) {
      return failed(error.message);
    }
    throw error;
  }
}

function fieldsFor(
  context: SiteItemContext,
  type: SourceContentType,
  chosenFields: Record<string, string | null>,
): ImportedFieldDefinition[] {
  const used = new Set(["title"]);
  const fields: ImportedFieldDefinition[] = [];
  for (const field of type.fields) {
    const handle = chosenFields[field.key];
    if (!handle || used.has(handle)) continue;
    const definition = defineImportedField(field, handle, linksFor(context, field));
    if (definition) {
      used.add(handle);
      fields.push(definition);
    }
  }
  return fields;
}

function linksFor(context: SiteItemContext, field: SourceField) {
  return {
    taxonomyHandle: field.taxonomyKey ? context.mapping.taxonomies[field.taxonomyKey] : null,
    collectionHandles: (field.typeKeys ?? []).flatMap(
      (typeKey) => context.mapping.contentTypes[typeKey]?.collection ?? [],
    ),
  };
}

/** Collections and blueprints are named apart: a "page" blueprint may already be here. */
async function freeBlueprintHandle(context: SiteItemContext, wanted: string): Promise<string> {
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const handle = attempt === 1 ? wanted : `${wanted.slice(0, 58)}_${attempt}`;
    if (!(await findBlueprintByHandle(context.database, DEFAULT_TENANT_ID, handle))) {
      return handle;
    }
  }
  return `${wanted.slice(0, 50)}_${randomUUID().slice(0, 8)}`.replace(/-/g, "_");
}

/** Brings one picture or file into the media library. The same file twice gives the same asset. */
export async function importMedia(
  context: SiteItemContext,
  media: SourceMedia,
): Promise<ItemResult> {
  if (!context.media) {
    return skipped("Pictures were left out on the mapping screen.");
  }
  const address = media.archivePath ? `archive:${media.archivePath}` : (media.url ?? "");
  try {
    if (context.dryRun) {
      await context.media.check(address);
      return done(randomUUID(), { url: address });
    }
    const contents = await context.media.fetch(address);
    const library = context.mediaContext(context.database);
    const { asset } = await uploadAsset(
      library,
      { filename: media.filename, contents },
      context.startedBy,
    );
    if (media.alt && !asset.alt) {
      await updateAsset(library, asset.id, { alt: media.alt.slice(0, 500) });
    }
    return done(asset.id, { url: asset.url });
  } catch (error) {
    if (error instanceof MediaNotAllowedError) {
      return failed(`Not brought in: ${error.message}.`);
    }
    if (error instanceof HttpError) {
      return failed(error.message);
    }
    throw error;
  }
}

/** The media library address of an asset, for pictures in rich text and designed pages. */
export async function assetUrl(context: SiteItemContext, assetId: string): Promise<string> {
  if (context.dryRun) {
    return `/media/${assetId}/file`;
  }
  return (await getAsset(context.mediaContext(context.database), assetId)).url;
}

export async function importMenu(context: SiteItemContext, menu: SourceMenu): Promise<ItemResult> {
  if (!context.mapping.menus) {
    return skipped("Menus were left out on the mapping screen.");
  }
  if (menu.links.length === 0) {
    return skipped("This menu has no links.");
  }
  const toLinks = (links: readonly SourceMenuLink[]): ImportedMenuLink[] =>
    links.map((link) => ({
      label: link.label,
      entryId: link.entryKey ? (context.targets.get(`entry:${link.entryKey}`) ?? null) : null,
      url: link.entryKey ? null : link.url,
      children: toLinks(link.children),
    }));
  const saved = await saveImportedMenu(context.database, context.siteId, {
    name: menu.name,
    links: toLinks(menu.links),
  });
  return done(saved.navigationId, {
    title: menu.name,
    ...(saved.leftOut > 0 ? { menuLinksLeftOut: saved.leftOut } : {}),
  });
}

/**
 * Site-wide values (Statamic globals, Umbraco dictionary items) become a global set with
 * a field for each, made if it isn't here. A set already here keeps its own fields, and
 * only the values it has fields for are filled in.
 */
export async function importGlobalSet(
  context: SiteItemContext,
  globalSet: SourceGlobalSet,
): Promise<ItemResult> {
  if (!context.mapping.globals) {
    return skipped("Global values were left out on the mapping screen.");
  }
  let existing = await findGlobalSetByHandle(context.database, DEFAULT_TENANT_ID, globalSet.handle);
  if (!existing) {
    const fields = globalSet.fields.flatMap(
      (field) => defineImportedField(field, field.key, linksFor(context, field)) ?? [],
    );
    await createGlobalSet(context.database, {
      handle: globalSet.handle,
      name: globalSet.name.slice(0, 100) || globalSet.handle,
      fields,
    });
    existing = await findGlobalSetByHandle(context.database, DEFAULT_TENANT_ID, globalSet.handle);
  }
  if (!existing) {
    return failed("The global set couldn't be made.");
  }
  const data: Record<string, unknown> = {};
  for (const field of existing.fields) {
    const source = globalSet.fields.find((candidate) => candidate.key === field.handle);
    const value = globalSet.values[field.handle];
    if (!source || value === undefined) continue;
    const converted = convertValue(value, source.kind, field, {
      asset: (key) => context.targets.get(`media:${key}`),
      term: (key) => context.targets.get(`term:${key}`),
      entry: (key) => context.targets.get(`entry:${key}`),
      pictureAddress: () => null,
    });
    if (converted) data[field.handle] = converted.value;
  }
  try {
    await saveGlobalValues(
      context.database,
      globalSet.handle,
      undefined,
      { data },
      { authorId: null, assetExists: context.assetExists },
    );
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return failed(Object.values(error.fields).join(" "));
    }
    throw error;
  }
  return done(existing.id, { title: globalSet.name });
}
