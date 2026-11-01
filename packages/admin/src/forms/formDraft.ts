import { handleFromLabel, uniqueHandle } from "../content-types/handle.js";
import type { StringKey } from "../i18n/strings.js";
import type { FormField, FormFieldOptions, FormFieldType } from "./forms.types.js";

/**
 * The form builder's changes to a list of fields, as plain functions: adding, moving,
 * changing and removing fields, and spotting problems before anything is saved.
 */

function defaultOptionsFor(type: FormFieldType): FormFieldOptions {
  switch (type) {
    case "choice":
    case "checkboxes":
    case "dropdown":
      return { choices: ["Option 1", "Option 2"] };
    case "file":
      return { allowedKinds: ["images", "documents"], maxMegabytes: 10, maxFiles: 1 };
    case "number":
      return { wholeNumber: false };
    case "hidden":
      return { defaultValue: "" };
    default:
      return {};
  }
}

/** A new field of this type with a label to change, and a handle no other field has. */
export function newField(
  type: FormFieldType,
  label: string,
  fields: readonly FormField[],
): FormField {
  const handle = uniqueHandle(
    handleFromLabel(label) || "field",
    fields.map((field) => field.handle),
  );
  return {
    id: crypto.randomUUID(),
    type,
    handle,
    label,
    helpText: "",
    placeholder: "",
    required: type === "consent",
    options: defaultOptionsFor(type),
  };
}

export function addField(
  fields: readonly FormField[],
  field: FormField,
  afterId?: string,
): FormField[] {
  const index = afterId ? fields.findIndex((candidate) => candidate.id === afterId) : -1;
  if (index === -1) return [...fields, field];
  return [...fields.slice(0, index + 1), field, ...fields.slice(index + 1)];
}

export function updateField(
  fields: readonly FormField[],
  fieldId: string,
  changes: Partial<FormField>,
): FormField[] {
  return fields.map((field) => (field.id === fieldId ? { ...field, ...changes } : field));
}

export function removeField(fields: readonly FormField[], fieldId: string): FormField[] {
  return fields.filter((field) => field.id !== fieldId);
}

/** Moves a field one place up (-1) or down (1). Nothing happens at either end. */
export function moveFieldBy(
  fields: readonly FormField[],
  fieldId: string,
  direction: -1 | 1,
): FormField[] {
  const index = fields.findIndex((field) => field.id === fieldId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= fields.length) return [...fields];
  return moveFieldTo(fields, fieldId, fields[target]?.id ?? fieldId);
}

/** Moves a field to where another one is, as a drag and drop does. */
export function moveFieldTo(
  fields: readonly FormField[],
  fieldId: string,
  targetId: string,
): FormField[] {
  const from = fields.findIndex((field) => field.id === fieldId);
  const to = fields.findIndex((field) => field.id === targetId);
  const moving = fields[from];
  if (from === -1 || to === -1 || !moving) return [...fields];
  const without = fields.filter((field) => field.id !== fieldId);
  return [...without.slice(0, to), moving, ...without.slice(to)];
}

/** Changing a label changes the handle with it, until the handle has been set by hand. */
export function relabelField(
  fields: readonly FormField[],
  fieldId: string,
  label: string,
  handleFollowsLabel: boolean,
): FormField[] {
  if (!handleFollowsLabel) return updateField(fields, fieldId, { label });
  const others = fields.filter((field) => field.id !== fieldId).map((field) => field.handle);
  const handle = uniqueHandle(handleFromLabel(label) || "field", others);
  return updateField(fields, fieldId, { label, handle });
}

/** What needs fixing before the form can be saved, keyed by field id. */
export function findFieldProblems(fields: readonly FormField[]): Record<string, StringKey> {
  const problems: Record<string, StringKey> = {};
  const seen = new Set<string>();
  for (const field of fields) {
    if (field.label.trim() === "") problems[field.id] = "forms.problem.noLabel";
    else if (!/^[a-z][a-z0-9_]*$/.test(field.handle))
      problems[field.id] = "forms.problem.badHandle";
    else if (seen.has(field.handle)) problems[field.id] = "forms.problem.sameHandle";
    else if (
      (field.type === "choice" || field.type === "checkboxes" || field.type === "dropdown") &&
      (field.options.choices ?? []).filter((choice) => choice.trim() !== "").length === 0
    ) {
      problems[field.id] = "forms.problem.noChoices";
    } else if (field.type === "file" && (field.options.allowedKinds ?? []).length === 0) {
      problems[field.id] = "forms.problem.noFileKinds";
    }
    seen.add(field.handle);
  }
  return problems;
}

/** Choices as the API wants them: trimmed, without blanks or repeats. */
export function cleanChoices(choices: readonly string[]): string[] {
  return [...new Set(choices.map((choice) => choice.trim()).filter((choice) => choice !== ""))];
}

/** The steps a field list makes: an ordinary form is one step without a title. */
export function stepsOf(
  fields: readonly FormField[],
): Array<{ title: string | null; fields: FormField[] }> {
  const steps: Array<{ title: string | null; fields: FormField[] }> = [{ title: null, fields: [] }];
  for (const field of fields) {
    const current = steps[steps.length - 1];
    if (field.type !== "step") {
      current?.fields.push(field);
    } else if (current && current.fields.length === 0) {
      current.title = field.label;
    } else {
      steps.push({ title: field.label, fields: [] });
    }
  }
  return steps.filter((step, index) => step.fields.length > 0 || index === 0);
}
