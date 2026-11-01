import {
  type ConditionScope,
  innerScope,
  isFieldVisible,
  topScope,
} from "@lintel/field-conditions";
import { InvalidFieldsError, type FieldMessages } from "../http/http-errors.js";
import type { FieldDefinition } from "./field-definition.schema.js";
import { findValidationProblem } from "./field-validation.js";
import type { CheckFieldValues, FieldCheckContext, Fieldtype } from "./fieldtype.js";
import { findFieldtype } from "./fieldtypes.registry.js";

/**
 * Builds the check for an entry's values from its blueprint's fields. The returned
 * function takes the values an editor sent and either gives back the values to store,
 * or throws an InvalidFieldsError with one plain message per field that needs attention.
 *
 * For each field, in order:
 *   0. a field that only arranges the editor (a section, a spacer) stores nothing, and a
 *      field hidden by its conditions isn't checked: its value is cleared, or kept as it was
 *      if the field keeps hidden values;
 *   1. an empty value (missing, null, blank, an empty list...) is fine unless the field is
 *      required (and the context enforces required fields), and is stored as null;
 *   2. otherwise the value must have the fieldtype's shape and respect its options, then
 *      the field's own validation rules (length, pattern, unique...);
 *   3. then any outside check runs, such as "this image is still in the media library";
 *   4. a field with fields inside (blocks, groups, repeaters) checks those the same way,
 *      with their conditions able to look out at this level's values;
 *   5. a fieldtype with rules about who changed what (page code) compares with the old value.
 *
 * Keys that aren't fields of the blueprint are dropped, so a renamed or removed field
 * doesn't leave old values behind.
 */
export function buildEntryDataValidator(
  fields: readonly FieldDefinition[],
  context: FieldCheckContext,
) {
  const checkFields = buildFieldValuesCheck(fields, context, true);
  return async function validateEntryData(
    data: Readonly<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    const { values, messages } = await checkFields(data, null);
    if (Object.keys(messages).length > 0) {
      throw new InvalidFieldsError(messages);
    }
    return values;
  };
}

interface FieldCheck {
  field: FieldDefinition;
  fieldtype: Fieldtype;
  valueSchema: ReturnType<Fieldtype["buildValueSchema"]>;
}

/**
 * The same checks, giving back the messages rather than throwing them, so a field with
 * fields inside (blocks) can check each block and report where the problems are. A
 * problem inside one is keyed by the field's handle, then the inner key: "sections" for a
 * summary, and "sections.<blockId>.heading" for the inner field itself.
 */
function buildFieldValuesCheck(
  fields: readonly FieldDefinition[],
  context: FieldCheckContext,
  isTopLevel: boolean,
) {
  const fieldChecks: FieldCheck[] = fields.map((field) => {
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
    parentScope: ConditionScope | null,
  ): Promise<{ values: Record<string, unknown>; messages: FieldMessages }> {
    const values: Record<string, unknown> = {};
    const messages: FieldMessages = {};
    const scope = parentScope ? innerScope(data, parentScope) : topScope(data);
    // Fields inside this level see this level's values as "$parent.".
    const checkInnerValues: CheckFieldValues = (innerFields, innerData) =>
      buildFieldValuesCheck(innerFields, context, false)(innerData, scope);

    for (const check of fieldChecks) {
      const { field, fieldtype } = check;
      if (!fieldtype.holdsValue) {
        continue;
      }
      if (!isFieldVisible(field.conditions, scope)) {
        values[field.handle] = keptHiddenValue(check, data[field.handle]);
        continue;
      }
      const result = await checkOneValue(check, data[field.handle], context, {
        checkInnerValues,
        isTopLevel,
      });
      if ("message" in result) {
        messages[field.handle] = field.validation?.message || result.message;
        continue;
      }
      for (const [key, message] of Object.entries(result.innerMessages)) {
        messages[key === "" ? field.handle : `${field.handle}.${key}`] = message;
      }
      values[field.handle] = result.value;
    }

    return { values, messages };
  };
}

/** A hidden field's value: cleared, or kept as it was when it still fits the field. */
function keptHiddenValue({ field, fieldtype, valueSchema }: FieldCheck, value: unknown): unknown {
  if (!field.conditions?.keepHiddenValues || fieldtype.isEmpty(value)) {
    return null;
  }
  const parsed = valueSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

type ValueResult = { message: string } | { value: unknown; innerMessages: FieldMessages };

async function checkOneValue(
  { field, fieldtype, valueSchema }: FieldCheck,
  value: unknown,
  context: FieldCheckContext,
  { checkInnerValues, isTopLevel }: { checkInnerValues: CheckFieldValues; isTopLevel: boolean },
): Promise<ValueResult> {
  if (fieldtype.isEmpty(value)) {
    if (field.required && isEnforced(field.handle, context)) {
      return { message: `${field.label} is required` };
    }
    return { value: null, innerMessages: {} };
  }

  const parsed = valueSchema.safeParse(value);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? `${field.label} isn't right` };
  }

  const ruleProblem = findValidationProblem(field.label, field.validation, parsed.data);
  if (ruleProblem) {
    return { message: ruleProblem };
  }
  if (field.validation?.unique && isTopLevel && context.isValueUnique) {
    if (!(await context.isValueUnique(field.handle, parsed.data))) {
      return { message: `Another entry already has this ${field.label.toLowerCase()}` };
    }
  }

  const problem = await fieldtype.checkReferences?.(
    parsed.data,
    field.label,
    context,
    field.options,
  );
  if (problem) {
    return { message: problem };
  }

  let checkedValue: unknown = parsed.data;
  if (fieldtype.checkNestedValues) {
    const nested = await fieldtype.checkNestedValues(
      parsed.data,
      field.options,
      field.label,
      checkInnerValues,
      context,
    );
    if (!fieldtype.checkChange || Object.keys(nested.messages).length > 0) {
      return { value: nested.value, innerMessages: nested.messages };
    }
    checkedValue = nested.value;
  }
  const change = fieldtype.checkChange?.(
    checkedValue,
    context.previousData?.[field.handle],
    field.label,
    context,
  ) ?? { value: checkedValue };
  if ("problem" in change) {
    return { message: change.problem };
  }
  return { value: change.value, innerMessages: {} };
}

function isEnforced(handle: string, context: FieldCheckContext): boolean {
  return context.requiredFields !== "allowEmpty" || (context.alwaysRequired ?? []).includes(handle);
}
