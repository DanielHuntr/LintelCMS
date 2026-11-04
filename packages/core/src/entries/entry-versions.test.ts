import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";

interface SavedEntry {
  id: string;
  version: number;
  data: Record<string, unknown>;
  updatedBy: { name: string } | null;
}

describe("two people saving the same entry", () => {
  const database = useTestDatabase();
  let server: FastifyInstance;
  let sam: SendRequest;
  let ada: SendRequest;
  let entry: SavedEntry;

  beforeEach(async () => {
    server = await startTestServer(database.activeDatabase);
    await ensurePagesCollection(database.database);
    await createPersonWithRole(database.database, "sam@example.com", "owner", "Sam Lee");
    await createPersonWithRole(database.database, "ada@example.com", "editor", "Ada King");
    sam = requestsAs(server, await signInAndGetCookies(server, "sam@example.com"));
    ada = requestsAs(server, await signInAndGetCookies(server, "ada@example.com"));
    const created = await sam("POST", "/collections/pages/entries", { data: { title: "Home" } });
    entry = created.json<SavedEntry>();
  });

  afterEach(() => server.close());

  it("counts versions from one, and moves on with every save", async () => {
    expect(entry.version).toBe(1);
    const saved = await sam("PATCH", `/entries/${entry.id}`, { data: { title: "Welcome" } });
    expect(saved.json<SavedEntry>().version).toBe(2);
  });

  it("refuses a save from a version someone else has saved over", async () => {
    const first = await sam("PATCH", `/entries/${entry.id}`, {
      data: { title: "Sam's title" },
      baseVersion: entry.version,
    });
    expect(first.statusCode).toBe(200);

    const second = await ada("PATCH", `/entries/${entry.id}`, {
      data: { title: "Ada's title" },
      baseVersion: entry.version,
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      code: "ENTRY_CHANGED",
      message: "Sam Lee saved this while you were working on it.",
      version: 2,
      changedBy: "Sam Lee",
    });
    const stored = await sam("GET", `/entries/${entry.id}`);
    expect(stored.json<SavedEntry>().data.title).toBe("Sam's title");
  });

  it("goes through once the person has seen the latest version", async () => {
    await sam("PATCH", `/entries/${entry.id}`, { data: { title: "Sam's title" } });
    const saved = await ada("PATCH", `/entries/${entry.id}`, {
      data: { title: "Ada's title" },
      baseVersion: 2,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json<SavedEntry>().updatedBy?.name).toBe("Ada King");
  });

  it("leaves saves that send no version as they were", async () => {
    await sam("PATCH", `/entries/${entry.id}`, { data: { title: "One" } });
    const saved = await ada("PATCH", `/entries/${entry.id}`, { data: { title: "Two" } });
    expect(saved.statusCode).toBe(200);
  });

  it("lets only one of two saves from the same version through, at the same moment", async () => {
    const both = await Promise.all(
      ["Sam's", "Ada's"].map((title, index) =>
        (index === 0 ? sam : ada)("PATCH", `/entries/${entry.id}`, {
          data: { title },
          baseVersion: entry.version,
        }),
      ),
    );
    expect(both.map((response) => response.statusCode).sort()).toEqual([200, 409]);
  });

  it("keeps both fields when two saves of different fields race", async () => {
    await Promise.all([
      sam("PATCH", `/entries/${entry.id}`, { data: { title: "Sam's title" } }),
      ada("PATCH", `/entries/${entry.id}`, { data: { summary: "Ada's summary" } }),
    ]);
    const stored = await sam("GET", `/entries/${entry.id}`);
    expect(stored.json<SavedEntry>().data).toMatchObject({
      title: "Sam's title",
      summary: "Ada's summary",
    });
  });

  it("counts publishing and moving as changes too", async () => {
    const published = await sam("POST", `/entries/${entry.id}/publish`);
    expect(published.json<SavedEntry>().version).toBeGreaterThan(entry.version);
  });

  it("sets a version aside in History without changing the entry", async () => {
    const kept = await ada("POST", `/entries/${entry.id}/revisions/keep`, {
      data: { title: "What Ada had" },
    });
    expect(kept.statusCode).toBe(204);
    const stored = await sam("GET", `/entries/${entry.id}`);
    expect(stored.json<SavedEntry>().data.title).toBe("Home");
    expect(stored.json<SavedEntry>().version).toBe(entry.version);
    const history = await sam("GET", `/entries/${entry.id}/revisions`);
    const { revisions } = history.json<{ revisions: { id: string; kind: string }[] }>();
    expect(revisions[0]?.kind).toBe("kept");
    const restored = await sam(
      "POST",
      `/entries/${entry.id}/revisions/${revisions[0]?.id ?? ""}/restore`,
    );
    expect(restored.json<SavedEntry>().data.title).toBe("What Ada had");
  });

  it("does not let someone set a version aside without being able to edit", async () => {
    await createPersonWithRole(database.database, "viv@example.com", "viewer", "Viv Viewer");
    const viewer = requestsAs(server, await signInAndGetCookies(server, "viv@example.com"));
    const kept = await viewer("POST", `/entries/${entry.id}/revisions/keep`, { data: {} });
    expect(kept.statusCode).toBe(403);
  });
});

describe("saving the site's navigation from an old copy", () => {
  const database = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(database.activeDatabase);
    await createPersonWithRole(database.database, "sam@example.com", "owner", "Sam Lee");
    api = requestsAs(server, await signInAndGetCookies(server, "sam@example.com"));
  });

  afterEach(() => server.close());

  const nav = (id: string) => ({
    id,
    type: "section",
    name: "",
    props: {},
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  });

  it("refuses it, and only for the section that changed", async () => {
    const read = await api("GET", "/website/sections");
    const { revisions } = read.json<{ revisions: { navigation: string; footer: string } }>();
    const first = await api("PUT", "/website/sections", {
      navigation: nav("a"),
      baseRevisions: revisions,
    });
    expect(first.statusCode).toBe(200);

    const stale = await api("PUT", "/website/sections", {
      navigation: nav("b"),
      baseRevisions: revisions,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: "SITE_SECTION_CHANGED" });

    const otherSection = await api("PUT", "/website/sections", {
      footer: nav("c"),
      baseRevisions: revisions,
    });
    expect(otherSection.statusCode).toBe(200);
  });
});
