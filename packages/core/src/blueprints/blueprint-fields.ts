import {
  type FieldDefinition,
  fieldDefinitionSchema,
} from "../fieldtypes/field-definition.schema.js";
import { type FieldMessages, InvalidFieldsError } from "../http/http-errors.js";

/**
 * Every entry blueprint starts with a required Text field called `title`. Lists, search,
 * slugs and revisions all rely on it, so it can be relabelled but never removed.
 */
export const TITLE_FIELD_HANDLE = "title";

/**
 * Checks a blueprint's list of fields: each field on its own (handle, label, type,
 * options), then the list as a whole (unique handles, the title rule). Every problem is
 * reported at once, keyed by the field's handle (or "field 3" when it has none), so the
 * blueprint builder can show them all next to the right fields.
 *
 * Returns the fields to store, with the title marked required whatever was sent.
 */
export function checkBlueprintFields(input: readonly unknown[]): FieldDefinition[] {
  const { fields, messages } = collectFieldProblems(input);

  const titleProblem = findTitleProblem(input);
  if (titleProblem) {
    messages[TITLE_FIELD_HANDLE] ??= titleProblem;
  }

  if (Object.keys(messages).length > 0) {
    throw new InvalidFieldsError(messages);
  }
  return fields.map((field) =>
    field.handle === TITLE_FIELD_HANDLE ? { ...field, required: true } : field,
  );
}

/**
 * The same checks without the title rule, for lists of fields that aren't entries, such
 * as a global set's.
 */
export function checkFieldDefinitions(input: readonly unknown[]): FieldDefinition[] {
  const { fields, messages } = collectFieldProblems(input);
  if (Object.keys(messages).length > 0) {
    throw new InvalidFieldsError(messages);
  }
  return fields;
}

/** Each field on its own, then unique handles. */
function collectFieldProblems(input: readonly unknown[]) {
  const messages: FieldMessages = {};
  const fields: FieldDefinition[] = [];
  const handles = new Set<string>();

  input.forEach((candidate, index) => {
    const key = fieldKey(candidate, index);
    const parsed = fieldDefinitionSchema.safeParse(candidate);
    if (!parsed.success) {
      messages[key] ??= parsed.error.issues[0]?.message ?? "This field isn't right";
      return;
    }
    if (handles.has(parsed.data.handle)) {
      messages[key] ??= `Two fields can't share the handle "${parsed.data.handle}"`;
      return;
    }
    handles.add(parsed.data.handle);
    fields.push(parsed.data);
  });
  return { fields, messages };
}

function findTitleProblem(input: readonly unknown[]): string | null {
  const titleIndex = input.findIndex((candidate) => fieldKey(candidate, -1) === TITLE_FIELD_HANDLE);
  if (titleIndex === -1) {
    return "Every content type needs a Title field (handle “title”). It can be renamed but not removed.";
  }
  if (titleIndex !== 0) {
    return "The Title field has to come first";
  }
  const title = input[titleIndex];
  if (typeof title === "object" && title !== null && "type" in title && title.type !== "text") {
    return "The Title field has to be a Text field";
  }
  return null;
}

function fieldKey(candidate: unknown, index: number): string {
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "handle" in candidate &&
    typeof candidate.handle === "string" &&
    candidate.handle !== ""
  ) {
    return candidate.handle;
  }
  return `field ${index + 1}`;
}
