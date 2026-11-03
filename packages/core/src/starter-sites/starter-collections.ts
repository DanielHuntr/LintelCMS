import type { StarterCollection } from "@lintel/builder-model";
import { findCollectionByHandle } from "../collections/collections.repository.js";
import { ensureCollection, findCollectionOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createEntry, type EntryChangeContext } from "../entries/entries.service.js";
import { publishEntry } from "../entries/entry-publishing.service.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { Site } from "../sites/sites.table.js";
import { listCollectionPages } from "./starter-sites.repository.js";

/**
 * A template's own collections (property listings, podcast episodes): made when the site
 * has no collection with that handle, with the template's sample entries, published with
 * the pages when they are. A collection the site already has is left exactly as it is, so
 * applying a template twice never adds the samples twice. Answers the handles it made.
 */
export async function addStarterCollections(
  database: DatabaseOrTransaction,
  collections: readonly StarterCollection[],
  site: Site,
  context: EntryChangeContext,
  publish: boolean,
): Promise<string[]> {
  const made: string[] = [];
  for (const collection of collections) {
    if (await findCollectionByHandle(database, DEFAULT_TENANT_ID, collection.handle)) continue;
    await ensureCollection(database, {
      handle: collection.handle,
      name: collection.name,
      structure: "flat",
      // The entries have no page of their own: the template's pages list them.
      routePattern: null,
      blueprint: {
        handle: collection.handle.replace(/s$/, "") || collection.handle,
        name: collection.itemName,
        fields: [
          field({ handle: "title", label: "Title", type: "text" }, true),
          ...collection.fields.map((own) => field(own)),
        ],
      },
    });
    const stored = await findCollectionOrFail(database, collection.handle, site);
    const entries = await listCollectionPages(database, stored.id, site.id, site.locale);
    if (entries.length === 0) {
      for (const entry of collection.entries) {
        const created = await createEntry(
          database,
          collection.handle,
          { data: { ...entry.data, title: entry.title }, slug: entry.slug, parentId: null },
          context,
          site,
        );
        if (publish) await publishEntry(database, created.id, context);
      }
    }
    made.push(collection.handle);
  }
  return made;
}

function field(own: StarterCollection["fields"][number], required = false): FieldDefinition {
  return {
    handle: own.handle,
    label: own.label,
    type: own.type,
    required,
    helpText: own.helpText ?? "",
    options: {},
  };
}
