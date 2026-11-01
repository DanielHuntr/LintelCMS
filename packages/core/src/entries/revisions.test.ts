import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("revisions", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;
  let userId: string;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    userId = (await createTestUser(testDatabase.database, "ana@example.com", [["*"]])).id;
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  it("records every save, publish, unpublish and restore, newest first, with the author", async () => {
    const created = await api("POST", "/collections/pages/entries", { data: { title: "About" } });
    const id = created.json().id;
    await api("PATCH", `/entries/${id}`, { data: { title: "About us" } });
    await api("POST", `/entries/${id}/publish`);
    await api("POST", `/entries/${id}/unpublish`);

    const response = await api("GET", `/entries/${id}/revisions`);

    expect(response.statusCode).toBe(200);
    const revisions = response.json().revisions;
    expect(revisions.map((revision: { action: string }) => revision.action)).toEqual([
      "unpublished",
      "published",
      "saved",
      "saved",
    ]);
    expect(revisions[0]).toMatchObject({ author: { id: userId, name: "Ana Editor" } });
    expect(Object.keys(revisions[0]).sort()).toEqual(["action", "author", "createdAt", "id"]);
  });

  it("shows one revision's values, and restores them as a new save", async () => {
    const created = await api("POST", "/collections/pages/entries", {
      data: { title: "About", summary: "Who we are" },
    });
    const id = created.json().id;
    await api("POST", `/entries/${id}/publish`);
    await api("PATCH", `/entries/${id}`, { data: { title: "About us", summary: null } });
    const [, , firstSave] = (await api("GET", `/entries/${id}/revisions`)).json().revisions;

    const revision = await api("GET", `/entries/${id}/revisions/${firstSave.id}`);
    expect(revision.json()).toMatchObject({
      id: firstSave.id,
      action: "saved",
      data: { title: "About", summary: "Who we are" },
    });

    const restored = await api("POST", `/entries/${id}/revisions/${firstSave.id}/restore`);
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({
      data: { title: "About", summary: "Who we are" },
      status: "published",
      // Restoring the published values leaves nothing new to publish.
      hasUnpublishedChanges: false,
    });
    const latest = (await api("GET", `/entries/${id}/revisions`)).json().revisions[0];
    expect(latest).toMatchObject({ action: "restored", author: { id: userId } });
  });

  it("restores values that miss a newly required field, and asks for it before publishing", async () => {
    const created = await api("POST", "/collections/pages/entries", { data: { title: "About" } });
    const id = created.json().id;
    const [saved] = (await api("GET", `/entries/${id}/revisions`)).json().revisions;
    const page = (await api("GET", "/blueprints/page")).json();
    await api("PUT", "/blueprints/page", {
      name: "Page",
      fields: [...page.fields, { handle: "owner", label: "Owner", type: "text", required: true }],
    });

    const restored = await api("POST", `/entries/${id}/revisions/${saved.id}/restore`);
    const published = await api("POST", `/entries/${id}/publish`);

    expect(restored.statusCode).toBe(200);
    expect(published.statusCode).toBe(400);
    expect(published.json()).toMatchObject({
      code: "NOT_READY_TO_PUBLISH",
      message: "Fill in the required fields to publish.",
      fields: { owner: "Owner is required" },
    });
  });

  it("answers 404 for a revision of another entry or one that doesn't exist", async () => {
    const first = (
      await api("POST", "/collections/pages/entries", { data: { title: "One" } })
    ).json();
    const second = (
      await api("POST", "/collections/pages/entries", { data: { title: "Two" } })
    ).json();
    const [revisionOfFirst] = (await api("GET", `/entries/${first.id}/revisions`)).json().revisions;

    expect(
      (await api("GET", `/entries/${second.id}/revisions/${revisionOfFirst.id}`)).statusCode,
    ).toBe(404);
    expect((await api("GET", `/entries/${second.id}/revisions/nope`)).statusCode).toBe(404);
    expect(
      (await api("POST", `/entries/${second.id}/revisions/${revisionOfFirst.id}/restore`))
        .statusCode,
    ).toBe(404);
  });
});
