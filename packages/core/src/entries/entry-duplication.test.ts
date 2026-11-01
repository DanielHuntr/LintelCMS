import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { copyTitle } from "./entry-duplication.service.js";

describe("copyTitle", () => {
  it("adds “(copy)”, keeping within the title's limit", () => {
    expect(copyTitle("About us", undefined)).toBe("About us (copy)");
    expect(copyTitle("About us", 10)).toBe("Abo (copy)");
    expect(copyTitle(undefined, undefined)).toBe(" (copy)");
  });
});

describe("POST /entries/:id/duplicate", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  async function createPage(title: string, parentId?: string): Promise<string> {
    const created = await api("POST", "/collections/pages/entries", {
      data: { title, summary: `About ${title}` },
      parentId,
    });
    return created.json().id;
  }

  async function titlesInOrder(): Promise<string[]> {
    const list = (await api("GET", "/collections/pages/entries")).json();
    return list.entries.map((entry: { title: string }) => entry.title);
  }

  it("makes a draft copy straight after the original, under the same parent", async () => {
    const about = await createPage("About");
    const team = await createPage("Team", about);
    await createPage("History", about);
    await createPage("Contact");
    await api("POST", `/entries/${team}/publish`);

    const response = await api("POST", `/entries/${team}/duplicate`);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      title: "Team (copy)",
      slug: "team-copy",
      status: "draft",
      parentId: about,
      data: { title: "Team (copy)", summary: "About Team" },
    });
    expect(await titlesInOrder()).toEqual(["About", "Team", "Team (copy)", "History", "Contact"]);
  });

  it("copies the saved draft, not the published version", async () => {
    const id = (
      await api("POST", "/collections/posts/entries", { data: { title: "Hours", excerpt: "9-5" } })
    ).json().id;
    await api("POST", `/entries/${id}/publish`);
    await api("PATCH", `/entries/${id}`, { data: { excerpt: "8-6" } });

    const copy = (await api("POST", `/entries/${id}/duplicate`)).json();

    expect(copy.data.excerpt).toBe("8-6");
    expect(copy.publishedAt).toBeNull();
  });

  it("needs entries:create, and 404s for an unknown entry", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["entries:read"]]);
    const reader = requestsAs(server, await signInAndGetCookies(server, "reader@example.com"));
    const id = await createPage("About");

    expect((await reader("POST", `/entries/${id}/duplicate`)).statusCode).toBe(403);
    expect(
      (await api("POST", "/entries/11111111-2222-4333-8444-555555555555/duplicate")).statusCode,
    ).toBe(404);
  });
});
