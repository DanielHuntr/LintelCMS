import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { answerFields } from "./form-fields.schema.js";
import type { FormsContext } from "./forms-context.js";
import { findForm } from "./forms.service.js";
import { fileUrl, isFileList } from "./submission-responses.js";
import { listAllSubmissionRows } from "./submissions.repository.js";
import type { SubmissionValue } from "./submission-values.js";

/**
 * A form's submissions as a spreadsheet: one row each, oldest first, one column per field
 * in the form's order, then any answers to fields that have since been removed.
 */
export async function exportSubmissionsAsCsv(
  context: FormsContext,
  formId: string,
): Promise<{ filename: string; csv: string }> {
  const form = await findForm(context.database, formId);
  const rows = await listAllSubmissionRows(context.database, DEFAULT_TENANT_ID, formId);

  const fields = answerFields(form.fields).map((field) => ({
    handle: field.handle,
    label: field.label,
  }));
  const known = new Set(fields.map((field) => field.handle));
  const removed = [...new Set(rows.flatMap((row) => Object.keys(row.values)))]
    .filter((handle) => !known.has(handle))
    .map((handle) => ({ handle, label: handle }));
  const columns = [...fields, ...removed];

  const header = ["Submitted at", ...columns.map((column) => column.label), "Read", "Starred"];
  const lines = rows.map((row) => [
    row.createdAt.toISOString(),
    ...columns.map((column) => cellText(row.values[column.handle], context.media.publicApiUrl)),
    row.isRead ? "yes" : "no",
    row.isStarred ? "yes" : "no",
  ]);

  // The byte order mark makes Excel read the file as UTF-8, so names with accents survive.
  const csv = `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
  return { filename: `${form.handle}-submissions.csv`, csv };
}

function cellText(value: SubmissionValue | undefined, publicApiUrl: string): string {
  if (value === undefined) return "";
  if (isFileList(value)) return value.map((file) => fileUrl(publicApiUrl, file.assetId)).join(" ");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/**
 * Quotes a cell when it needs it, and stops a spreadsheet treating an answer that starts
 * with = + - @ as a formula: someone could otherwise type one into the form.
 */
export function csvCell(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
