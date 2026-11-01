import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { findTermsByIds } from "../taxonomies/terms.repository.js";
import { findUserNamesByIds } from "../users/users.repository.js";
import { innerValueSets } from "./block-values.js";
import { findPublishedEntryLinks } from "./delivery.repository.js";
import { placeEntryUrls } from "../content-roots/content-roots.service.js";
import { buildEntryUrl } from "./entry-urls.js";

/**
 * What `entries`, `terms` and `users` fields become in the delivery API. All are looked up
 * once per response, for every entry in it, rather than one value at a time.
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

/** A person chosen in a People field: their name only, never their email address. */
export interface DeliveredPerson {
  id: string;
  name: string;
}

export interface DeliveredReferences {
  terms: ReadonlyMap<string, DeliveredTerm>;
  /** Keyed by the id the field stored, which may be another language's version. */
  entries: ReadonlyMap<string, DeliveredEntryLink>;
  users: ReadonlyMap<string, DeliveredPerson>;
}

export const noDeliveredReferences: DeliveredReferences = {
  terms: new Map(),
  entries: new Map(),
  users: new Map(),
};

type ListedFieldType = "terms" | "entries" | "users";

/** Every id listed by fields of this type in these values, inside blocks too, once each. */
export function collectListedIds(
  fields: readonly FieldDefinition[],
  dataList: readonly Readonly<Record<string, unknown>>[],
  fieldType: ListedFieldType,
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
  fieldType: ListedFieldType,
  ids: Set<string>,
): void {
  for (const field of fields) {
    const value = data[field.handle];
    if (field.type === fieldType && Array.isArray(value)) {
      value.filter((item): item is string => typeof item === "string").forEach((id) => ids.add(id));
    }
    for (const inner of innerValueSets(field, value)) {
      addListedIds(inner.fields, inner.data, fieldType, ids);
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
  const userIds = collectListedIds(fields, dataList, "users");
  const [terms, people] = await Promise.all([
    findTermsByIds(database, termIds),
    findUserNamesByIds(database, userIds),
  ]);
  return {
    users: new Map(people.map((person) => [person.id, person])),
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
  const urls = await placeEntryUrls(
    database,
    rows.map((row) => ({
      id: row.id,
      url: buildEntryUrl(row.routePattern, row),
      site: { pathPrefix: row.pathPrefix },
    })),
  );
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
        url: urls.get(chosen.id) ?? null,
        collection: chosen.collectionHandle,
        locale: chosen.locale,
      });
    }
  }
  return links;
}
