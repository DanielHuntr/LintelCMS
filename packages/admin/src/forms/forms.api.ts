import { ApiError, apiErrorFromBody, apiRequest, apiUrl } from "../api/client.js";
import type {
  Form,
  FormChanges,
  FormsSettings,
  FormTemplateId,
  PersonalDataExport,
  Submission,
  SubmissionDetail,
  SubmissionQuery,
} from "./forms.types.js";

/** Calls to the API's forms routes (see packages/core/src/forms). */

const formPath = (formId: string) => `/forms/${encodeURIComponent(formId)}`;
const submissionPath = (formId: string, submissionId: string) =>
  `${formPath(formId)}/submissions/${encodeURIComponent(submissionId)}`;

export const SUBMISSIONS_PER_PAGE = 25;

export async function listForms(): Promise<Form[]> {
  const { forms } = await apiRequest<{ forms: Form[] }>("/forms");
  return forms;
}

export function getForm(formId: string) {
  return apiRequest<Form>(formPath(formId));
}

export function createForm(form: { name: string; template: FormTemplateId }) {
  return apiRequest<Form>("/forms", { method: "POST", body: form });
}

export function updateForm(formId: string, changes: FormChanges) {
  return apiRequest<Form>(formPath(formId), { method: "PATCH", body: changes });
}

export function deleteForm(formId: string) {
  return apiRequest<void>(formPath(formId), { method: "DELETE" });
}

export function listSubmissions(formId: string, query: SubmissionQuery) {
  const search = new URLSearchParams({
    filter: query.filter,
    page: String(query.page),
    perPage: String(SUBMISSIONS_PER_PAGE),
  });
  if (query.search.trim() !== "") search.set("search", query.search.trim());
  return apiRequest<{ submissions: Submission[]; total: number }>(
    `${formPath(formId)}/submissions?${search}`,
  );
}

export function getSubmission(formId: string, submissionId: string) {
  return apiRequest<SubmissionDetail>(submissionPath(formId, submissionId));
}

export function updateSubmission(
  formId: string,
  submissionId: string,
  changes: { isRead?: boolean; isStarred?: boolean },
) {
  return apiRequest<SubmissionDetail>(submissionPath(formId, submissionId), {
    method: "PATCH",
    body: changes,
  });
}

export function deleteSubmission(formId: string, submissionId: string) {
  return apiRequest<void>(submissionPath(formId, submissionId), { method: "DELETE" });
}

export function addSubmissionNote(formId: string, submissionId: string, body: string) {
  return apiRequest<SubmissionDetail>(`${submissionPath(formId, submissionId)}/notes`, {
    method: "POST",
    body: { body },
  });
}

export function deleteSubmissionNote(formId: string, submissionId: string, noteId: string) {
  return apiRequest<SubmissionDetail>(
    `${submissionPath(formId, submissionId)}/notes/${encodeURIComponent(noteId)}`,
    { method: "DELETE" },
  );
}

/** The CSV comes back as a file, so it is fetched as a blob rather than as JSON. */
export async function downloadSubmissionsCsv(
  formId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${apiUrl}${formPath(formId)}/export`, { credentials: "include" });
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw apiErrorFromBody(response.status, response.statusText, body);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "submissions.csv";
  return { blob: await response.blob(), filename };
}

export function getFormsSettings() {
  return apiRequest<FormsSettings>("/forms/settings");
}

export function updateFormsSettings(settings: {
  turnstileSiteKey: string | null;
  turnstileSecretKey?: string | null;
}) {
  return apiRequest<FormsSettings>("/forms/settings", { method: "PUT", body: settings });
}

export function exportPersonalData(email: string) {
  return apiRequest<PersonalDataExport>("/forms/privacy/export", {
    method: "POST",
    body: { email },
  });
}

export function erasePersonalData(email: string) {
  return apiRequest<{ deleted: number }>("/forms/privacy/erase", {
    method: "POST",
    body: { email },
  });
}

/** Saves a blob through the browser's own download, with the given filename. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { ApiError };
