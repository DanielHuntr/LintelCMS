import { referencedFields, referenceStart } from "@lintel/field-conditions";

/**
 * Conditions name other fields by handle ("Show when Layout is Video"). When a blueprint is
 * saved, or read from a content model file, each rule has to point at a field that exists,
 * so a typo can't quietly hide a field for ever.
 */

interface FieldWithConditions {
  handle: string;
  label: string;
  type: string;
  conditions?: { rules: readonly { field: string }[] } | undefined;
  options?: Record<string, unknown>;
}

/**
 * The problem with a field's conditions, or null. `siblings` are the fields in the same list;
 * `rootFields` are the blueprint's own fields, or null inside a group or block, where
 * "$parent." and "$root." references are checked when the entry is edited instead.
 */
export function conditionReferenceProblem(
  field: FieldWithConditions,
  siblings: readonly FieldWithConditions[],
  rootFields: readonly FieldWithConditions[] | null,
): string | null {
  if (!field.conditions) {
    return null;
  }
  for (const reference of referencedFields(field.conditions)) {
    const { levelsUp, path } = referenceStart(reference);
    if (levelsUp !== 0 && levelsUp !== "root") {
      if (rootFields) {
        return `${field.label} has a condition on "${reference}", but it isn't inside another field`;
      }
      continue;
    }
    const list = levelsUp === "root" ? rootFields : siblings;
    if (!list) {
      continue;
    }
    const [handle] = path;
    if (handle === field.handle && levelsUp === 0) {
      return `${field.label} can't have a condition on itself`;
    }
    if (!list.some((candidate) => candidate.handle === handle)) {
      return `${field.label} has a condition on "${reference}", but there's no field with that handle`;
    }
  }
  return null;
}
