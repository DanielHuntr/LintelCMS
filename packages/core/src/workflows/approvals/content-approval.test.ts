import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../../collections/default-collections.js";
import { setEnabledPlugins } from "../../plugins/plugins.service.js";
import { assignRoleToUser, insertRole } from "../../roles/roles.repository.js";
import { useTestDatabase } from "../../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../../testing/test-users.js";

describe("content approval", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let admin: SendRequest;
  let author: SendRequest;
  let reviewer: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    const database = testDatabase.database;
    await ensurePagesCollection(database);
    await setEnabledPlugins(database, server.plugins, ["automations"]);
    await createTestUser(database, "admin@example.com", [["*"]]);
    await createTestUser(database, "author@example.com", [["entries:*"]]);
    const reviewerUser = await createTestUser(database, "reviewer@example.com", [["entries:*"]]);
    const editors = await insertRole(database, {
      handle: "editor",
      name: "Editor",
      permissions: [],
    });
    await assignRoleToUser(database, reviewerUser.id, editors.id);
    admin = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
    author = requestsAs(server, await signInAndGetCookies(server, "author@example.com"));
    reviewer = requestsAs(server, await signInAndGetCookies(server, "reviewer@example.com"));
  });

  afterEach(() => server.close());

  async function requireApproval() {
    const response = await admin("PUT", "/content-approval/pages", {
      required: true,
      reviewerRole: "editor",
      publishWhenApproved: true,
    });
    expect(response.statusCode, response.body).toBe(200);
  }

  async function writePage(title: string) {
    const created = await author("POST", "/collections/pages/entries", { data: { title } });
    return created.json<{ id: string }>().id;
  }

  it("is off until switched on for a collection", async () => {
    const entryId = await writePage("About");
    expect((await author("GET", `/entry-reviews/${entryId}`)).json().required).toBe(false);
    expect((await author("POST", `/entries/${entryId}/publish`)).statusCode).toBe(200);
    const { settings } = (await admin("GET", "/content-approval")).json();
    expect(settings).toContainEqual(
      expect.objectContaining({ collection: "pages", required: false }),
    );
  });

  it("goes author, reviewer, changes, approval, then published", async () => {
    await requireApproval();
    const entryId = await writePage("About");

    const refused = await author("POST", `/entries/${entryId}/publish`);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().code).toBe("APPROVAL_REQUIRED");

    const submitted = await author("POST", `/entry-reviews/${entryId}`, { note: "First draft" });
    expect(submitted.json().state).toBe("in_review");
    expect((await author("POST", `/entry-reviews/${entryId}`, {})).statusCode).toBe(409);
    await server.workflows.runDue();

    // The reviewer hears about it and can answer from the entry.
    const inbox = (await reviewer("GET", "/notifications")).json();
    expect(inbox.notifications[0].message).toBe("Ana Editor asked you to review “About”");
    expect(inbox.notifications[0].link).toBe(`/content/pages/${entryId}`);
    let review = (await reviewer("GET", `/entry-reviews/${entryId}`)).json();
    expect(review).toMatchObject({ state: "in_review", canReview: true, reviewerRole: "editor" });
    expect((await author("GET", `/entry-reviews/${entryId}`)).json().canReview).toBe(false);

    const noComment = await reviewer(
      "POST",
      `/workflow-approvals/${review.pendingApprovalId}/decision`,
      { decision: "request_changes" },
    );
    expect(noComment.json().code).toBe("COMMENT_NEEDED");
    const notAllowed = await author(
      "POST",
      `/workflow-approvals/${review.pendingApprovalId}/decision`,
      { decision: "approve" },
    );
    expect(notAllowed.statusCode).toBe(403);
    await reviewer("POST", `/workflow-approvals/${review.pendingApprovalId}/decision`, {
      decision: "request_changes",
      comment: "Add a photo",
    });
    await server.workflows.runDue();

    review = (await author("GET", `/entry-reviews/${entryId}`)).json();
    expect(review.state).toBe("changes_requested");
    const authorInbox = (await author("GET", "/notifications")).json();
    expect(authorInbox.notifications[0].message).toBe(
      "Changes were requested on “About”: Add a photo",
    );

    await author("PATCH", `/entries/${entryId}`, { data: { title: "About us" } });
    await author("POST", `/entry-reviews/${entryId}`, {});
    await server.workflows.runDue();
    review = (await reviewer("GET", `/entry-reviews/${entryId}`)).json();
    await reviewer("POST", `/workflow-approvals/${review.pendingApprovalId}/decision`, {
      decision: "approve",
      comment: "Lovely",
    });
    await server.workflows.runDue();

    const entry = (await author("GET", `/entries/${entryId}`)).json();
    expect(entry.status).toBe("published");
    review = (await author("GET", `/entry-reviews/${entryId}`)).json();
    expect(review.history.map((item: { kind: string }) => item.kind)).toEqual([
      "submitted",
      "changes_requested",
      "submitted",
      "approved",
    ]);
    expect(review.history[0]).toMatchObject({ by: "Ana Editor", comment: "First draft" });
  });

  it("needs a new review when an approved entry changes", async () => {
    await admin("PUT", "/content-approval/pages", {
      required: true,
      reviewerRole: "editor",
      publishWhenApproved: false,
    });
    const entryId = await writePage("About");
    await author("POST", `/entry-reviews/${entryId}`, {});
    await server.workflows.runDue();
    const { pendingApprovalId } = (await reviewer("GET", `/entry-reviews/${entryId}`)).json();
    await reviewer("POST", `/workflow-approvals/${pendingApprovalId}/decision`, {
      decision: "approve",
    });
    await server.workflows.runDue();
    expect((await author("GET", `/entry-reviews/${entryId}`)).json().state).toBe("approved");

    await author("PATCH", `/entries/${entryId}`, { data: { title: "About, changed" } });
    const review = (await author("GET", `/entry-reviews/${entryId}`)).json();
    expect(review).toMatchObject({ state: "not_submitted", changedSinceApproval: true });
    expect((await author("POST", `/entries/${entryId}/publish`)).statusCode).toBe(409);
    // Someone who may do everything isn't held up.
    expect((await admin("POST", `/entries/${entryId}/publish`)).statusCode).toBe(200);
  });

  it("lists the requests a reviewer can answer", async () => {
    await requireApproval();
    const entryId = await writePage("About");
    await author("POST", `/entry-reviews/${entryId}`, {});
    await server.workflows.runDue();

    const { approvals } = (await reviewer("GET", "/workflow-approvals")).json();
    expect(approvals).toEqual([
      expect.objectContaining({ entryId, role: "editor", canAnswer: true }),
    ]);
    expect((await author("GET", "/workflow-approvals")).json().approvals).toEqual([]);
  });
});
