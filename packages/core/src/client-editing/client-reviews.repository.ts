import { aliasedTable, and, asc, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import {
  type ClientReviewRow,
  type ClientReviewStatus,
  clientReviewsTable as clientReviewsDefinition,
} from "./client-reviews.table.js";
import { insertReturning, updateReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for client reviews, nothing else. */

export interface ClientReviewWithNames extends ClientReviewRow {
  requestedByName: string | null;
  decidedByName: string | null;
}

function selectWithNames(database: DatabaseOrTransaction) {
  const usersTable = tableFor(database, usersDefinition);
  const requester = aliasedTable(usersTable, "requester");
  const decider = aliasedTable(usersTable, "decider");
  const clientReviewsTable = tableFor(database, clientReviewsDefinition);
  return database
    .select({
      review: clientReviewsTable,
      requestedByName: requester.name,
      decidedByName: decider.name,
    })
    .from(clientReviewsTable)
    .leftJoin(requester, eq(requester.id, clientReviewsTable.requestedBy))
    .leftJoin(decider, eq(decider.id, clientReviewsTable.decidedBy));
}

function withNames(row: {
  review: ClientReviewRow;
  requestedByName: string | null;
  decidedByName: string | null;
}): ClientReviewWithNames {
  return { ...row.review, requestedByName: row.requestedByName, decidedByName: row.decidedByName };
}

export async function insertClientReview(
  database: DatabaseOrTransaction,
  review: { entryId: string; requestedBy: string; requestNote: string },
): Promise<ClientReviewRow> {
  const clientReviewsTable = tableFor(database, clientReviewsDefinition);
  const [inserted] = await insertReturning(database, clientReviewsTable, {
    ...review,
    tenantId: DEFAULT_TENANT_ID,
  });
  if (!inserted) throw new Error("The review could not be saved.");
  return inserted;
}

export async function findClientReviewRow(
  database: DatabaseOrTransaction,
  reviewId: string,
): Promise<ClientReviewRow | undefined> {
  const clientReviewsTable = tableFor(database, clientReviewsDefinition);
  const [row] = await database
    .select()
    .from(clientReviewsTable)
    .where(
      and(eq(clientReviewsTable.tenantId, DEFAULT_TENANT_ID), eq(clientReviewsTable.id, reviewId)),
    )
    .limit(1);
  return row;
}

/** The entry's latest review, if it has had one. */
export async function findLatestReviewForEntry(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<ClientReviewWithNames | undefined> {
  const clientReviewsTable = tableFor(database, clientReviewsDefinition);
  const [row] = await selectWithNames(database)
    .where(
      and(
        eq(clientReviewsTable.tenantId, DEFAULT_TENANT_ID),
        eq(clientReviewsTable.entryId, entryId),
      ),
    )
    .orderBy(desc(clientReviewsTable.createdAt))
    .limit(1);
  return row ? withNames(row) : undefined;
}

export async function listReviewRowsByStatus(
  database: DatabaseOrTransaction,
  status: ClientReviewStatus,
): Promise<ClientReviewWithNames[]> {
  const clientReviewsTable = tableFor(database, clientReviewsDefinition);
  const rows = await selectWithNames(database)
    .where(
      and(
        eq(clientReviewsTable.tenantId, DEFAULT_TENANT_ID),
        eq(clientReviewsTable.status, status),
      ),
    )
    .orderBy(asc(clientReviewsTable.createdAt));
  return rows.map(withNames);
}

/** Answers a waiting review; false when someone else answered it first. */
export async function decideClientReview(
  database: DatabaseOrTransaction,
  reviewId: string,
  decision: {
    status: ClientReviewStatus;
    decidedBy: string;
    decisionNote: string;
    decidedAt: Date;
  },
): Promise<boolean> {
  const clientReviewsTable = tableFor(database, clientReviewsDefinition);
  const updated = await updateReturning(
    database,
    clientReviewsTable,
    decision,
    and(eq(clientReviewsTable.id, reviewId), eq(clientReviewsTable.status, "waiting")),
    { id: clientReviewsTable.id },
  );
  return updated.length > 0;
}
