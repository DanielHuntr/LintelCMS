import { z } from "zod";

/**
 * A field's conditions, as they are stored in a blueprint and written in content model files:
 *
 *   { "action": "show", "match": "all",
 *     "rules": [{ "field": "layout", "operator": "is", "value": "video" }] }
 *
 * reads as "Show this field when Layout is Video". `action` and `match` can be left out
 * (show, all), and so can `keepHiddenValues` (false: a hidden field's value is cleared
 * when the entry is saved).
 */

export const conditionOperators = [
  "is",
  "isNot",
  "contains",
  "doesNotContain",
  "isEmpty",
  "isNotEmpty",
  "greaterThan",
  "lessThan",
  "includesAny",
] as const;

export type ConditionOperator = (typeof conditionOperators)[number];

/** Operators that look only at whether there is a value, so they take none. */
export const operatorsWithoutValue: readonly ConditionOperator[] = ["isEmpty", "isNotEmpty"];

/**
 * Which field a rule looks at: a handle beside this field ("layout"), a field inside a group
 * ("address.country"), or one further out: "$parent.layout" is a field beside the group,
 * repeater row or block this field is in, and "$root.layout" a field of the entry itself.
 */
export const FIELD_REFERENCE_PATTERN =
  /^(\$root\.|(\$parent\.)+)?[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

const conditionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())], {
  error: "A rule's value should be text, a number, true or false, or a list of text",
});

export const conditionRuleSchema = z
  .strictObject({
    field: z
      .string({ error: "Each rule needs the field it looks at" })
      .regex(FIELD_REFERENCE_PATTERN, {
        error: 'A rule\'s field should be a handle, like "layout" or "$parent.layout"',
      }),
    operator: z.enum(conditionOperators, {
      error: `A rule's operator should be one of: ${conditionOperators.join(", ")}`,
    }),
    value: conditionValueSchema.optional(),
  })
  .superRefine((rule, context) => {
    const needsValue = !operatorsWithoutValue.includes(rule.operator);
    if (needsValue && (rule.value === undefined || rule.value === "")) {
      context.addIssue({
        code: "custom",
        message: `The rule on "${rule.field}" needs a value to compare with`,
        path: ["value"],
      });
    }
    if (rule.operator === "includesAny" && !Array.isArray(rule.value)) {
      context.addIssue({
        code: "custom",
        message: `The rule on "${rule.field}" needs a list of values for "includes any"`,
        path: ["value"],
      });
    }
  });

export const fieldConditionsSchema = z.strictObject({
  action: z
    .enum(["show", "hide"], { error: 'Conditions should "show" or "hide" the field' })
    .default("show"),
  match: z
    .enum(["all", "any"], { error: 'Conditions should match "all" or "any" of their rules' })
    .default("all"),
  rules: z
    .array(conditionRuleSchema, { error: "Conditions need a list of rules" })
    .min(1, { error: "Conditions need at least one rule" })
    .max(20, { error: "Conditions can have at most 20 rules" }),
  keepHiddenValues: z.boolean({ error: "keepHiddenValues should be true or false" }).default(false),
});

export type ConditionRule = z.output<typeof conditionRuleSchema>;
export type ConditionValue = NonNullable<ConditionRule["value"]>;
export type FieldConditions = z.output<typeof fieldConditionsSchema>;
/** Conditions as written by hand, with the defaults left out. */
export type FieldConditionsInput = z.input<typeof fieldConditionsSchema>;
