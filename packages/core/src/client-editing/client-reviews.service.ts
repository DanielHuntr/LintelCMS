import type { DatabaseOrTransaction } from "../database/client.js";
import type { EntryChangeContext } from "../entries/entries.service.js";
import { publishEntry } from "../entries/entry-publishing.service.js";
import { ClientReviewNotFoundError, ReviewAlreadyAnsweredError } from "./client-editing.errors.js";
import type { ClientReviewListItem, ClientReviewResponse } from "./client-editing.schema.js";
import { describeReview, describeReviewedEntry } from "./client-editing.service.js";
import {
  decideClientReview,
  findClientReviewRow,
  findLatestReviewForEntry,
  listReviewRowsByStatus,
} from "./client-reviews.repository.js";
import type { ClientReviewStatus } from "./client-reviews.table.js";

/**
 * Answering clients' reviews: "Approve" publishes the entry's saved values, as Publish
 * would; "Send back" keeps them as they are, with a note saying what to change. Both are
 * for people who may publish and design (Owners, Admins and Editors).
 */

export async function listClientReviews(
  database: DatabaseOrTransaction,
  status: ClientReviewStatus,
): Promise<{ reviews: ClientReviewListItem[] }> {
  const rows = await listReviewRowsByStatus(database, status);
  const reviews = await Promise.all(
    rows.map(async (row) => ({
      ...describeReview(row),
      entry: await describeReviewedEntry(database, row.entryId),
    })),
  );
  return { reviews };
}

export async function approveClientReview(
  database: DatabaseOrTransaction,
  reviewId: string,
  context: EntryChangeContext & { authorId: string },
  now = new Date(),
): Promise<ClientReviewResponse> {
  const review = await findWaitingReview(database, reviewId);
  // Publishing checks the values are ready (required fields) before anything is recorded.
  await publishEntry(database, review.entryId, context, now);
  const answered = await decideClientReview(database, review.id, {
    status: "approved",
    decidedBy: context.authorId,
    decisionNote: "",
    decidedAt: now,
  });
  if (!answered) throw new ReviewAlreadyAnsweredError();
  return latestReview(database, review.entryId);
}

export async function sendBackClientReview(
  database: DatabaseOrTransaction,
  reviewId: string,
  note: string,
  reviewerId: string,
  now = new Date(),
): Promise<ClientReviewResponse> {
  const review = await findWaitingReview(database, reviewId);
  const answered = await decideClientReview(database, review.id, {
    status: "sentBack",
    decidedBy: reviewerId,
    decisionNote: note,
    decidedAt: now,
  });
  if (!answered) throw new ReviewAlreadyAnsweredError();
  return latestReview(database, review.entryId);
}

async function findWaitingReview(database: DatabaseOrTransaction, reviewId: string) {
  const review = await findClientReviewRow(database, reviewId);
  if (!review) throw new ClientReviewNotFoundError();
  if (review.status !== "waiting") throw new ReviewAlreadyAnsweredError();
  return review;
}

async function latestReview(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<ClientReviewResponse> {
  const review = await findLatestReviewForEntry(database, entryId);
  if (!review) throw new ClientReviewNotFoundError();
  return describeReview(review);
}
