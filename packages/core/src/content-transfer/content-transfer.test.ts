import { describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { emptyAllTables, useTestDatabase } from "../testing/test-database.js";
import { multipartFiles } from "../testing/multipart.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { makeTestPng } from "../testing/test-media.js";
import { createTestUser } from "../testing/test-users.js";
import type { ImportAction, ImportKind } from "./content-import-plan.js";

interface Plan {
  totals: Record<ImportKind, Record<ImportAction, number>>;
  warnings: string[];
}

describe("exporting and importing content", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);

  /** A small site: a page under another, a post with a category and an image, and a menu. */
  async function addContent() {
    const api = tools.api;
    const image = (
      await tools.server.inject({
        method: "POST",
        url: "/media",
        cookies: tools.cookies,
        ...multipartFiles([
          { fieldName: "file", filename: "cake.png", contents: await makeTestPng() },
        ]),
      })
    ).json<{ id: string }>();
    const about = (
      await api("POST", "/collections/pages/entries", { data: { title: "About" } })
    ).json<{ id: string }>();
    await api("POST", "/collections/pages/entries", {
      data: { title: "Team" },
      parentId: about.id,
    });
    const news = (await api("GET", "/taxonomies/categories/terms"))
      .json<{ terms: Array<{ id: string; title: string }> }>()
      .terms.find((term) => term.title === "News");
    await api("POST", "/collections/posts/entries", {
      data: { title: "Cake day", featured_image: image.id, categories: [news?.id] },
    });
    return { imageId: image.id };
  }

  async function downloadExport(): Promise<Buffer> {
    const response = await tools.api("GET", "/content-export?files=true&revisions=true");
    expect(response.statusCode).toBe(200);
    return response.rawPayload;
  }

  async function upload(contents: Buffer) {
    const response = await tools.server.inject({
      method: "POST",
      url: "/content-imports",
      cookies: tools.cookies,
      ...multipartFiles([{ fieldName: "file", filename: "export.zip", contents }]),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ uploadId: string; plan: Plan }>();
  }

  /** Empties the database as if this were a new site, keeping the signed-in admin. */
  async function startAgainEmpty() {
    await emptyAllTables(testDatabase.database);
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    return tools.signInAgain();
  }

  it("moves content, its media and references to another site", async () => {
    await addContent();
    const archive = await downloadExport();
    const api = await startAgainEmpty();

    const { uploadId, plan } = await upload(archive);
    expect(plan.totals.entry).toEqual({ create: 3, update: 0, skip: 0 });
    expect(plan.totals.media).toEqual({ create: 1, update: 0, skip: 0 });
    expect(plan.totals.collection.skip).toBe(2);

    const done = (
      await api("POST", `/content-imports/${uploadId}`, { strategy: "skip" })
    ).json<Plan>();
    expect(done.totals.entry.create).toBe(3);

    const pages = (await api("GET", "/collections/pages/entries")).json<{
      entries: Array<{ id: string; title: string; parentId: string | null }>;
    }>().entries;
    const about = pages.find((page) => page.title === "About");
    expect(pages.find((page) => page.title === "Team")?.parentId).toBe(about?.id);
    const [post] = (await api("GET", "/collections/posts/entries")).json<{
      entries: Array<{ id: string }>;
    }>().entries;
    const full = (await api("GET", `/entries/${post?.id}`)).json<{
      data: Record<string, unknown>;
    }>();
    const imageId = full.data.featured_image as string;
    expect((await tools.server.inject({ url: `/media/${imageId}/file` })).statusCode).toBe(200);
    const categories = (await api("GET", "/taxonomies/categories/terms")).json<{
      terms: Array<{ id: string; title: string }>;
    }>().terms;
    expect(full.data.categories).toEqual([categories.find((term) => term.title === "News")?.id]);
  });

  it("changes nothing when the same export is imported twice", async () => {
    await addContent();
    const archive = await downloadExport();

    const { uploadId, plan } = await upload(archive);
    expect(plan.totals.entry).toEqual({ create: 0, update: 0, skip: 3 });
    await tools.api("POST", `/content-imports/${uploadId}`, { strategy: "skip" });
    const pages = (await tools.api("GET", "/collections/pages/entries")).json<{
      entries: unknown[];
    }>().entries;
    expect(pages).toHaveLength(2);
  });

  it("replaces what is here with the file's version when asked to", async () => {
    await addContent();
    const archive = await downloadExport();
    const pages = (await tools.api("GET", "/collections/pages/entries")).json<{
      entries: Array<{ id: string; title: string }>;
    }>().entries;
    const about = pages.find((page) => page.title === "About");
    await tools.api("PATCH", `/entries/${about?.id}`, { data: { title: "About us (changed)" } });

    const { uploadId } = await upload(archive);
    const preview = (
      await tools.api("GET", `/content-imports/${uploadId}/preview?strategy=overwrite`)
    ).json<Plan>();
    expect(preview.totals.entry.update).toBe(3);
    await tools.api("POST", `/content-imports/${uploadId}`, { strategy: "overwrite" });

    const after = (await tools.api("GET", `/entries/${about?.id}`)).json<{
      data: { title: string };
    }>();
    expect(after.data.title).toBe("About");
  });

  it("explains a file that isn't an export", async () => {
    const response = await tools.server.inject({
      method: "POST",
      url: "/content-imports",
      cookies: tools.cookies,
      ...multipartFiles([
        { fieldName: "file", filename: "notes.json", contents: Buffer.from('{"hello":1}') },
      ]),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("NOT_AN_EXPORT");
  });
});
