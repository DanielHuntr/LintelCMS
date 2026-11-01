import { InvalidFieldsError, type FieldMessages } from "../http/http-errors.js";
import type { CheckFieldValues, FieldCheckContext } from "./fieldtype.js";
import type { FieldDefinition } from "./field-definition.schema.js";
import { findFieldtype } from "./fieldtypes.registry.js";

/**
 * Builds the check for an entry's values from its blueprint's fields. The returned
 * function takes the values an editor sent and either gives back the values to store,
 * or throws an InvalidFieldsError with one plain message per field that needs attention.
 *
 * For each field, in order:
 *   1. an empty value (missing, null, blank, an empty list...) is fine unless the field is
 *      required (and the context enforces required fields), and is stored as null;
 *   2. otherwise the value must have the fieldtype's shape and respect its options;
 *   3. then any outside check runs, such as "this image is still in the media library";
 *   4. a field with fields inside (blocks) checks each block's values the same way.
 *
 * Keys that aren't fields of the blueprint are dropped, so a renamed or removed field
 * doesn't leave old values behind.
 */
export function buildEntryDataValidator(
  fields: readonly FieldDefinition[],
  context: FieldCheckContext,
) {
  const checkFields = buildFieldValuesCheck(fields, context);
  return async function validateEntryData(
    data: Readonly<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    const { values, messages } = await checkFields(data);
    if (Object.keys(messages).length > 0) {
      throw new InvalidFieldsError(messages);
    }
    return values;
  };
}

/**
 * The same checks, giving back the messages rather than throwing them, so a field with
 * fields inside (blocks) can check each block and report where the problems are. A
 * problem inside one is keyed by the field's handle, then the inner key: "sections" for a
 * summary, and "sections.<blockId>.heading" for the inner field itself.
 */
function buildFieldValuesCheck(fields: readonly FieldDefinition[], context: FieldCheckContext) {
  const checkInnerValues: CheckFieldValues = (innerFields, data) =>
    buildFieldValuesCheck(innerFields, context)(data);

  const fieldChecks = fields.map((field) => {
    const fieldtype = findFieldtype(field.type);
    if (!fieldtype) {
      // Blueprints are checked when saved, so this means the stored data was edited by hand.
      throw new Error(`The field "${field.handle}" has an unknown type "${field.type}".`);
    }
    return {
      field,
      fieldtype,
      valueSchema: fieldtype.buildValueSchema(field.options, field.label),
    };
  });

  return async function checkFieldValues(
    data: Readonly<Record<string, unknown>>,
  ): Promise<{ values: Record<string, unknown>; messages: FieldMessages }> {
    const values: Record<string, unknown> = {};
    const messages: FieldMessages = {};

    for (const { field, fieldtype, valueSchema } of fieldChecks) {
      const value = data[field.handle];

      if (fieldtype.isEmpty(value)) {
        if (field.required && isEnforced(field.handle, context)) {
          messages[field.handle] = `${field.label} is required`;
        }
        values[field.handle] = null;
        continue;
      }

      const parsed = valueSchema.safeParse(value);
      if (!parsed.success) {
        messages[field.handle] = parsed.error.issues[0]?.message ?? `${field.label} isn't right`;
        continue;
      }

      const problem = await fieldtype.checkReferences?.(
        parsed.data,
        field.label,
        context,
        field.options,
      );
      if (problem) {
        messages[field.handle] = problem;
        continue;
      }

      if (fieldtype.checkNestedValues) {
        const nested = await fieldtype.checkNestedValues(
          parsed.data,
          field.options,
          field.label,
          checkInnerValues,
        );
        for (const [key, message] of Object.entries(nested.messages)) {
          messages[key === "" ? field.handle : `${field.handle}.${key}`] = message;
        }
        values[field.handle] = nested.value;
        continue;
      }
      values[field.handle] = parsed.data;
    }

    return { values, messages };
  };
}

function isEnforced(handle: string, context: FieldCheckContext): boolean {
  return context.requiredFields !== "allowEmpty" || (context.alwaysRequired ?? []).includes(handle);
}
