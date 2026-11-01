import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { publishDueEntries } from "./entry-publishing.service.js";
import { entriesTable } from "./entries.table.js";

const HOUR = 60 * 60 * 1000;

describe("publishing entries", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  async function createPost(title: string): Promise<string> {
    const response = await api("POST", "/collections/posts/entries", { data: { title } });
    return response.json().id;
  }

  it("publishes, then tracks saved changes until the next publish", async () => {
    const id = await createPost("Launch day");

    const published = await api("POST", `/entries/${id}/publish`);
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ status: "published", hasUnpublishedChanges: false });
    expect(Date.now() - Date.parse(published.json().publishedAt)).toBeLessThan(10_000);

    const edited = await api("PATCH", `/entries/${id}`, { data: { title: "Launch day!" } });
    expect(edited.json()).toMatchObject({ status: "published", hasUnpublishedChanges: true });

    const editedBack = await api("PATCH", `/entries/${id}`, { data: { title: "Launch day" } });
    expect(editedBack.json().hasUnpublishedChanges).toBe(false);

    await api("PATCH", `/entries/${id}`, { data: { title: "Launch day!" } });
    const republished = await api("POST", `/entries/${id}/publish`);
    expect(republished.json()).toMatchObject({
      title: "Launch day!",
      hasUnpublishedChanges: false,
    });
  });

  it("unpublishes back to a draft, keeping the saved values", async () => {
    const id = await createPost("Old news");
    await api("POST", `/entries/${id}/publish`);

    const response = await api("POST", `/entries/${id}/unpublish`);

    expect(response.json()).toMatchObject({
      status: "draft",
      publishedAt: null,
      hasUnpublishedChanges: false,
      data: { title: "Old news" },
    });
  });

  it("schedules an entry for later, and only accepts future times", async () => {
    const id = await createPost("Coming soon");
    const publishAt = new Date(Date.now() + HOUR).toISOString();

    const scheduled = await api("POST", `/entries/${id}/schedule`, { publishAt });
    const past = await api("POST", `/entries/${id}/schedule`, {
      publishAt: "2020-01-01T00:00:00Z",
    });
    const notADate = await api("POST", `/entries/${id}/schedule`, { publishAt: "next tuesday" });

    expect(scheduled.json()).toMatchObject({
      status: "scheduled",
      scheduledFor: publishAt,
      publishedAt: null,
    });
    expect(past.json()).toMatchObject({
      statusCode: 400,
      message: "Please pick a time in the future to publish at.",
    });
    expect(notADate.statusCode).toBe(400);
    const list = await api("GET", "/collections/posts/entries?status=scheduled");
    expect(list.json().entries.map((entry: { id: string }) => entry.id)).toEqual([id]);
  });

  it("publishes scheduled entries once their time has passed, dated when they were due", async () => {
    const dueId = await createPost("Due");
    const laterId = await createPost("Later");
    const inOneHour = new Date(Date.now() + HOUR);
    await api("POST", `/entries/${dueId}/schedule`, { publishAt: inOneHour.toISOString() });
    await api("POST", `/entries/${laterId}/schedule`, {
      publishAt: new Date(Date.now() + 3 * HOUR).toISOString(),
    });

    expect(await publishDueEntries(testDatabase.database)).toEqual([]);
    const twoHoursFromNow = new Date(Date.now() + 2 * HOUR);
    expect(await publishDueEntries(testDatabase.database, twoHoursFromNow)).toEqual([dueId]);
    expect(await publishDueEntries(testDatabase.database, twoHoursFromNow)).toEqual([]);

    const due = await api("GET", `/entries/${dueId}`);
    expect(due.json()).toMatchObject({
      status: "published",
      publishedAt: inOneHour.toISOString(),
      scheduledFor: null,
    });
    expect((await api("GET", `/entries/${laterId}`)).json().status).toBe("scheduled");
    const revisions = await api("GET", `/entries/${dueId}/revisions`);
    expect(revisions.json().revisions[0]).toMatchObject({ action: "published", author: null });
  });

  it("keeps an already published version live while a newer one waits for its time", async () => {
    const id = await createPost("Version one");
    await api("POST", `/entries/${id}/publish`);
    await api("PATCH", `/entries/${id}`, { data: { title: "Version two" } });

    await api("POST", `/entries/${id}/schedule`, {
      publishAt: new Date(Date.now() + HOUR).toISOString(),
    });

    const live = await server.inject({ method: "GET", url: "/delivery/posts/version-one" });
    expect(live.json().data.title).toBe("Version one");
    await publishDueEntries(testDatabase.database, new Date(Date.now() + 2 * HOUR));
    const updated = await server.inject({ method: "GET", url: "/delivery/posts/version-one" });
    expect(updated.json().data.title).toBe("Version two");
  });
});

describe("the scheduled publishing job", () => {
  const testDatabase = useTestDatabase();

  it("publishes entries that came due while the server was off, as soon as it starts", async () => {
    await ensureBlogPostsCollection(testDatabase.database);
    const setupServer = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    const api = requestsAs(setupServer, await signInAndGetCookies(setupServer, "ana@example.com"));
    const created = await api("POST", "/collections/posts/entries", { data: { title: "Overdue" } });
    const id: string = created.json().id;
    await api("POST", `/entries/${id}/schedule`, {
      publishAt: new Date(Date.now() + HOUR).toISOString(),
    });
    await setupServer.close();
    // As if the server had been off while the time came and went.
    await testDatabase.database
      .update(entriesTable)
      .set({ scheduledFor: new Date(Date.now() - HOUR) })
      .where(eq(entriesTable.id, id));

    const server = await startTestServer(testDatabase.activeDatabase, { runScheduledJobs: true });
    await server.close();

    const [entry] = await testDatabase.database
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.id, id));
    expect(entry?.status).toBe("published");
  });
});
