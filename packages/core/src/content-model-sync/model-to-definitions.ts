import { TITLE_FIELD_HANDLE } from "../blueprints/blueprint-fields.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { findFieldtype } from "../fieldtypes/fieldtypes.registry.js";
import { defaultAllowedChildren } from "../collections/collections.schema.js";
import { canonicalJson, type ModelCollection, type ModelUnit } from "./content-model.schema.js";
import type { CollectionDefinition, ModelDefinition } from "./define-content-model.js";
import { type FieldSpec, labelFromHandle } from "./field-helpers.js";
import { defaultRoutePattern } from "./model-from-definitions.js";

/**
 * The other direction: a unit of the model as a file would define it, leaving out
 * everything that is a default (a label that matches the handle, `required: false`, empty
 * help text, `multiple: false`), so files stay short and say only what was chosen.
 * Reading the result back gives the same unit.
 */

/** Option values that are the fieldtype's default, so not worth writing down. */
const DEFAULT_OPTIONS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  date: { includeTime: false },
  select: { multiple: false },
  colour: { swatches: [] },
  entries: { collections: [] },
  radio: { inline: false },
  checkboxes: { inline: false },
  range: { min: 0, max: 100, step: 1, suffix: "" },
  slug: { from: "title" },
  code: { language: "plain" },
  table: { headerRow: true },
  revealer: { buttonLabel: "" },
  repeater: { addLabel: "" },
};

/** The shared settings, in the order files list them, after the type, label and help text. */
const SETTING_ORDER = [
  "helpTextPosition",
  "width",
  "placeholder",
  "default",
  "readOnly",
  "hidden",
  "showInList",
  "validation",
  "conditions",
] as const;

export function definitionFromUnit(unit: ModelUnit): ModelDefinition {
  if (unit.kind === "contentType") {
    const collections = unit.collections.map(collectionDefinition);
    return {
      kind: "contentType",
      handle: unit.handle,
      name: unit.name,
      ...(collections.length === 0
        ? {}
        : { collection: collections.length === 1 ? collections[0] : collections }),
      fields: fieldSpecs(unit.fields, { isEntry: true }),
    };
  }
  if (unit.kind === "globalSet") {
    const fields = fieldSpecs(unit.fields, { isEntry: false });
    return { kind: "globalSet", handle: unit.handle, name: unit.name, fields };
  }
  if (unit.kind === "fieldset") {
    const fields = fieldSpecs(unit.fields, { isEntry: false });
    return { kind: "fieldset", handle: unit.handle, name: unit.name, fields };
  }
  if (unit.kind === "menu") {
    return {
      kind: "menu",
      handle: unit.handle,
      name: unit.name,
      ...(unit.maxDepth === 3 ? {} : { maxDepth: unit.maxDepth }),
    };
  }
  return { kind: "taxonomy", handle: unit.handle, name: unit.name };
}

function collectionDefinition(collection: ModelCollection): CollectionDefinition {
  const definition: CollectionDefinition = {
    handle: collection.handle,
    name: collection.name,
    structure: collection.structure,
  };
  if (collection.routePattern !== defaultRoutePattern(collection.handle)) {
    definition.route = collection.routePattern;
  }
  if (!collection.allowedAtRoot) {
    definition.allowedAtRoot = false;
  }
  const defaultChildren = defaultAllowedChildren(collection.handle, collection.structure);
  if (canonicalJson(collection.allowedChildren) !== canonicalJson(defaultChildren)) {
    definition.allowedChildren = collection.allowedChildren;
  }
  if (collection.childrenAsCollection) {
    definition.childrenAsCollection = true;
  }
  return definition;
}

function fieldSpecs(
  fields: readonly FieldDefinition[],
  { isEntry }: { isEntry: boolean },
): Record<string, FieldSpec> {
  return Object.fromEntries(
    fields.map((field) => [
      field.handle,
      fieldSpec(field, isEntry && field.handle === TITLE_FIELD_HANDLE),
    ]),
  );
}

function fieldSpec(field: FieldDefinition, isTitle: boolean): FieldSpec {
  const spec: Record<string, unknown> = { type: field.type };
  if (field.label !== labelFromHandle(field.handle)) {
    spec.label = field.label;
  }
  // The title is always required, so saying so would only be noise.
  if (field.required && !isTitle) {
    spec.required = true;
  }
  if (field.helpText !== "") {
    spec.helpText = field.helpText;
  }
  // Settings are stored without their defaults already (see field-settings.schema.ts).
  for (const key of SETTING_ORDER) {
    if (field[key] !== undefined) {
      spec[key] = key === "conditions" ? conditionsSpec(field.conditions) : field[key];
    }
  }
  const defaults = DEFAULT_OPTIONS[field.type] ?? {};
  for (const [key, value] of inOptionOrder(field)) {
    if (value === undefined || isSameValue(value, defaults[key])) {
      continue;
    }
    // A fieldset field's copy of the fieldset's fields comes from the fieldset's own file.
    if (field.type === "fieldset" && key === "fields") {
      continue;
    }
    spec[key] =
      key === "blockTypes"
        ? blockTypeDefinitions(value)
        : key === "fields"
          ? fieldSpecs(value as FieldDefinition[], { isEntry: false })
          : value;
  }
  return spec as unknown as FieldSpec;
}

/** Options in the order their fieldtype lists them (`taxonomy` before `maxItems`). */
function inOptionOrder(field: FieldDefinition): [string, unknown][] {
  const schema = findFieldtype(field.type)?.optionsSchema;
  const order = schema && "shape" in schema ? Object.keys(schema.shape as object) : [];
  const position = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  return Object.entries(field.options).sort(
    ([first], [second]) => position(first) - position(second) || first.localeCompare(second),
  );
}

interface StoredBlockType {
  handle: string;
  name: string;
  description: string;
  fields: FieldDefinition[];
}

function blockTypeDefinitions(value: unknown): Record<string, unknown> {
  const blockTypes = value as StoredBlockType[];
  return Object.fromEntries(
    blockTypes.map((blockType) => {
      const definition: Record<string, unknown> = {};
      if (blockType.name !== labelFromHandle(blockType.handle)) {
        definition.name = blockType.name;
      }
      if (blockType.description !== "") {
        definition.description = blockType.description;
      }
      definition.fields = fieldSpecs(blockType.fields, { isEntry: false });
      return [blockType.handle, definition];
    }),
  );
}

function isSameValue(value: unknown, other: unknown): boolean {
  return other !== undefined && JSON.stringify(value) === JSON.stringify(other);
}

/** Conditions without `action: "show"`, `match: "all"` and `keepHiddenValues: false`. */
function conditionsSpec(conditions: FieldDefinition["conditions"]): Record<string, unknown> {
  const spec: Record<string, unknown> = {};
  if (!conditions) return spec;
  if (conditions.action !== "show") spec.action = conditions.action;
  if (conditions.match !== "all") spec.match = conditions.match;
  spec.rules = conditions.rules;
  if (conditions.keepHiddenValues) spec.keepHiddenValues = true;
  return spec;
}
