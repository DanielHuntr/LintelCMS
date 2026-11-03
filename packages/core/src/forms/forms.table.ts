import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";
import type { FormField } from "./form-fields.schema.js";
import type { FormConfirmation, FormNotifications } from "./forms.schema.js";
import type { SubmissionValues } from "./submission-values.js";

/**
 * A consent box the person ticked, recorded as it was: the exact words they saw (the label,
 * and the help text under it), when they ticked it and the page they were on. Wording can
 * change later; this keeps what they agreed to.
 */
export interface ConsentRecord {
  field: string;
  wording: string;
  givenAt: string;
  page: string | null;
}

/**
 * A form people fill in on the website: its fields, what they see after sending it and
 * who is told. `handle` is how websites ask for it (`/delivery/forms/contact`).
 */
export const formsTable = pgTable(
  "forms",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    fields: jsonb("fields").$type<FormField[]>().notNull(),
    submitLabel: text("submit_label").notNull(),
    confirmation: jsonb("confirmation").$type<FormConfirmation>().notNull(),
    notifications: jsonb("notifications").$type<FormNotifications>().notNull(),
    /** Submissions older than this many days are deleted. Null keeps them until deleted. */
    retentionDays: integer("retention_days"),
    acceptingSubmissions: boolean("accepting_submissions").notNull().default(true),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [uniqueIndex("forms_tenant_handle_idx").on(table.tenantId, table.handle)],
);

/**
 * One filled-in form. `values` are keyed by field handle, as checked when it arrived.
 * `submitterEmail` is the first email answer, lowercased, so one person's submissions can
 * be found, exported or erased on request. `assetIds` are the files they sent, which live
 * in the media library and go when the submission does. `consents` records each consent box
 * they ticked, word for word. `tokenHash` is a hash of the form
 * token it came with, so a double click or a resent request isn't stored twice.
 */
export const formSubmissionsTable = pgTable(
  "form_submissions",
  {
    id: id(),
    tenantId: tenantId(),
    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),
    values: jsonb("values").$type<SubmissionValues>().notNull(),
    submitterEmail: text("submitter_email"),
    assetIds: jsonb("asset_ids").$type<string[]>().notNull().default([]),
    /** The page the form was sent from, when the browser said. */
    sourceUrl: text("source_url"),
    /** The consent boxes they ticked, with the words shown (see `ConsentRecord`). */
    consents: jsonb("consents").$type<ConsentRecord[]>().notNull().default([]),
    tokenHash: text("token_hash"),
    isRead: boolean("is_read").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    index("form_submissions_form_idx").on(table.formId, table.createdAt),
    index("form_submissions_token_idx").on(table.formId, table.tokenHash),
    index("form_submissions_email_idx").on(table.tenantId, table.submitterEmail),
  ],
);

/** A note the team adds to a submission, such as "Called back on Monday". */
export const formSubmissionNotesTable = pgTable(
  "form_submission_notes",
  {
    id: id(),
    tenantId: tenantId(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => formSubmissionsTable.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => usersTable.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("form_submission_notes_submission_idx").on(table.submissionId)],
);

export type FormRow = typeof formsTable.$inferSelect;
export type NewFormRow = typeof formsTable.$inferInsert;
export type FormSubmissionRow = typeof formSubmissionsTable.$inferSelect;
export type NewFormSubmissionRow = typeof formSubmissionsTable.$inferInsert;
export type FormSubmissionNoteRow = typeof formSubmissionNotesTable.$inferSelect;
