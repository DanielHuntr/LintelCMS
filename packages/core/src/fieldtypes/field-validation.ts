import type { FieldValidation } from "./field-settings.schema.js";

/**
 * A field's own validation rules, on top of what its fieldtype checks: how long text may be,
 * a pattern it has to match, how big a number or how long a list may be. Runs on a value
 * that already has the fieldtype's shape, and gives back the first problem, in plain words.
 */
export function findValidationProblem(
  label: string,
  validation: FieldValidation | undefined,
  value: unknown,
): string | null {
  if (!validation) {
    return null;
  }
  if (typeof value === "string") {
    return textProblem(label, validation, value);
  }
  if (typeof value === "number") {
    if (validation.min !== undefined && value < validation.min) {
      return `${label} should be at least ${validation.min}`;
    }
    if (validation.max !== undefined && value > validation.max) {
      return `${label} should be at most ${validation.max}`;
    }
  }
  if (Array.isArray(value)) {
    if (validation.min !== undefined && value.length < validation.min) {
      return `${label} needs at least ${validation.min}`;
    }
    if (validation.max !== undefined && value.length > validation.max) {
      return `${label} can have at most ${validation.max}`;
    }
  }
  return null;
}

function textProblem(label: string, validation: FieldValidation, value: string): string | null {
  const length = [...value].length;
  if (validation.minLength !== undefined && length < validation.minLength) {
    return `${label} needs at least ${validation.minLength} characters`;
  }
  if (validation.maxLength !== undefined && length > validation.maxLength) {
    return `${label} can be at most ${validation.maxLength} characters`;
  }
  if (validation.pattern !== undefined && !new RegExp(validation.pattern, "u").test(value)) {
    return `${label} isn't in the expected format`;
  }
  return null;
}
