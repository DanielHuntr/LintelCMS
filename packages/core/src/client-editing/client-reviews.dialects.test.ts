import { expect, it } from "vitest";
import { addTestEntry, addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  decideClientReview,
  findClientReviewRow,
  findLatestReviewForEntry,
  insertClientReview,
  listReviewRowsByStatus,
} from "./client-reviews.repository.js";

describeOnEveryDatabase("Client reviews", (handle) => {
  it("asks for a review and answers it once, naming both people", async () => {
    const { database } = handle;
    const requester = await addTestUser(database);
    const client = await addTestUser(database, "client@example.com");
    const entry = await addTestEntry(database);
    const review = await insertClientReview(database, {
      entryId: entry.id,
      requestedBy: requester.id,
      requestNote: "Please check",
    });
    expect((await findClientReviewRow(database, review.id))?.status).toBe("waiting");
    expect(await listReviewRowsByStatus(database, "waiting")).toHaveLength(1);

    const decision = {
      status: "approved" as const,
      decidedBy: client.id,
      decisionNote: "Good",
      decidedAt: new Date(),
    };
    expect(await decideClientReview(database, review.id, decision)).toBe(true);
    expect(await decideClientReview(database, review.id, decision)).toBe(false);

    const latest = await findLatestReviewForEntry(database, entry.id);
    expect(latest).toMatchObject({ requestedByName: "Ada", decidedByName: "Ada" });
  });
});
