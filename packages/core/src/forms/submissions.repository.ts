import { and, count, desc, eq, gte, ilike, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import type { DatabaseOrTransaction, Transaction } from "../database/client.js";
import { escapeLikePattern } from "../search/search-terms.js";
import { usersTable } from "../users/users.table.js";
import {
  type FormSubmissionNoteRow,
  formSubmissionNotesTable,
  type FormSubmissionRow,
  formSubmissionsTable,
  formsTable,
  type NewFormSubmissionRow,
} from "./forms.table.js";

/** Database reads and writes for submissions and their notes, nothing else. */

export type SubmissionFilter = "all" | "unread" | "starred";

export interface SubmissionListOptions {
  search?: string;
  filter: SubmissionFilter;
  limit: number;
  offset: number;
}

export async function insertSubmissionRow(
  database: DatabaseOrTransaction,
  submission: NewFormSubmissionRow,
): Promise<FormSubmissionRow> {
  const [row] = await database.insert(formSubmissionsTable).values(submission).returning();
  if (!row) {
    throw new Error("Saving the submission returned nothing.");
  }
  return row;
}

/** Hashes `formId` into an advisory lock key, held until the transaction ends. */
export async function lockFormSubmissions(transaction: Transaction, formId: string): Promise<void> {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`form:${formId}`}))`);
}

/** Submissions to a form sent with the same token since `since`. */
export async function listRecentSubmissionsWithToken(
  database: DatabaseOrTransaction,
  formId: string,
  tokenHash: string,
  since: Date,
): Promise<FormSubmissionRow[]> {
  return database
    .select()
    .from(formSubmissionsTable)
    .where(
      and(
        eq(formSubmissionsTable.formId, formId),
        eq(formSubmissionsTable.tokenHash, tokenHash),
        gte(formSubmissionsTable.createdAt, since),
      ),
    );
}

function listConditions(tenantId: string, formId: string, options: SubmissionListOptions) {
  const conditions: SQL[] = [
    eq(formSubmissionsTable.tenantId, tenantId),
    eq(formSubmissionsTable.formId, formId),
  ];
  if (options.filter === "unread") conditions.push(eq(formSubmissionsTable.isRead, false));
  if (options.filter === "starred") conditions.push(eq(formSubmissionsTable.isStarred, true));
  if (options.search) {
    // Every answer is searched at once through the JSON's text, which is plenty for an inbox.
    const pattern = `%${escapeLikePattern(options.search)}%`;
    const matches = or(
      ilike(sql<string>`${formSubmissionsTable.values}::text`, pattern),
      ilike(formSubmissionsTable.submitterEmail, pattern),
    );
    if (matches) conditions.push(matches);
  }
  return and(...conditions);
}

export async function listSubmissionRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  formId: string,
  options: SubmissionListOptions,
): Promise<{ rows: FormSubmissionRow[]; total: number }> {
  const where = listConditions(tenantId, formId, options);
  const rows = await database
    .select()
    .from(formSubmissionsTable)
    .where(where)
    .orderBy(desc(formSubmissionsTable.createdAt), desc(formSubmissionsTable.id))
    .limit(options.limit)
    .offset(options.offset);
  const [counted] = await database
    .select({ total: count() })
    .from(formSubmissionsTable)
    .where(where);
  return { rows, total: counted?.total ?? 0 };
}

/** Every submission of a form, oldest first, for the CSV export. */
export async function listAllSubmissionRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  formId: string,
): Promise<FormSubmissionRow[]> {
  return database
    .select()
    .from(formSubmissionsTable)
    .where(
      and(eq(formSubmissionsTable.tenantId, tenantId), eq(formSubmissionsTable.formId, formId)),
    )
    .orderBy(formSubmissionsTable.createdAt, formSubmissionsTable.id);
}

export async function findSubmissionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  formId: string,
  submissionId: string,
): Promise<FormSubmissionRow | undefined> {
  const [row] = await database
    .select()
    .from(formSubmissionsTable)
    .where(
      and(
        eq(formSubmissionsTable.tenantId, tenantId),
        eq(formSubmissionsTable.formId, formId),
        eq(formSubmissionsTable.id, submissionId),
      ),
    )
    .limit(1);
  return row;
}

export async function updateSubmissionFlags(
  database: DatabaseOrTransaction,
  tenantId: string,
  submissionIds: readonly string[],
  changes: { isRead?: boolean; isStarred?: boolean },
): Promise<void> {
  if (submissionIds.length === 0) return;
  await database
    .update(formSubmissionsTable)
    .set(changes)
    .where(
      and(
        eq(formSubmissionsTable.tenantId, tenantId),
        inArray(formSubmissionsTable.id, [...submissionIds]),
      ),
    );
}

/** Deletes the submissions (notes go with them) and gives back what they held. */
export async function deleteSubmissionRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  submissionIds: readonly string[],
): Promise<FormSubmissionRow[]> {
  if (submissionIds.length === 0) return [];
  return database
    .delete(formSubmissionsTable)
    .where(
      and(
        eq(formSubmissionsTable.tenantId, tenantId),
        inArray(formSubmissionsTable.id, [...submissionIds]),
      ),
    )
    .returning();
}

/** Ids of submissions within this form, out of those asked about. */
export async function findSubmissionIdsInForm(
  database: DatabaseOrTransaction,
  tenantId: string,
  formId: string,
  submissionIds: readonly string[],
): Promise<string[]> {
  if (submissionIds.length === 0) return [];
  const rows = await database
    .select({ id: formSubmissionsTable.id })
    .from(formSubmissionsTable)
    .where(
      and(
        eq(formSubmissionsTable.tenantId, tenantId),
        eq(formSubmissionsTable.formId, formId),
        inArray(formSubmissionsTable.id, [...submissionIds]),
      ),
    );
  return rows.map((row) => row.id);
}

/** Submissions older than their form's "keep for" setting allows. */
export async function findExpiredSubmissionIds(
  database: DatabaseOrTransaction,
  tenantId: string,
  now: Date,
  limit: number,
): Promise<string[]> {
  const rows = await database
    .select({ id: formSubmissionsTable.id })
    .from(formSubmissionsTable)
    .innerJoin(formsTable, eq(formsTable.id, formSubmissionsTable.formId))
    .where(
      and(
        eq(formSubmissionsTable.tenantId, tenantId),
        sql`${formsTable.retentionDays} is not null`,
        lt(
          formSubmissionsTable.createdAt,
          sql`${now.toISOString()}::timestamptz - make_interval(days => ${formsTable.retentionDays})`,
        ),
      ),
    )
    .limit(limit);
  return rows.map((row) => row.id);
}

export type SubmissionWithForm = FormSubmissionRow & { formHandle: string; formName: string };

/** Every submission from one person, across all forms, newest first. */
export async function listSubmissionRowsByEmail(
  database: DatabaseOrTransaction,
  tenantId: string,
  email: string,
): Promise<SubmissionWithForm[]> {
  const rows = await database
    .select({
      submission: formSubmissionsTable,
      formHandle: formsTable.handle,
      formName: formsTable.name,
    })
    .from(formSubmissionsTable)
    .innerJoin(formsTable, eq(formsTable.id, formSubmissionsTable.formId))
    .where(
      and(
        eq(formSubmissionsTable.tenantId, tenantId),
        eq(formSubmissionsTable.submitterEmail, email),
      ),
    )
    .orderBy(desc(formSubmissionsTable.createdAt));
  return rows.map((row) => ({
    ...row.submission,
    formHandle: row.formHandle,
    formName: row.formName,
  }));
}

/**
 * Which of these files another submission still holds: one it added, or one it sent that
 * was already in the library (the same file sent twice), which only its answers mention.
 */
export async function findAssetIdsStillUsed(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetIds: readonly string[],
): Promise<Set<string>> {
  const used = new Set<string>();
  for (const assetId of assetIds) {
    const [row] = await database
      .select({ id: formSubmissionsTable.id })
      .from(formSubmissionsTable)
      .where(
        and(
          eq(formSubmissionsTable.tenantId, tenantId),
          or(
            sql`${formSubmissionsTable.assetIds} @> ${JSON.stringify([assetId])}::jsonb`,
            sql`position(${assetId} in ${formSubmissionsTable.values}::text) > 0`,
          ),
        ),
      )
      .limit(1);
    if (row) used.add(assetId);
  }
  return used;
}

export type NoteWithAuthor = FormSubmissionNoteRow & { authorName: string | null };

export async function listNoteRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  submissionId: string,
): Promise<NoteWithAuthor[]> {
  const rows = await database
    .select({ note: formSubmissionNotesTable, authorName: usersTable.name })
    .from(formSubmissionNotesTable)
    .leftJoin(usersTable, eq(usersTable.id, formSubmissionNotesTable.authorId))
    .where(
      and(
        eq(formSubmissionNotesTable.tenantId, tenantId),
        eq(formSubmissionNotesTable.submissionId, submissionId),
      ),
    )
    .orderBy(formSubmissionNotesTable.createdAt);
  return rows.map((row) => ({ ...row.note, authorName: row.authorName }));
}

export async function insertNoteRow(
  database: DatabaseOrTransaction,
  note: { tenantId: string; submissionId: string; authorId: string; body: string },
): Promise<void> {
  await database.insert(formSubmissionNotesTable).values(note);
}

export async function deleteNoteRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  submissionId: string,
  noteId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(formSubmissionNotesTable)
    .where(
      and(
        eq(formSubmissionNotesTable.tenantId, tenantId),
        eq(formSubmissionNotesTable.submissionId, submissionId),
        eq(formSubmissionNotesTable.id, noteId),
      ),
    )
    .returning({ id: formSubmissionNotesTable.id });
  return deleted.length > 0;
}
