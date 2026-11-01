import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { findTermsByIds } from "../taxonomies/terms.repository.js";
import { eachBlock } from "./block-values.js";
import { findPublishedEntryLinks } from "./delivery.repository.js";
import { buildEntryUrl } from "./entry-urls.js";

/**
 * What `entries` and `terms` fields become in the delivery API. Both are looked up once
 * per response, for every entry in it, rather than one value at a time.
 */

export interface DeliveredTerm {
  id: string;
  title: string;
  slug: string;
  taxonomy: string;
}

/** A link to another published entry: enough to print a card or a link to it. */
export interface DeliveredEntryLink {
  id: string;
  title: string;
  slug: string;
  url: string | null;
  collection: string;
  locale: string;
}

export interface DeliveredReferences {
  terms: ReadonlyMap<string, DeliveredTerm>;
  /** Keyed by the id the field stored, which may be another language's version. */
  entries: ReadonlyMap<string, DeliveredEntryLink>;
}

export const noDeliveredReferences: DeliveredReferences = { terms: new Map(), entries: new Map() };

/** Every id listed by fields of this type in these values, inside blocks too, once each. */
export function collectListedIds(
  fields: readonly FieldDefinition[],
  dataList: readonly Readonly<Record<string, unknown>>[],
  fieldType: "terms" | "entries",
): string[] {
  const ids = new Set<string>();
  for (const data of dataList) {
    addListedIds(fields, data, fieldType, ids);
  }
  return [...ids];
}

function addListedIds(
  fields: readonly FieldDefinition[],
  data: Readonly<Record<string, unknown>>,
  fieldType: "terms" | "entries",
  ids: Set<string>,
): void {
  for (const field of fields) {
    const value = data[field.handle];
    if (field.type === fieldType && Array.isArray(value)) {
      value.filter((item): item is string => typeof item === "string").forEach((id) => ids.add(id));
    }
    if (field.type === "blocks") {
      for (const { block, blockType } of eachBlock(field, value)) {
        addListedIds(blockType.fields, block.data, fieldType, ids);
      }
    }
  }
}

/** Looks up the terms and entries these values point at, for delivering them in `locale`. */
export async function lookUpReferences(
  database: DatabaseOrTransaction,
  fields: readonly FieldDefinition[],
  dataList: readonly Readonly<Record<string, unknown>>[],
  locale: string,
): Promise<DeliveredReferences> {
  const termIds = collectListedIds(fields, dataList, "terms");
  const entryIds = collectListedIds(fields, dataList, "entries");
  const terms = await findTermsByIds(database, termIds);
  return {
    terms: new Map(
      terms.map((term) => [
        term.id,
        { id: term.id, title: term.title, slug: term.slug, taxonomy: term.taxonomyHandle },
      ]),
    ),
    entries: await findDeliveredEntryLinks(database, entryIds, locale),
  };
}

/**
 * Published entries for these ids, each in `locale` when it has a translation in it and
 * as it is otherwise. Ids of entries that aren't published are left out, so a website
 * never links to a page that isn't live.
 */
export async function findDeliveredEntryLinks(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
  locale: string,
): Promise<Map<string, DeliveredEntryLink>> {
  const rows = await findPublishedEntryLinks(database, entryIds);
  const links = new Map<string, DeliveredEntryLink>();
  for (const entryId of entryIds) {
    const family = rows.filter((row) => row.id === entryId || row.originId === entryId);
    const chosen =
      family.find((row) => row.locale === locale) ?? family.find((row) => row.id === entryId);
    if (chosen) {
      links.set(entryId, {
        id: chosen.id,
        title: chosen.title ?? "",
        slug: chosen.slug,
        url: buildEntryUrl(chosen.routePattern, chosen),
        collection: chosen.collectionHandle,
        locale: chosen.locale,
      });
    }
  }
  return links;
}
