import type { Condition, ConditionStep } from "../workflow-definition.schema.js";
import type { RunContext } from "./run-context.js";
import { lookUpPath, renderText, valueAsText } from "./templates.js";

/**
 * Checks a condition step against the run's context. Field conditions read the entry's
 * saved values (`entry.fields.<handle>`), or for a form, the submission's
 * (`submission.fields.<handle>`). Text comparisons ignore case and surrounding spaces,
 * because "Yes" and "yes " mean the same to the person who wrote the condition.
 */
export function evaluateConditions(step: ConditionStep, context: RunContext): boolean {
  const results = step.conditions.map((condition) => evaluateCondition(condition, context));
  return step.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function evaluateCondition(condition: Condition, context: RunContext): boolean {
  switch (condition.type) {
    case "field_equals":
      return sameText(fieldValue(context, condition.field), renderText(condition.value, context));
    case "field_contains":
      return fieldContains(
        fieldValue(context, condition.field),
        renderText(condition.value, context),
      );
    case "field_changed": {
      const changed = lookUpPath(context, "changedFields");
      return Array.isArray(changed) && changed.includes(condition.field);
    }
    case "collection_is":
      return condition.collections.includes(valueAsText(lookUpPath(context, "entry.collection")));
    case "user_role": {
      const roles = lookUpPath(context, "actor.roles");
      return Array.isArray(roles) && condition.roles.some((role) => roles.includes(role));
    }
    case "value_equals":
      return sameText(renderText(condition.left, context), renderText(condition.right, context));
  }
}

function fieldValue(context: RunContext, field: string): unknown {
  return (
    lookUpPath(context, `entry.fields.${field}`) ??
    lookUpPath(context, `submission.fields.${field}`)
  );
}

function normalise(text: string): string {
  return text.trim().toLowerCase();
}

function sameText(value: unknown, expected: string): boolean {
  return normalise(valueAsText(value)) === normalise(expected);
}

/** A list contains an item; text contains a phrase. */
function fieldContains(value: unknown, expected: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => sameText(item, expected));
  }
  return normalise(valueAsText(value)).includes(normalise(expected));
}

/** "title is “Hello” and the person has the editor role", for the run log. */
export function describeConditions(step: ConditionStep): string {
  const parts = step.conditions.map(describeCondition);
  return parts.join(step.match === "all" ? " and " : " or ");
}

function describeCondition(condition: Condition): string {
  switch (condition.type) {
    case "field_equals":
      return `${condition.field} is “${condition.value}”`;
    case "field_contains":
      return `${condition.field} contains “${condition.value}”`;
    case "field_changed":
      return `${condition.field} changed`;
    case "collection_is":
      return `the collection is ${condition.collections.join(" or ")}`;
    case "user_role":
      return `the person has the ${condition.roles.join(" or ")} role`;
    case "value_equals":
      return `${condition.left} is “${condition.right}”`;
  }
}
