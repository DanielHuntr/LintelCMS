import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";
import {
  type ClientReviewRow,
  type ClientReviewStatus,
  clientReviewsTable,
} from "./client-reviews.table.js";

/** Database reads and writes for client reviews, nothing else. */

export interface ClientReviewWithNames extends ClientReviewRow {
  requestedByName: string | null;
  decidedByName: string | null;
}

const requester = alias(usersTable, "requester");
const decider = alias(usersTable, "decider");

function selectWithNames(database: DatabaseOrTransaction) {
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
  const [inserted] = await database
    .insert(clientReviewsTable)
    .values({ ...review, tenantId: DEFAULT_TENANT_ID })
    .returning();
  if (!inserted) throw new Error("The review could not be saved.");
  return inserted;
}

export async function findClientReviewRow(
  database: DatabaseOrTransaction,
  reviewId: string,
): Promise<ClientReviewRow | undefined> {
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
  const updated = await database
    .update(clientReviewsTable)
    .set(decision)
    .where(and(eq(clientReviewsTable.id, reviewId), eq(clientReviewsTable.status, "waiting")))
    .returning({ id: clientReviewsTable.id });
  return updated.length > 0;
}
