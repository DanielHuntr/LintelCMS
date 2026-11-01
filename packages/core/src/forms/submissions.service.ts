import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { AssetInUseError, AssetNotFoundError, deleteAsset } from "../media/index.js";
import type { FormsContext } from "./forms-context.js";
import { FormNotFoundError, SubmissionNotFoundError } from "./forms.errors.js";
import { findFormRowById } from "./forms.repository.js";
import type { FormSubmissionRow } from "./forms.table.js";
import { toNoteResponse, toSubmissionResponse } from "./submission-responses.js";
import {
  deleteNoteRow,
  deleteSubmissionRows,
  findAssetIdsStillUsed,
  findExpiredSubmissionIds,
  findSubmissionRow,
  insertNoteRow,
  listNoteRows,
  listSubmissionRows,
  listSubmissionRowsByEmail,
  updateSubmissionFlags,
} from "./submissions.repository.js";
import type {
  ListSubmissionsQuery,
  Submission,
  SubmissionDetail,
  SubmissionList,
} from "./submissions.schema.js";

/** The inbox: reading, starring, noting and deleting what people sent. */

export async function listSubmissions(
  context: FormsContext,
  formId: string,
  query: ListSubmissionsQuery,
): Promise<SubmissionList> {
  if (!(await findFormRowById(context.database, DEFAULT_TENANT_ID, formId))) {
    throw new FormNotFoundError();
  }
  const { rows, total } = await listSubmissionRows(context.database, DEFAULT_TENANT_ID, formId, {
    search: query.search || undefined,
    filter: query.filter,
    limit: query.perPage,
    offset: (query.page - 1) * query.perPage,
  });
  return {
    submissions: rows.map((row) => toSubmissionResponse(row, context.media.publicApiUrl)),
    total,
  };
}

async function findSubmissionInForm(
  context: FormsContext,
  formId: string,
  submissionId: string,
): Promise<FormSubmissionRow> {
  const row = await findSubmissionRow(context.database, DEFAULT_TENANT_ID, formId, submissionId);
  if (!row) {
    throw new SubmissionNotFoundError();
  }
  return row;
}

export async function findSubmission(
  context: FormsContext,
  formId: string,
  submissionId: string,
): Promise<SubmissionDetail> {
  const row = await findSubmissionInForm(context, formId, submissionId);
  const notes = await listNoteRows(context.database, DEFAULT_TENANT_ID, submissionId);
  return {
    ...toSubmissionResponse(row, context.media.publicApiUrl),
    notes: notes.map(toNoteResponse),
  };
}

export async function updateSubmission(
  context: FormsContext,
  formId: string,
  submissionId: string,
  changes: { isRead?: boolean; isStarred?: boolean },
): Promise<SubmissionDetail> {
  await findSubmissionInForm(context, formId, submissionId);
  if (changes.isRead !== undefined || changes.isStarred !== undefined) {
    await updateSubmissionFlags(context.database, DEFAULT_TENANT_ID, [submissionId], changes);
  }
  return findSubmission(context, formId, submissionId);
}

export async function addSubmissionNote(
  context: FormsContext,
  formId: string,
  submissionId: string,
  body: string,
  authorId: string,
): Promise<SubmissionDetail> {
  await findSubmissionInForm(context, formId, submissionId);
  await insertNoteRow(context.database, {
    tenantId: DEFAULT_TENANT_ID,
    submissionId,
    authorId,
    body,
  });
  return findSubmission(context, formId, submissionId);
}

export async function deleteSubmissionNote(
  context: FormsContext,
  formId: string,
  submissionId: string,
  noteId: string,
): Promise<SubmissionDetail> {
  await findSubmissionInForm(context, formId, submissionId);
  if (!(await deleteNoteRow(context.database, DEFAULT_TENANT_ID, submissionId, noteId))) {
    throw new SubmissionNotFoundError();
  }
  return findSubmission(context, formId, submissionId);
}

export async function deleteSubmission(
  context: FormsContext,
  formId: string,
  submissionId: string,
): Promise<void> {
  await findSubmissionInForm(context, formId, submissionId);
  await deleteSubmissionsAndFiles(context, [submissionId]);
}

/**
 * Deletes submissions with their notes and the files that were sent with them. A file is
 * kept when another submission holds the same file, or when an editor has since used it on
 * a page (the media library refuses to delete it then).
 */
export async function deleteSubmissionsAndFiles(
  context: FormsContext,
  submissionIds: readonly string[],
): Promise<number> {
  const deleted = await deleteSubmissionRows(context.database, DEFAULT_TENANT_ID, submissionIds);
  const assetIds = [...new Set(deleted.flatMap((row) => row.assetIds))];
  const stillUsed = await findAssetIdsStillUsed(context.database, DEFAULT_TENANT_ID, assetIds);
  for (const assetId of assetIds.filter((id) => !stillUsed.has(id))) {
    try {
      await deleteAsset(context.media, assetId);
    } catch (error) {
      if (!(error instanceof AssetInUseError || error instanceof AssetNotFoundError)) {
        throw error;
      }
    }
  }
  return deleted.length;
}

const EXPIRED_PER_RUN = 200;

/** Deletes submissions older than their form keeps them. Run by the forms timer every hour. */
export async function deleteExpiredSubmissions(
  context: FormsContext,
  now = new Date(),
): Promise<number> {
  let total = 0;
  for (;;) {
    const ids = await findExpiredSubmissionIds(
      context.database,
      DEFAULT_TENANT_ID,
      now,
      EXPIRED_PER_RUN,
    );
    if (ids.length === 0) return total;
    total += await deleteSubmissionsAndFiles(context, ids);
  }
}

export interface PersonalDataExport {
  email: string;
  exportedAt: string;
  submissions: Array<Submission & { form: { handle: string; name: string } }>;
}

/** Everything people with this email address have sent, for a "what do you hold?" request. */
export async function exportPersonalData(
  context: FormsContext,
  email: string,
  now = new Date(),
): Promise<PersonalDataExport> {
  const rows = await listSubmissionRowsByEmail(context.database, DEFAULT_TENANT_ID, email);
  return {
    email,
    exportedAt: now.toISOString(),
    submissions: rows.map((row) => ({
      ...toSubmissionResponse(row, context.media.publicApiUrl),
      form: { handle: row.formHandle, name: row.formName },
    })),
  };
}

/** Deletes everything people with this email address have sent, for a "forget me" request. */
export async function erasePersonalData(
  context: FormsContext,
  email: string,
): Promise<{ deleted: number }> {
  const rows = await listSubmissionRowsByEmail(context.database, DEFAULT_TENANT_ID, email);
  const deleted = await deleteSubmissionsAndFiles(
    context,
    rows.map((row) => row.id),
  );
  return { deleted };
}
