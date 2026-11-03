import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";
import { usersTable } from "../users/users.table.js";

export const clientReviewStatuses = ["waiting", "approved", "sentBack"] as const;
export type ClientReviewStatus = (typeof clientReviewStatuses)[number];

/**
 * A client's changes sent for review, while the site setting "Clients' changes" is "Wait
 * for approval". The changes themselves are the entry's saved values (its working copy);
 * approving publishes them, as Publish would. Sending back keeps them, with a note.
 */
export const clientReviewsTable = pgTable(
  "client_reviews",
  {
    id: id(),
    tenantId: tenantId(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    status: text("status", { enum: clientReviewStatuses }).notNull().default("waiting"),
    requestedBy: uuid("requested_by").references(() => usersTable.id, { onDelete: "set null" }),
    /** What the client says about their changes; empty for nothing. */
    requestNote: text("request_note").notNull().default(""),
    decidedBy: uuid("decided_by").references(() => usersTable.id, { onDelete: "set null" }),
    /** Why it was sent back; empty for nothing. */
    decisionNote: text("decision_note").notNull().default(""),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("client_reviews_entry_idx").on(table.entryId, table.createdAt),
    index("client_reviews_status_idx").on(table.tenantId, table.status),
  ],
);

export type ClientReviewRow = typeof clientReviewsTable.$inferSelect;
