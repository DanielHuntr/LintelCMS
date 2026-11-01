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

  async function kinds(id: string): Promise<string[]> {
    const { revisions } = (await api("GET", `/entries/${id}/revisions`)).json();
    return revisions.map((revision: { kind: string }) => revision.kind);
  }

  it("records edits, publishing, unpublishing and scheduling, newest first, with the author", async () => {
    const created = await api("POST", "/collections/pages/entries", { data: { title: "About" } });
    const id = created.json().id;
    await api("PATCH", `/entries/${id}`, { data: { title: "About us" } });
    await api("POST", `/entries/${id}/publish`);
    await api("POST", `/entries/${id}/unpublish`);
    await api("POST", `/entries/${id}/schedule`, {
      publishAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const response = await api("GET", `/entries/${id}/revisions`);

    expect(response.statusCode).toBe(200);
    const revisions = response.json().revisions;
    expect(await kinds(id)).toEqual(["scheduled", "unpublished", "published", "edited"]);
    expect(revisions[0]).toMatchObject({ author: { id: userId, name: "Ana Editor" } });
    expect(Object.keys(revisions[0]).sort()).toEqual([
      "author",
      "createdAt",
      "id",
      "kind",
      "restoredFromAt",
      "updatedAt",
    ]);
  });

  it("gathers one person's autosaves into one revision that keeps the latest values", async () => {
    const created = await api("POST", "/collections/pages/entries", { data: { title: "A" } });
    const id = created.json().id;
    for (const title of ["Ab", "Abo", "Abou", "About"]) {
      await api("PATCH", `/entries/${id}`, { data: { title } });
    }

    const { revisions } = (await api("GET", `/entries/${id}/revisions`)).json();
    expect(revisions).toHaveLength(1);
    const only = (await api("GET", `/entries/${id}/revisions/${revisions[0].id}`)).json();
    expect(only).toMatchObject({ kind: "edited", data: { title: "About" } });
    expect(Date.parse(only.updatedAt)).toBeGreaterThanOrEqual(Date.parse(only.createdAt));
  });

  it("starts a new revision after Save version, and after anything else happens", async () => {
    const created = await api("POST", "/collections/pages/entries", { data: { title: "One" } });
    const id = created.json().id;
    await api("PATCH", `/entries/${id}`, { data: { title: "Two" }, saveVersion: true });
    await api("PATCH", `/entries/${id}`, { data: { title: "Three" } });
    expect(await kinds(id)).toEqual(["edited", "edited"]);

    await api("POST", `/entries/${id}/publish`);
    await api("PATCH", `/entries/${id}`, { data: { title: "Four" } });
    expect(await kinds(id)).toEqual(["edited", "published", "edited", "edited"]);
  });

  it("starts a new revision when someone else edits", async () => {
    const benId = (await createTestUser(testDatabase.database, "ben@example.com", [["*"]])).id;
    const ben = requestsAs(server, await signInAndGetCookies(server, "ben@example.com"));
    const created = await api("POST", "/collections/pages/entries", { data: { title: "One" } });
    const id = created.json().id;

    await ben("PATCH", `/entries/${id}`, { data: { title: "Two" } });
    await api("PATCH", `/entries/${id}`, { data: { title: "Three" } });

    const { revisions } = (await api("GET", `/entries/${id}/revisions`)).json();
    expect(revisions.map((revision: { author: { id: string } }) => revision.author.id)).toEqual([
      userId,
      benId,
      userId,
    ]);
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
      kind: "edited",
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
    expect(latest).toMatchObject({
      kind: "restored",
      restoredFromAt: firstSave.createdAt,
      author: { id: userId },
    });
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
