import { z } from "zod";
import { fieldSchema } from "../blueprints/blueprints.schema.js";
import { collectionStructures } from "../collections/collections.schema.js";

/**
 * The content model in one comparable form, whether it was read from files or from the
 * database. It is made of units, one per file: a content type (a blueprint with the
 * collections that use it), a taxonomy, a global set, a fieldset, a block or a menu.
 *
 * Fields are stored as the admin stores them, with every option's default filled in, so
 * two units are the same exactly when their canonical JSON is the same.
 */

export const modelCollectionSchema = z.object({
  handle: z.string(),
  name: z.string(),
  structure: z.enum(collectionStructures),
  routePattern: z.string().nullable(),
  allowedAtRoot: z.boolean(),
  allowedChildren: z.array(z.string()),
  childrenAsCollection: z.boolean(),
});

export const modelUnitSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("contentType"),
    handle: z.string(),
    name: z.string(),
    fields: z.array(fieldSchema),
    collections: z.array(modelCollectionSchema),
  }),
  z.object({ kind: z.literal("taxonomy"), handle: z.string(), name: z.string() }),
  z.object({
    kind: z.literal("globalSet"),
    handle: z.string(),
    name: z.string(),
    fields: z.array(fieldSchema),
  }),
  z.object({
    kind: z.literal("fieldset"),
    handle: z.string(),
    name: z.string(),
    fields: z.array(fieldSchema),
  }),
  z.object({
    kind: z.literal("block"),
    handle: z.string(),
    name: z.string(),
    icon: z.string(),
    category: z.string(),
    description: z.string(),
    properties: z.array(fieldSchema),
    /** The HTML template, or null for a React component (which lives only in the file). */
    template: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("menu"),
    handle: z.string(),
    name: z.string(),
    maxDepth: z.number().int(),
  }),
]);

export type ModelCollection = z.infer<typeof modelCollectionSchema>;
export type ModelUnit = z.infer<typeof modelUnitSchema>;
export type ModelUnitKind = ModelUnit["kind"];
export type ContentTypeUnit = Extract<ModelUnit, { kind: "contentType" }>;
export type GlobalSetUnit = Extract<ModelUnit, { kind: "globalSet" }>;
export type FieldsetUnit = Extract<ModelUnit, { kind: "fieldset" }>;
export type BlockUnit = Extract<ModelUnit, { kind: "block" }>;

/** Every unit, keyed by `unitKey`. */
export type ContentModel = ReadonlyMap<string, ModelUnit>;

/** The order units are listed in, and applied in: what others refer to comes first. */
export const UNIT_KIND_ORDER: readonly ModelUnitKind[] = [
  "taxonomy",
  "fieldset",
  "block",
  "contentType",
  "globalSet",
  "menu",
];

/** `contentType:post`, `taxonomy:tags`: how a unit is told apart from every other. */
export function unitKey(unit: Pick<ModelUnit, "kind" | "handle">): string {
  return `${unit.kind}:${unit.handle}`;
}

/** Units in a stable order: by kind, then by handle. */
export function sortedUnits(model: ContentModel): ModelUnit[] {
  return [...model.values()].sort(
    (first, second) =>
      UNIT_KIND_ORDER.indexOf(first.kind) - UNIT_KIND_ORDER.indexOf(second.kind) ||
      first.handle.localeCompare(second.handle),
  );
}

export function modelFromUnits(units: readonly ModelUnit[]): ContentModel {
  return new Map(units.map((unit) => [unitKey(unit), unit]));
}

/** JSON with object keys sorted, so equal units always give equal text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, inner]) => inner !== undefined)
        .sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0))
        .map(([key, inner]) => [key, sortKeys(inner)]),
    );
  }
  return value;
}

export function sameUnit(first: ModelUnit | undefined, second: ModelUnit | undefined): boolean {
  if (first === undefined || second === undefined) {
    return first === second;
  }
  return canonicalJson(first) === canonicalJson(second);
}

/** Human words for a unit's kind, for reports. */
export function describeUnitKind(kind: ModelUnitKind): string {
  return {
    contentType: "content type",
    taxonomy: "taxonomy",
    globalSet: "global set",
    fieldset: "fieldset",
    block: "block",
    menu: "menu",
  }[kind];
}
