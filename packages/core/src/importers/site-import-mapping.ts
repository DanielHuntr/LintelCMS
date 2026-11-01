import { canGoInto, fieldHandle } from "./imported-fields.js";
import type {
  ContentTypeMapping,
  SiteImportFound,
  SiteImportMapping,
} from "./site-import.schema.js";
import { siteImportMappingSchema } from "./site-import.schema.js";
import type { SourceFieldKind } from "./source-site.js";

/**
 * The mapping screen's starting choice, and the checks on what people choose.
 *
 * Each kind of content goes into the collection here with the same handle when there is
 * one (an old site's pages into Pages), its fields into fields with the same handle (or
 * label) that can hold them; otherwise a new content type and collection are made with a
 * field for every field the old site had. Nothing is left out unless people choose to.
 */
export interface ExistingField {
  handle: string;
  label: string;
  type: string;
}

export function suggestMapping(
  found: SiteImportFound,
  collectionFields: Record<string, ExistingField[]>,
): SiteImportMapping {
  const contentTypes: Record<string, ContentTypeMapping> = {};
  for (const type of found.contentTypes) {
    const existing = collectionFields[type.handle];
    contentTypes[type.key] = existing
      ? {
          collection: type.handle,
          create: false,
          name: type.name,
          fields: matchFields(type.fields, existing),
        }
      : {
          collection: type.handle,
          create: true,
          name: type.name,
          fields: newFieldHandles(type.fields),
        };
  }
  // A taxonomy with the same handle is used as it is; any other is made.
  const taxonomies = Object.fromEntries(
    found.taxonomies.map((taxonomy) => [taxonomy.key, taxonomy.handle]),
  );
  return { ...siteImportMappingSchema.parse({}), contentTypes, taxonomies };
}

/** Each source field into the existing field with its handle or label, if it can hold it. */
export function matchFields(
  fields: ReadonlyArray<{ key: string; label: string; kind: SourceFieldKind }>,
  existing: readonly ExistingField[],
): Record<string, string | null> {
  const taken = new Set<string>();
  const result: Record<string, string | null> = {};
  for (const field of fields) {
    const handle = fieldHandle(field.key);
    const candidates = existing.filter(
      (candidate) => canGoInto(field.kind, candidate.type) && !taken.has(candidate.handle),
    );
    const match =
      candidates.find((candidate) => candidate.handle === handle) ??
      candidates.find((candidate) => candidate.label.toLowerCase() === field.label.toLowerCase()) ??
      // A designed page goes into the content type's page field, whatever it is called.
      (field.kind === "design" ? candidates[0] : undefined);
    result[field.key] = match ? match.handle : null;
    if (match) taken.add(match.handle);
  }
  return result;
}

/** Handles for a new content type's fields: unique, never "title" (every type has one). */
export function newFieldHandles(
  fields: ReadonlyArray<{ key: string }>,
): Record<string, string | null> {
  const taken = new Set(["title"]);
  const result: Record<string, string | null> = {};
  for (const field of fields) {
    let handle = fieldHandle(field.key);
    for (let number = 2; taken.has(handle); number += 1) {
      handle = `${fieldHandle(field.key).slice(0, 58)}_${number}`;
    }
    taken.add(handle);
    result[field.key] = handle;
  }
  return result;
}

/** Problems with the chosen mapping, keyed for the screen; empty when it can be used. */
export function findMappingProblems(
  found: SiteImportFound,
  mapping: SiteImportMapping,
  collectionFields: Record<string, ExistingField[]>,
): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const type of found.contentTypes) {
    const chosen = mapping.contentTypes[type.key];
    if (!chosen?.collection) continue;
    const key = `contentTypes.${type.key}`;
    const existing = collectionFields[chosen.collection];
    if (!chosen.create && !existing) {
      problems[key] = `There is no collection “${chosen.collection}” here.`;
      continue;
    }
    if (chosen.create && existing) {
      problems[key] =
        `There is already a collection “${chosen.collection}”. Choose it, or give the new one another handle.`;
      continue;
    }
    const used = new Set<string>();
    for (const field of type.fields) {
      const handle = chosen.fields[field.key];
      if (!handle) continue;
      if (used.has(handle) || handle === "title") {
        problems[`${key}.${field.key}`] = `Two fields can't both go into “${handle}”.`;
      }
      used.add(handle);
      const target = existing?.find((candidate) => candidate.handle === handle);
      if (!chosen.create && !target) {
        problems[`${key}.${field.key}`] = `“${chosen.collection}” has no field “${handle}”.`;
      } else if (target && !canGoInto(field.kind, target.type)) {
        problems[`${key}.${field.key}`] = `“${field.label}” can't go into a ${target.type} field.`;
      }
    }
  }
  return problems;
}
