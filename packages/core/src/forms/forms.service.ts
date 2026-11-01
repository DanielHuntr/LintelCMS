import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { isUniqueViolation } from "../database/database-errors.js";
import type { FormsContext } from "./forms-context.js";
import { FormHandleTakenError, FormNotFoundError } from "./forms.errors.js";
import {
  deleteFormRow,
  findFormRowById,
  type FormWithCounts,
  insertFormRow,
  listFormHandles,
  listFormRows,
  updateFormRow,
} from "./forms.repository.js";
import {
  type CreateFormRequest,
  type Form,
  formNotificationsSchema,
  type UpdateFormRequest,
} from "./forms.schema.js";
import { formFieldListSchema } from "./form-fields.schema.js";
import { formTemplates } from "./form-templates.js";
import { listAllSubmissionRows } from "./submissions.repository.js";
import { deleteSubmissionsAndFiles } from "./submissions.service.js";

/** Business rules for forms themselves: making them, changing them, deleting them. */

function toFormResponse(row: FormWithCounts): Form {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    fields: row.fields,
    submitLabel: row.submitLabel,
    confirmation: row.confirmation,
    notifications: row.notifications,
    retentionDays: row.retentionDays,
    acceptingSubmissions: row.acceptingSubmissions,
    submissionCount: row.submissionCount,
    unreadCount: row.unreadCount,
    lastSubmittedAt: row.lastSubmittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listForms(database: DatabaseOrTransaction): Promise<{ forms: Form[] }> {
  const rows = await listFormRows(database, DEFAULT_TENANT_ID);
  return { forms: rows.map(toFormResponse) };
}

export async function findForm(database: DatabaseOrTransaction, formId: string): Promise<Form> {
  const row = await findFormRowById(database, DEFAULT_TENANT_ID, formId);
  if (!row) {
    throw new FormNotFoundError();
  }
  return toFormResponse(row);
}

/** "Contact us!" becomes `contact_us`; a handle already in use gets `_2`, `_3`... */
export function handleFromName(name: string, taken: readonly string[]): string {
  const base =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+|_+$/g, "")
      .slice(0, 56) || "form";
  let handle = base;
  for (let number = 2; taken.includes(handle); number += 1) {
    handle = `${base}_${number}`;
  }
  return handle;
}

export async function createForm(
  database: DatabaseOrTransaction,
  request: CreateFormRequest,
  creator: { id: string; email: string },
): Promise<Form> {
  const template = formTemplates[request.template];
  const handle =
    request.handle ??
    handleFromName(request.name, await listFormHandles(database, DEFAULT_TENANT_ID));
  // The person who made the form is told about submissions until they choose otherwise.
  const notifications = formNotificationsSchema.parse({
    recipients: [creator.email],
    subject: template.ownerSubject,
    confirmationEmail: template.confirmationEmail
      ? { enabled: true, ...template.confirmationEmail }
      : {},
  });

  try {
    const row = await insertFormRow(database, {
      tenantId: DEFAULT_TENANT_ID,
      handle,
      name: request.name,
      fields: formFieldListSchema.parse(template.fields),
      submitLabel: template.submitLabel,
      confirmation: { type: "message", message: template.confirmationMessage },
      notifications,
      retentionDays: null,
      createdBy: creator.id,
    });
    return findForm(database, row.id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new FormHandleTakenError(handle);
    }
    throw error;
  }
}

export async function updateForm(
  database: DatabaseOrTransaction,
  formId: string,
  changes: UpdateFormRequest,
): Promise<Form> {
  await findForm(database, formId);
  const columns = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(columns).length > 0) {
    try {
      await updateFormRow(database, DEFAULT_TENANT_ID, formId, columns);
    } catch (error) {
      if (isUniqueViolation(error) && changes.handle) {
        throw new FormHandleTakenError(changes.handle);
      }
      throw error;
    }
  }
  return findForm(database, formId);
}

/** Deletes the form, every submission and the files people sent with them. */
export async function deleteForm(context: FormsContext, formId: string): Promise<void> {
  await findForm(context.database, formId);
  const submissions = await listAllSubmissionRows(context.database, DEFAULT_TENANT_ID, formId);
  await deleteSubmissionsAndFiles(
    context,
    submissions.map((submission) => submission.id),
  );
  await deleteFormRow(context.database, DEFAULT_TENANT_ID, formId);
}
