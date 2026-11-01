import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";

describe("Authors and their own content", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asAuthor: SendRequest;
  let asEditor: SendRequest;
  let ownPostId: string;
  let othersPostId: string;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensureBlogPostsCollection(testDatabase.database);
    await createPersonWithRole(testDatabase.database, "amy@example.com", "author");
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor");
    asAuthor = requestsAs(server, await signInAndGetCookies(server, "amy@example.com"));
    asEditor = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));
    ownPostId = (
      await asAuthor("POST", "/collections/posts/entries", { data: { title: "Mine" } })
    ).json().id;
    othersPostId = (
      await asEditor("POST", "/collections/posts/entries", { data: { title: "Ed's" } })
    ).json().id;
  });

  afterEach(() => server.close());

  it("can see everyone's content", async () => {
    const list = await asAuthor("GET", "/collections/posts/entries");
    const other = await asAuthor("GET", `/entries/${othersPostId}`);

    expect(list.json().total).toBe(2);
    expect(other.statusCode).toBe(200);
    expect(other.json().createdById).not.toBeNull();
  });

  it("edits, publishes, unpublishes and deletes their own entries", async () => {
    expect(
      (await asAuthor("PATCH", `/entries/${ownPostId}`, { data: { title: "Mine, edited" } }))
        .statusCode,
    ).toBe(200);
    expect((await asAuthor("POST", `/entries/${ownPostId}/publish`)).statusCode).toBe(200);
    expect((await asAuthor("POST", `/entries/${ownPostId}/unpublish`)).statusCode).toBe(200);
    expect((await asAuthor("DELETE", `/entries/${ownPostId}`)).statusCode).toBe(204);
  });

  it("can't edit, publish, restore or delete anyone else's", async () => {
    const attempts = [
      await asAuthor("PATCH", `/entries/${othersPostId}`, { data: { title: "Taken over" } }),
      await asAuthor("POST", `/entries/${othersPostId}/publish`),
      await asAuthor("POST", `/entries/${othersPostId}/schedule`, {
        publishAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      await asAuthor("DELETE", `/entries/${othersPostId}`),
    ];
    const revisions = (await asEditor("GET", `/entries/${othersPostId}/revisions`)).json();
    attempts.push(
      await asAuthor(
        "POST",
        `/entries/${othersPostId}/revisions/${revisions.revisions[0].id}/restore`,
      ),
    );

    for (const attempt of attempts) {
      expect(attempt.statusCode).toBe(403);
      expect(attempt.json()).toMatchObject({ code: "PERMISSION_DENIED" });
    }
  });

  it("lets an Editor change anyone's", async () => {
    expect(
      (await asEditor("PATCH", `/entries/${ownPostId}`, { data: { title: "Edited by Ed" } }))
        .statusCode,
    ).toBe(200);
    expect((await asEditor("DELETE", `/entries/${ownPostId}`)).statusCode).toBe(204);
  });

  it("can't change content types or settings", async () => {
    expect((await asAuthor("GET", "/api-tokens")).statusCode).toBe(403);
    expect((await asAuthor("POST", "/collections", { name: "X", handle: "x" })).statusCode).toBe(
      403,
    );
  });
});
