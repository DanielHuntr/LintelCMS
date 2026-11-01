import { isEmptyValue, operatorsWithoutValue } from "@lintel/field-conditions";
import type { Field, FieldOptions, FieldType } from "../fields/field.types.js";
import { canHaveDefault, canHavePlaceholder } from "../fields/fieldLayout.js";
import { t } from "../i18n/strings.js";
import { isValidHandle } from "./handle.js";

/**
 * The settings every field shares (width, placeholder, default, conditions, validation...)
 * as the builder edits them and the API takes them. Like the API, settings that are the
 * default are left out, so a field nobody touched saves exactly as it did before.
 */

/** The shared settings of a field, ready to send: defaults and empty values left out. */
export function settingsForSaving(field: Field): Partial<Field> {
  const settings: Partial<Field> = {};
  if (field.width !== undefined && field.width !== 100) settings.width = field.width;
  if (field.placeholder?.trim() && canHavePlaceholder(field)) {
    settings.placeholder = field.placeholder.trim();
  }
  if (canHaveDefault(field) && !isEmptyValue(field.default) && field.default !== false) {
    settings.default = field.default;
  }
  if (field.helpTextPosition === "above") settings.helpTextPosition = "above";
  if (field.readOnly) settings.readOnly = true;
  if (field.hidden) settings.hidden = true;
  if (field.showInList) settings.showInList = true;
  const validation = validationForSaving(field);
  if (validation) settings.validation = validation;
  if (field.conditions && field.conditions.rules.length > 0) {
    settings.conditions = {
      action: field.conditions.action ?? "show",
      match: field.conditions.match ?? "all",
      rules: field.conditions.rules,
      keepHiddenValues: field.conditions.keepHiddenValues === true,
    };
  }
  return settings;
}

function validationForSaving(field: Field): Field["validation"] | undefined {
  const rules = field.validation;
  if (!rules) return undefined;
  const kept = Object.fromEntries(
    Object.entries(rules).filter(
      ([key, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !(key === "unique" && value === false) &&
        !(typeof value === "number" && Number.isNaN(value)),
    ),
  );
  return Object.keys(kept).length === 0 ? undefined : kept;
}

/** Fieldtypes that offer choices set up in the builder. */
export function hasChoices(type: FieldType): boolean {
  return type === "select" || type === "radio" || type === "checkboxes" || type === "buttonGroup";
}

/** Fieldtypes whose fields are set up in the builder, inside them. */
export function holdsFields(type: FieldType): boolean {
  return type === "group" || type === "repeater";
}

/** The options a newly added field starts with. */
export function defaultOptionsFor(fieldType: FieldType): FieldOptions {
  if (hasChoices(fieldType)) {
    return fieldType === "select" ? { choices: [], multiple: false } : { choices: [] };
  }
  switch (fieldType) {
    case "colour":
      return { swatches: [] };
    case "entries":
      return { collections: [] };
    case "blocks":
      return { blockTypes: [] };
    case "group":
    case "repeater":
      return { fields: [] };
    case "fieldset":
      return { fieldset: "" };
    case "range":
      return { min: 0, max: 100, step: 1 };
    default:
      return {};
  }
}

/**
 * Problems with a field's own settings that aren't about its handle or label: a rule without
 * a field, a pattern that isn't valid, a group without fields. One sentence, or null.
 */
export function settingsProblem(field: Field, siblings: readonly Field[]): string | null {
  if (hasChoices(field.type) && (field.options.choices ?? []).length === 0) {
    return t("builder.problem.choices");
  }
  if (holdsFields(field.type)) {
    const inner = field.options.fields ?? [];
    if (inner.length === 0) return t("builder.problem.innerFields");
    const handles = new Set<string>();
    for (const innerField of inner) {
      if (innerField.label.trim() === "")
        return t("builder.problem.innerLabel", { label: field.label });
      if (!isValidHandle(innerField.handle) || handles.has(innerField.handle)) {
        return t("builder.problem.innerHandle", { label: innerField.label });
      }
      handles.add(innerField.handle);
      const problem = settingsProblem(innerField, inner);
      if (problem) return problem;
    }
  }
  if (field.type === "fieldset" && !field.options.fieldset) return t("builder.problem.fieldset");
  if (field.validation?.pattern) {
    try {
      new RegExp(field.validation.pattern, "u");
    } catch {
      return t("builder.problem.pattern");
    }
  }
  for (const rule of field.conditions?.rules ?? []) {
    if (rule.field === "") return t("builder.problem.ruleField");
    const isSibling = !rule.field.startsWith("$");
    const [handle] = rule.field.split(".");
    if (isSibling && !siblings.some((sibling) => sibling.handle === handle)) {
      return t("builder.problem.ruleMissing", { handle: rule.field });
    }
    const needsValue = !operatorsWithoutValue.includes(rule.operator);
    const value = rule.value;
    if (
      needsValue &&
      (value === undefined || value === "" || (Array.isArray(value) && value.length === 0))
    ) {
      return t("builder.problem.ruleValue");
    }
  }
  return null;
}
