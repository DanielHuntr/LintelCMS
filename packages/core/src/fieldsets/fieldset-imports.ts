import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";

/**
 * A Fieldset field keeps a copy of its fieldset's fields in `options.fields`, so the editor,
 * the API and GraphQL can treat it exactly like a group. These functions fill that copy in
 * (when a blueprint is saved, or a fieldset changes) and find which lists use a fieldset.
 * They work on fields as sent, before they are checked, and look inside groups, repeaters
 * and block types too.
 */

/** Each fieldset's fields, by handle. */
export type FieldsetFields = ReadonlyMap<string, readonly FieldDefinition[]>;

export interface FilledFields {
  fields: unknown[];
  /** A message per top-level field that uses a fieldset that doesn't exist. */
  missing: Record<string, string>;
}

export function withFieldsetFields(
  rawFields: readonly unknown[],
  fieldsets: FieldsetFields,
): FilledFields {
  const missing: Record<string, string> = {};
  const fields = rawFields.map((candidate, index) =>
    fillField(candidate, fieldsets, (handle) => {
      const key = handleOf(candidate) ?? `field ${index + 1}`;
      missing[key] ??= `There is no fieldset with the handle "${handle}"`;
    }),
  );
  return { fields, missing };
}

function fillField(
  candidate: unknown,
  fieldsets: FieldsetFields,
  onMissing: (handle: string) => void,
): unknown {
  if (!isRecord(candidate) || !isRecord(candidate.options)) {
    return candidate;
  }
  const options = { ...candidate.options };
  if (candidate.type === "fieldset" && typeof options.fieldset === "string") {
    const fields = fieldsets.get(options.fieldset);
    if (fields) {
      options.fields = fields;
    } else {
      onMissing(options.fieldset);
    }
    return { ...candidate, options };
  }
  if (Array.isArray(options.fields)) {
    options.fields = options.fields.map((inner) => fillField(inner, fieldsets, onMissing));
  }
  if (Array.isArray(options.blockTypes)) {
    options.blockTypes = options.blockTypes.map((blockType) =>
      isRecord(blockType) && Array.isArray(blockType.fields)
        ? {
            ...blockType,
            fields: blockType.fields.map((inner) => fillField(inner, fieldsets, onMissing)),
          }
        : blockType,
    );
  }
  return { ...candidate, options };
}

/** Whether a list of fields uses the fieldset, anywhere inside. */
export function usesFieldset(fields: readonly unknown[], handle: string): boolean {
  return fields.some((field) => {
    if (!isRecord(field) || !isRecord(field.options)) return false;
    const { options } = field;
    if (field.type === "fieldset") return options.fieldset === handle;
    const inner = Array.isArray(options.fields) ? options.fields : [];
    const blockFields = Array.isArray(options.blockTypes)
      ? options.blockTypes.flatMap((blockType) =>
          isRecord(blockType) && Array.isArray(blockType.fields) ? blockType.fields : [],
        )
      : [];
    return usesFieldset([...inner, ...blockFields], handle);
  });
}

/** The fieldset handles a fieldset's own fields mustn't use: fieldsets don't nest. */
export function nestedFieldsetProblem(fields: readonly unknown[]): string | null {
  const nests = fields.some(
    (field) => isRecord(field) && (field.type === "fieldset" || field.type === "tab"),
  );
  return nests ? "A fieldset can't hold another fieldset or a tab" : null;
}

function handleOf(candidate: unknown): string | null {
  return isRecord(candidate) && typeof candidate.handle === "string" && candidate.handle !== ""
    ? candidate.handle
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
