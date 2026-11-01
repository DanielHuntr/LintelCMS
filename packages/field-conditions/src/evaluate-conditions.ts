import type {
  ConditionRule,
  ConditionValue,
  FieldConditions,
  FieldConditionsInput,
} from "./conditions.schema.js";

/**
 * Deciding whether a field is shown. The admin runs this as an editor types, and the server
 * runs it again when the entry is saved, so a field hidden on screen is never required and
 * its value is cleared (unless the field keeps hidden values).
 *
 * A scope is the values a field sits among: the entry's own values at the top, then a
 * group's, a repeater row's or a block's, each pointing at the scope around it, so rules can
 * look outwards with "$parent." and "$root.".
 */
export interface ConditionScope {
  values: Readonly<Record<string, unknown>>;
  parent: ConditionScope | null;
}

export function topScope(values: Readonly<Record<string, unknown>>): ConditionScope {
  return { values, parent: null };
}

export function innerScope(
  values: Readonly<Record<string, unknown>>,
  parent: ConditionScope,
): ConditionScope {
  return { values, parent };
}

/** Whether a field with these conditions is shown. No conditions means always shown. */
export function isFieldVisible(
  conditions: FieldConditions | FieldConditionsInput | null | undefined,
  scope: ConditionScope,
): boolean {
  if (!conditions || conditions.rules.length === 0) {
    return true;
  }
  const results = conditions.rules.map((rule) => ruleMatches(rule, scope));
  const matched = conditions.match === "any" ? results.some(Boolean) : results.every(Boolean);
  return conditions.action === "hide" ? !matched : matched;
}

export function ruleMatches(rule: ConditionRule, scope: ConditionScope): boolean {
  const actual = resolveFieldReference(rule.field, scope);
  const expected = rule.value;
  switch (rule.operator) {
    case "is":
      return isEqualTo(actual, expected);
    case "isNot":
      return !isEqualTo(actual, expected);
    case "contains":
      return contains(actual, expected);
    case "doesNotContain":
      return !contains(actual, expected);
    case "isEmpty":
      return isEmptyValue(actual);
    case "isNotEmpty":
      return !isEmptyValue(actual);
    case "greaterThan":
      return compare(actual, expected) > 0;
    case "lessThan":
      return compare(actual, expected) < 0;
    case "includesAny":
      return includesAny(actual, expected);
  }
}

/**
 * The value a rule's field reference points at: "layout", "address.country",
 * "$parent.layout" or "$root.layout". A reference that leads nowhere gives undefined.
 */
export function resolveFieldReference(reference: string, scope: ConditionScope): unknown {
  let current: ConditionScope = scope;
  let path = reference;
  if (path.startsWith("$root.")) {
    while (current.parent) current = current.parent;
    path = path.slice("$root.".length);
  }
  while (path.startsWith("$parent.")) {
    if (!current.parent) return undefined;
    current = current.parent;
    path = path.slice("$parent.".length);
  }
  let value: unknown = current.values;
  for (const key of path.split(".")) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Empty as an editor would see it: nothing, blank text, an empty list. */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Text, numbers and switches compare as text, so `"3"` is `3` and `"true"` is `true`. */
function sameScalar(actual: unknown, expected: unknown): boolean {
  if (actual === undefined || actual === null || expected === undefined) return false;
  return asText(actual) === asText(expected);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value);
}

function isEqualTo(actual: unknown, expected: ConditionValue | undefined): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item) => actual.some((candidate) => sameScalar(candidate, item)))
    );
  }
  // A field holding several values (a multiple select, checkboxes) "is" X when X is chosen.
  if (Array.isArray(actual)) {
    return actual.some((item) => sameScalar(item, expected));
  }
  // An empty toggle counts as off.
  if (expected === false && (actual === undefined || actual === null)) return true;
  return sameScalar(actual, expected);
}

function contains(actual: unknown, expected: ConditionValue | undefined): boolean {
  if (expected === undefined) return false;
  const wanted = Array.isArray(expected) ? expected : [expected];
  if (Array.isArray(actual)) {
    return wanted.every((item) => actual.some((candidate) => sameScalar(candidate, item)));
  }
  if (typeof actual !== "string") return false;
  const text = actual.toLowerCase();
  return wanted.every((item) => text.includes(asText(item).toLowerCase()));
}

function includesAny(actual: unknown, expected: ConditionValue | undefined): boolean {
  const wanted = Array.isArray(expected) ? expected : expected === undefined ? [] : [expected];
  const present = Array.isArray(actual) ? actual : [actual];
  return wanted.some((item) => present.some((candidate) => sameScalar(candidate, item)));
}

/**
 * Numbers compare as numbers; other text (dates like 2026-10-31, times like 09:30)
 * compares as text, which orders them correctly. Anything missing compares as unordered.
 */
function compare(actual: unknown, expected: ConditionValue | undefined): number {
  if (isEmptyValue(actual) || expected === undefined || Array.isArray(expected)) return Number.NaN;
  if (Array.isArray(actual)) return compare(actual.length, expected);
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (!Number.isNaN(actualNumber) && !Number.isNaN(expectedNumber)) {
    return actualNumber - expectedNumber;
  }
  const actualText = asText(actual);
  const expectedText = asText(expected);
  return actualText === expectedText ? 0 : actualText > expectedText ? 1 : -1;
}

/** The field references a set of conditions uses, for checking they point at real fields. */
export function referencedFields(conditions: { rules: readonly { field: string }[] }): string[] {
  return [...new Set(conditions.rules.map((rule) => rule.field))];
}

/** Where a reference starts looking: beside the field, a level out, or the entry itself. */
export function referenceStart(reference: string): {
  levelsUp: number | "root";
  path: string[];
} {
  if (reference.startsWith("$root.")) {
    return { levelsUp: "root", path: reference.slice("$root.".length).split(".") };
  }
  let levelsUp = 0;
  let path = reference;
  while (path.startsWith("$parent.")) {
    levelsUp += 1;
    path = path.slice("$parent.".length);
  }
  return { levelsUp, path: path.split(".") };
}
