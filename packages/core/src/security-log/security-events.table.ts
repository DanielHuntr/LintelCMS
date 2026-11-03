import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, tenantId } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

export const securityEventKinds = [
  "sign-in",
  "sign-in-failed",
  "two-factor-failed",
  "password-changed",
  "password-reset-requested",
  "password-reset",
  "email-changed",
  "user-invited",
  "invitation-accepted",
  "invitation-revoked",
  "role-changed",
  "user-deactivated",
  "user-reactivated",
  "user-removed",
  "role-created",
  "role-updated",
  "role-deleted",
  "two-factor-enabled",
  "two-factor-disabled",
  "recovery-codes-created",
  "passkey-added",
  "passkey-removed",
  "sessions-ended",
  "api-token-created",
  "api-token-deleted",
  "lintel-update-started",
  "lintel-rolled-back",
] as const;
export type SecurityEventKind = (typeof securityEventKinds)[number];

/** Facts about one event, such as the role someone moved to. Never passwords or tokens. */
export type SecurityEventDetails = Record<string, string | number | boolean | null>;

/**
 * The security log: who signed in, who failed to, and every change to people, roles and
 * API tokens. Rows are added, never edited, except that Settings → Privacy can take a person
 * out of them, and its retention rule deletes old ones (see src/privacy).
 *
 * - `actorId` is who did it (null for failed sign-ins and for people since removed).
 * - `subjectId` is whose account it was about, when that is someone else.
 * - `actorEmail` and `subjectName` are copied in, so the log still reads after a removal.
 */
export const securityEventsTable = pgTable(
  "security_events",
  {
    id: id(),
    tenantId: tenantId(),
    kind: text("kind", { enum: securityEventKinds }).notNull(),
    actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    subjectId: uuid("subject_id").references(() => usersTable.id, { onDelete: "set null" }),
    subjectName: text("subject_name"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    details: jsonb("details").$type<SecurityEventDetails>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_events_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("security_events_actor_kind_idx").on(table.actorId, table.kind, table.createdAt),
  ],
);

export type SecurityEvent = typeof securityEventsTable.$inferSelect;
export type NewSecurityEvent = typeof securityEventsTable.$inferInsert;
