import type { FormField } from "./form-fields.schema.js";
import type { ConsentRecord } from "./forms.table.js";
import type { SubmissionValues } from "./submission-values.js";

/**
 * The consent boxes ticked in one submission, each with the words the person saw then:
 * the label, and the help text under it when there is some. The form's wording can change
 * later; the record keeps what they agreed to, when, and on which page.
 */
export function recordConsents(
  fields: readonly FormField[],
  values: SubmissionValues,
  page: string | null,
  now: Date,
): ConsentRecord[] {
  return fields
    .filter((field) => field.type === "consent" && values[field.handle] === true)
    .map((field) => ({
      field: field.handle,
      wording: field.helpText ? `${field.label}\n${field.helpText}` : field.label,
      givenAt: now.toISOString(),
      page,
    }));
}
