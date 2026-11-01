import { t } from "../i18n/strings.js";
import type { FormField, Submission, SubmissionValue, SubmittedFile } from "./forms.types.js";

/** Reading stored answers for the inbox: what to call a submission, and each answer as text. */

export function isFileList(value: SubmissionValue | undefined): value is SubmittedFile[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "assetId" in value[0]
  );
}

export function answerText(value: SubmissionValue | undefined): string {
  if (value === undefined) return "";
  if (isFileList(value)) return value.map((file) => file.filename).join(", ");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? t("forms.inbox.yes") : t("forms.inbox.no");
  return String(value);
}

/** The first short answer (usually a name), so the list reads like an inbox. */
export function submissionTitle(submission: Submission, fields: readonly FormField[]): string {
  for (const field of fields) {
    const value = submission.values[field.handle];
    if (field.type === "shortText" && typeof value === "string" && value.trim() !== "")
      return value;
  }
  return submission.submitterEmail ?? t("forms.inbox.untitled");
}

/** A line from the longest answer, as a preview under the title. */
export function submissionPreview(submission: Submission, fields: readonly FormField[]): string {
  const longText = fields.find((field) => field.type === "longText");
  const text = longText ? answerText(submission.values[longText.handle]) : "";
  return text || (submission.submitterEmail ?? "");
}

/** Answers to fields since removed from the form, so nothing someone sent is hidden. */
export function otherAnswers(submission: Submission, fields: readonly FormField[]) {
  const known = new Set(fields.map((field) => field.handle));
  return Object.entries(submission.values).filter(([handle]) => !known.has(handle));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
