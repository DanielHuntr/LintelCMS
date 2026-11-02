import type {
  ConditionOperator,
  ConditionRule,
  FieldConditionsInput,
} from "@lintel/field-conditions";
import type { Field } from "../fields/field.types.js";
import { t, type StringKey } from "../i18n/strings.js";

/**
 * What a field's conditions can look at, and which comparisons make sense for each, so the
 * conditions editor only offers rules that can be true. Plain functions, tested on their own.
 */

/** Fieldtypes that hold no value a rule could compare. */
const withoutValue = new Set<string>([
  "tab",
  "section",
  "spacer",
  "blocks",
  "page",
  "group",
  "fieldset",
  "repeater",
]);

export interface ConditionTarget {
  /** As stored in the rule: "layout", "$parent.layout" or "$root.layout". */
  reference: string;
  field: Field;
  /** Beside this field, around the group or block it's in, or one of the entry's own fields. */
  where: "beside" | "outside" | "entry";
}

/**
 * The fields a condition can look at: those beside this one, then, for a field inside a
 * group, repeater or block, those around it (`outerLevels`, innermost first, the entry's own
 * fields last).
 */
export function conditionTargets(
  field: Pick<Field, "handle">,
  siblings: readonly Field[],
  outerLevels: readonly (readonly Field[])[] = [],
): ConditionTarget[] {
  const usable = (candidate: Field) => !withoutValue.has(candidate.type) && candidate.handle !== "";
  const targets: ConditionTarget[] = siblings
    .filter((sibling) => usable(sibling) && sibling.handle !== field.handle)
    .map((sibling) => ({ reference: sibling.handle, field: sibling, where: "beside" }));
  outerLevels.forEach((level, index) => {
    const isEntry = index === outerLevels.length - 1;
    const prefix = isEntry ? "$root." : "$parent.".repeat(index + 1);
    for (const outer of level.filter(usable)) {
      targets.push({
        reference: `${prefix}${outer.handle}`,
        field: outer,
        where: isEntry ? "entry" : "outside",
      });
    }
  });
  return targets;
}

/** Whether a field can hold several values at once. */
export function holdsSeveral(field: Field): boolean {
  return (
    field.type === "checkboxes" ||
    field.type === "list" ||
    field.type === "entries" ||
    field.type === "terms" ||
    field.type === "users" ||
    (field.type === "select" && field.options.multiple === true)
  );
}

/** The comparisons that make sense for a field, in the order the editor offers them. */
export function operatorsFor(field: Field | undefined): ConditionOperator[] {
  if (!field) return ["is", "isNot", "isEmpty", "isNotEmpty"];
  if (field.type === "toggle" || field.type === "revealer") return ["is"];
  if (holdsSeveral(field))
    return ["contains", "doesNotContain", "includesAny", "isEmpty", "isNotEmpty"];
  if (field.options.choices) return ["is", "isNot", "includesAny", "isEmpty", "isNotEmpty"];
  if (
    field.type === "number" ||
    field.type === "range" ||
    field.type === "date" ||
    field.type === "time"
  ) {
    return ["is", "isNot", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"];
  }
  return ["is", "isNot", "contains", "doesNotContain", "isEmpty", "isNotEmpty"];
}

const operatorWords: Record<ConditionOperator, StringKey> = {
  is: "conditions.operator.is",
  isNot: "conditions.operator.isNot",
  contains: "conditions.operator.contains",
  doesNotContain: "conditions.operator.doesNotContain",
  isEmpty: "conditions.operator.isEmpty",
  isNotEmpty: "conditions.operator.isNotEmpty",
  greaterThan: "conditions.operator.greaterThan",
  lessThan: "conditions.operator.lessThan",
  includesAny: "conditions.operator.includesAny",
};

/** "is after" rather than "is greater than" for dates and times. */
export function operatorLabel(operator: ConditionOperator, field: Field | undefined): string {
  const isTime = field?.type === "date" || field?.type === "time";
  if (isTime && operator === "greaterThan") return t("conditions.operator.after");
  if (isTime && operator === "lessThan") return t("conditions.operator.before");
  return t(operatorWords[operator]);
}

/** A rule's value as editors read it: choice labels rather than stored values, On or Off. */
export function valueWords(rule: ConditionRule, field: Field | undefined): string {
  const values = Array.isArray(rule.value)
    ? rule.value
    : rule.value === undefined
      ? []
      : [rule.value];
  const words = values.map((value) => {
    if (value === true) return t("conditions.on");
    if (value === false) return t("conditions.off");
    const choice = field?.options.choices?.find((candidate) => candidate.value === String(value));
    return choice ? choice.label : String(value);
  });
  return words.join(t("conditions.or"));
}

function findTarget(targets: readonly ConditionTarget[], rule: ConditionRule) {
  return targets.find((candidate) => candidate.reference === rule.field);
}

/** The conditions in one plain sentence: "Shown when Layout is Video and Featured is On." */
export function describeConditions(
  conditions: FieldConditionsInput | undefined,
  targets: readonly ConditionTarget[],
): string {
  if (!conditions || conditions.rules.length === 0) return t("conditions.always");
  // A rule still being made reads as an instruction, not "Shown when Title is ."
  const unfinished = conditions.rules.find(
    (rule) =>
      rule.operator !== "isEmpty" &&
      rule.operator !== "isNotEmpty" &&
      valueWords(rule, findTarget(targets, rule)?.field).trim() === "",
  );
  if (unfinished) {
    const field = findTarget(targets, unfinished)?.field.label || unfinished.field;
    return t("conditions.unfinished", { field });
  }
  const parts = conditions.rules.map((rule) => {
    const target = targets.find((candidate) => candidate.reference === rule.field);
    const name = target?.field.label || rule.field;
    const comparison = operatorLabel(rule.operator, target?.field);
    const value =
      rule.operator === "isEmpty" || rule.operator === "isNotEmpty"
        ? ""
        : ` ${valueWords(rule, target?.field)}`;
    return `${name} ${comparison}${value}`;
  });
  const joined = parts.join(
    conditions.match === "any" ? t("conditions.joinAny") : t("conditions.joinAll"),
  );
  return t(conditions.action === "hide" ? "conditions.sentenceHide" : "conditions.sentenceShow", {
    rules: joined,
  });
}
