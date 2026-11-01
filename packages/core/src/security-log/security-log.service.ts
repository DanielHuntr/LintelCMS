import type { FastifyRequest } from "fastify";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type {
  SecurityEvent,
  SecurityEventDetails,
  SecurityEventKind,
} from "./security-events.table.js";
import {
  countEventsByActorSince,
  countSecurityEventRows,
  insertSecurityEvent,
  listSecurityEventRows,
} from "./security-log.repository.js";
import type { ListSecurityEventsQuery, SecurityEventResponse } from "./security-log.schema.js";

/**
 * Writing to and reading the security log. Features call `recordSecurityEvent` after the
 * thing has happened; the log never decides anything itself.
 */

/** Where a request came from, as the log records it. */
export interface RequestOrigin {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SecurityEventRecord {
  kind: SecurityEventKind;
  /** Who did it. For a failed sign-in, only the email that was typed. */
  actor?: { id: string | null; email: string | null };
  /** Whose account it was about, when that is someone else. */
  subject?: { id: string | null; name: string };
  origin?: RequestOrigin;
  details?: SecurityEventDetails;
}

// The log is for reading, not for storing whatever a browser sends.
const MAX_USER_AGENT_LENGTH = 300;

export function requestOrigin(request: FastifyRequest): RequestOrigin {
  return {
    ipAddress: request.ip || null,
    userAgent: request.headers["user-agent"]?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
  };
}

export async function recordSecurityEvent(
  database: DatabaseOrTransaction,
  record: SecurityEventRecord,
  now = new Date(),
): Promise<void> {
  await insertSecurityEvent(database, {
    tenantId: DEFAULT_TENANT_ID,
    kind: record.kind,
    actorId: record.actor?.id ?? null,
    actorEmail: record.actor?.email ?? null,
    subjectId: record.subject?.id ?? null,
    subjectName: record.subject?.name ?? null,
    ipAddress: record.origin?.ipAddress ?? null,
    userAgent: record.origin?.userAgent ?? null,
    details: record.details ?? {},
    createdAt: now,
  });
}

/** How often someone has done something lately, such as typing a wrong two-factor code. */
export function countRecentEventsBy(
  database: DatabaseOrTransaction,
  actorId: string,
  kind: SecurityEventKind,
  since: Date,
): Promise<number> {
  return countEventsByActorSince(database, actorId, kind, since);
}

export interface SecurityEventPage {
  events: SecurityEventResponse[];
  page: number;
  perPage: number;
  total: number;
}

export async function listSecurityEvents(
  database: DatabaseOrTransaction,
  query: ListSecurityEventsQuery,
): Promise<SecurityEventPage> {
  const filters = { tenantId: DEFAULT_TENANT_ID, kind: query.kind };
  const rows = await listSecurityEventRows(database, filters, {
    limit: query.perPage,
    offset: (query.page - 1) * query.perPage,
  });
  return {
    events: rows.map(describeSecurityEvent),
    page: query.page,
    perPage: query.perPage,
    total: await countSecurityEventRows(database, filters),
  };
}

/** Exports are capped so one click can't build a file too large to open. */
const MAX_EXPORTED_EVENTS = 10_000;

/** The log as CSV, newest first, for a spreadsheet or an auditor. */
export async function exportSecurityEventsAsCsv(
  database: DatabaseOrTransaction,
  kind: SecurityEventKind | undefined,
): Promise<string> {
  const rows = await listSecurityEventRows(
    database,
    { tenantId: DEFAULT_TENANT_ID, kind },
    { limit: MAX_EXPORTED_EVENTS, offset: 0 },
  );
  const header = ["time", "event", "by", "about", "ip_address", "browser", "details"];
  const lines = rows.map((row) => [
    row.createdAt.toISOString(),
    row.kind,
    row.actorEmail ?? "",
    row.subjectName ?? "",
    row.ipAddress ?? "",
    row.userAgent ?? "",
    Object.entries(row.details)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join("; "),
  ]);
  return [header, ...lines].map((values) => values.map(quoteCsvValue).join(",")).join("\r\n");
}

/**
 * Quotes every value, and puts a quote in front of anything a spreadsheet would run as a
 * formula, since an attacker chooses the email typed into a failed sign-in.
 */
export function quoteCsvValue(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function describeSecurityEvent(row: SecurityEvent): SecurityEventResponse {
  return {
    id: row.id,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
    actor: { id: row.actorId, email: row.actorEmail },
    subject: row.subjectName === null ? null : { id: row.subjectId, name: row.subjectName },
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    details: row.details,
  };
}
