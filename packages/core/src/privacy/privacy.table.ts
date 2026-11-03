import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, tenantId } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

export const privacyRequestKinds = ["export", "erase"] as const;
export type PrivacyRequestKind = (typeof privacyRequestKinds)[number];

/** How much of one kind of data a request touched: "Form entries", 3 deleted. */
export interface PrivacyRequestPart {
  source: string;
  deleted: number;
  anonymised: number;
  kept: number;
  found: number;
}

/**
 * A record that someone's data was exported or erased, kept so the site owner can show they
 * answered a request. It says who on the team did it, when, and how much of each kind of data
 * it touched; on purpose it holds nothing about the person it was for, not even their email.
 * Retention rules never delete these.
 */
export const privacyRequestsTable = pgTable(
  "privacy_requests",
  {
    id: id(),
    tenantId: tenantId(),
    kind: text("kind", { enum: privacyRequestKinds }).notNull(),
    actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    /** Copied in, so the record still reads after the team member is removed. */
    actorName: text("actor_name").notNull().default(""),
    parts: jsonb("parts").$type<PrivacyRequestPart[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("privacy_requests_tenant_created_idx").on(table.tenantId, table.createdAt)],
);

export type PrivacyRequestRow = typeof privacyRequestsTable.$inferSelect;
export type NewPrivacyRequestRow = typeof privacyRequestsTable.$inferInsert;
