import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

const DAY = 24 * 60 * 60 * 1000;

describe("listing scheduled entries for the calendar", () => {
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

  async function schedulePost(title: string, publishAt: Date): Promise<string> {
    const created = await api("POST", "/collections/posts/entries", { data: { title } });
    const id: string = created.json().id;
    await api("POST", `/entries/${id}/schedule`, { publishAt: publishAt.toISOString() });
    return id;
  }

  function range(from: Date, to: Date) {
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    return api("GET", `/entries/scheduled?${query}`);
  }

  it("lists what is due in the time asked for, soonest first, and nothing else", async () => {
    const start = new Date(Date.now() + DAY);
    const later = await schedulePost("Summer menu", new Date(start.getTime() + 3 * DAY));
    const sooner = await schedulePost("Bank holiday hours", new Date(start.getTime() + DAY));
    await schedulePost("Christmas orders", new Date(start.getTime() + 40 * DAY));
    await api("POST", "/collections/posts/entries", { data: { title: "Just a draft" } });

    const response = await range(start, new Date(start.getTime() + 30 * DAY));

    expect(response.statusCode).toBe(200);
    expect(response.json().entries).toEqual([
      expect.objectContaining({
        id: sooner,
        title: "Bank holiday hours",
        collectionHandle: "posts",
        action: "publish",
      }),
      expect.objectContaining({ id: later, title: "Summer menu" }),
    ]);
  });

  it("leaves out an entry once it is no longer scheduled", async () => {
    const start = new Date(Date.now() + DAY);
    const id = await schedulePost("Changed my mind", new Date(start.getTime() + DAY));
    await api("POST", `/entries/${id}/unpublish`);

    const response = await range(start, new Date(start.getTime() + 7 * DAY));

    expect(response.json().entries).toEqual([]);
  });

  it("asks for a sensible range", async () => {
    const start = new Date();
    const backwards = await range(start, new Date(start.getTime() - DAY));
    const tooLong = await range(start, new Date(start.getTime() + 90 * DAY));
    const missing = await api("GET", "/entries/scheduled");

    expect(backwards.statusCode).toBe(400);
    expect(backwards.json().message).toContain("to should be after from");
    expect(tooLong.json().message).toContain("at most 62 days");
    expect(missing.statusCode).toBe(400);
  });

  it("needs entries:read", async () => {
    await createTestUser(testDatabase.database, "guest@example.com", [["media:read"]]);
    const guest = requestsAs(server, await signInAndGetCookies(server, "guest@example.com"));
    const query = `from=${new Date().toISOString()}&to=${new Date(Date.now() + DAY).toISOString()}`;

    expect((await guest("GET", `/entries/scheduled?${query}`)).statusCode).toBe(403);
    expect(
      (await server.inject({ method: "GET", url: `/entries/scheduled?${query}` })).statusCode,
    ).toBe(401);
  });
});
