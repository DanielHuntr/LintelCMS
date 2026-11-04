import { and, count, desc, eq, gte, type SQL } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewSecurityEvent,
  type SecurityEvent,
  type SecurityEventKind,
  securityEventsTable as securityEventsDefinition,
} from "./security-events.table.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for the security log, nothing else. */

export async function insertSecurityEvent(
  database: DatabaseOrTransaction,
  event: NewSecurityEvent,
): Promise<void> {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  await database.insert(securityEventsTable).values(event);
}

export interface SecurityEventFilters {
  tenantId: string;
  kind?: SecurityEventKind;
}

function filtersToWhere(
  securityEventsTable: typeof securityEventsDefinition,
  filters: SecurityEventFilters,
): SQL | undefined {
  return and(
    eq(securityEventsTable.tenantId, filters.tenantId),
    filters.kind ? eq(securityEventsTable.kind, filters.kind) : undefined,
  );
}

export async function listSecurityEventRows(
  database: DatabaseOrTransaction,
  filters: SecurityEventFilters,
  page: { limit: number; offset: number },
): Promise<SecurityEvent[]> {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  return database
    .select()
    .from(securityEventsTable)
    .where(filtersToWhere(securityEventsTable, filters))
    .orderBy(desc(securityEventsTable.createdAt), desc(securityEventsTable.id))
    .limit(page.limit)
    .offset(page.offset);
}

export async function countSecurityEventRows(
  database: DatabaseOrTransaction,
  filters: SecurityEventFilters,
): Promise<number> {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  const [row] = await database
    .select({ total: count() })
    .from(securityEventsTable)
    .where(filtersToWhere(securityEventsTable, filters));
  return row?.total ?? 0;
}

export async function countEventsByActorSince(
  database: DatabaseOrTransaction,
  actorId: string,
  kind: SecurityEventKind,
  since: Date,
): Promise<number> {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  const [row] = await database
    .select({ total: count() })
    .from(securityEventsTable)
    .where(
      and(
        eq(securityEventsTable.actorId, actorId),
        eq(securityEventsTable.kind, kind),
        gte(securityEventsTable.createdAt, since),
      ),
    );
  return row?.total ?? 0;
}
