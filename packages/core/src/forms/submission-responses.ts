import type { FormSubmissionRow } from "./forms.table.js";
import type { NoteWithAuthor } from "./submissions.repository.js";
import type {
  Submission,
  SubmissionNote,
  SubmissionValueResponse,
  SubmittedFileResponse,
} from "./submissions.schema.js";
import type { SubmissionValue, SubmittedFile } from "./submission-values.js";

export function isFileList(value: SubmissionValue): value is SubmittedFile[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "assetId" in value[0]
  );
}

export function fileUrl(publicApiUrl: string, assetId: string): string {
  return `${publicApiUrl.replace(/\/+$/, "")}/media/${assetId}/file`;
}

function toValueResponse(value: SubmissionValue, publicApiUrl: string): SubmissionValueResponse {
  if (isFileList(value)) {
    return value.map((file): SubmittedFileResponse => ({
      ...file,
      url: fileUrl(publicApiUrl, file.assetId),
    }));
  }
  return value as SubmissionValueResponse;
}

export function toSubmissionResponse(row: FormSubmissionRow, publicApiUrl: string): Submission {
  return {
    id: row.id,
    formId: row.formId,
    values: Object.fromEntries(
      Object.entries(row.values).map(([handle, value]) => [
        handle,
        toValueResponse(value, publicApiUrl),
      ]),
    ),
    submitterEmail: row.submitterEmail,
    sourceUrl: row.sourceUrl,
    isRead: row.isRead,
    isStarred: row.isStarred,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toNoteResponse(note: NoteWithAuthor): SubmissionNote {
  return {
    id: note.id,
    body: note.body,
    author: note.authorId && note.authorName ? { id: note.authorId, name: note.authorName } : null,
    createdAt: note.createdAt.toISOString(),
  };
}
