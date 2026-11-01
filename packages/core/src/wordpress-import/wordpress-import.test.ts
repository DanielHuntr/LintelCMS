import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import yazl from "yazl";
import { describe, expect, it } from "vitest";
import { entriesTable } from "../entries/entries.table.js";
import { redirectsTable } from "../seo/seo.table.js";
import { usersTable } from "../users/users.table.js";
import { multipartFiles } from "../testing/multipart.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng } from "../testing/test-media.js";
import { pauseInterruptedImports } from "./wordpress-import.service.js";
import { wordpressImportItemsTable, wordpressImportsTable } from "./wordpress-import.table.js";

const bakery = readFileSync(new URL("./fixtures/small-bakery.xml", import.meta.url));

/** A zip of the old site's wp-content folder, holding the loaf picture but not the bunny. */
async function contentZip(): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  zip.addBuffer(await makeTestPng(120, 80), "wp-content/uploads/2024/03/loaf.png");
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

interface Report {
  dryRun: boolean;
  counts: Record<string, { done: number; skipped: number; failed: number }>;
  invitedPeople: Array<{ name: string; email: string }>;
  keptAsHtml: Record<string, number>;
  redirectsSuggested: number;
  problems: Array<{ title: string; message: string }>;
}

describe("importing from WordPress", () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);

  async function uploadBakery() {
    const response = await tools.server.inject({
      method: "POST",
      url: "/wordpress-imports",
      cookies: tools.cookies,
      ...multipartFiles([
        { fieldName: "export", filename: "bakery.xml", contents: bakery },
        { fieldName: "content", filename: "wp-content.zip", contents: await contentZip() },
      ]),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ id: string; found: Record<string, unknown> }>();
  }

  async function entriesIn(collection: "posts" | "pages") {
    const response = await tools.api("GET", `/collections/${collection}/entries`);
    return response.json<{ entries: Array<{ id: string; title: string; slug: string; status: string; parentId: string | null }> }>().entries;
  }

  it("reads the export, offers a mapping and shows a dry run that changes nothing", async () => {
    const created = await uploadBakery();
    expect(created.found).toMatchObject({ posts: 3, pages: 2, attachments: 1, authors: 2 });

    const choices = (await tools.api("GET", `/wordpress-imports/${created.id}/mapping`)).json<{
      suggested: Record<string, unknown>;
    }>();
    expect(choices.suggested).toMatchObject({ postsCollection: "posts", pagesCollection: "pages" });

    const saved = await tools.api("PUT", `/wordpress-imports/${created.id}/mapping`, {
      ...choices.suggested,
      media: "zip",
    });
    expect(saved.json().fields.posts).toEqual({
      title: "title",
      body: "body",
      excerpt: "excerpt",
      featuredImage: "featured_image",
      categories: "categories",
      tags: "tags",
    });

    const dryRun = (await tools.api("POST", `/wordpress-imports/${created.id}/dry-run`)).json<Report>();
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.counts.post).toEqual({ done: 2, skipped: 1, failed: 0 });
    expect(dryRun.counts.page).toEqual({ done: 2, skipped: 0, failed: 0 });
    expect(dryRun.counts.image).toEqual({ done: 0, skipped: 0, failed: 1 });
    expect(dryRun.keptAsHtml).toMatchObject({ embed: 1, columns: 1, "[gallery] shortcode": 1 });
    expect(dryRun.invitedPeople).toHaveLength(2);
    expect(await entriesIn("posts")).toEqual([]);
  });

  it("imports posts, the page tree, terms, images, people and redirect suggestions", async () => {
    const created = await uploadBakery();
    await tools.api("PUT", `/wordpress-imports/${created.id}/mapping`, { media: "zip" });

    expect((await tools.api("POST", `/wordpress-imports/${created.id}/start`)).statusCode).toBe(202);
    await tools.server.dataTools.tasks.finishAll();

    const finished = (await tools.api("GET", `/wordpress-imports/${created.id}`)).json<{
      status: string;
      progress: { done: number; total: number };
      report: Report;
    }>();
    expect(finished.status).toBe("complete");
    expect(finished.progress.done).toBe(finished.progress.total);
    expect(finished.report.problems).toEqual([
      expect.objectContaining({ message: expect.stringContaining("isn't in the wp-content zip") }),
    ]);

    const posts = await entriesIn("posts");
    expect(posts.map((post) => [post.slug, post.status]).sort()).toEqual([
      ["easter-opening-hours", "draft"],
      ["our-new-sourdough", "published"],
    ]);
    const sourdough = (await tools.api("GET", `/entries/${posts.find((post) => post.slug === "our-new-sourdough")?.id}`)).json<{
      data: Record<string, unknown>;
      publishedAt: string;
    }>();
    expect(sourdough.publishedAt).toBe("2024-03-02T10:30:00.000Z");
    expect(sourdough.data.featured_image).toEqual(expect.any(String));
    expect(sourdough.data.categories).toHaveLength(1);
    expect(sourdough.data.excerpt).toBe("Three days in the making.");
    expect(JSON.stringify(sourdough.data.body)).toContain("http://api.test/media/");

    const pages = await entriesIn("pages");
    const about = pages.find((page) => page.slug === "about-us");
    expect(pages.find((page) => page.slug === "our-team")?.parentId).toBe(about?.id);

    const people = await testDatabase.database.select().from(usersTable).where(eq(usersTable.email, "maria@hillside-bakery.example"));
    expect(people[0]?.passwordHash).toBeNull();

    const redirects = await testDatabase.database.select().from(redirectsTable);
    expect(redirects.map((redirect) => [redirect.fromPath, redirect.toPath, redirect.status]).sort()).toEqual([
      ["/2024/03/our-new-sourdough", "/blog/our-new-sourdough", "suggested"],
      ["/about-us/our-team", "/our-team", "suggested"],
    ]);
  });

  it("resumes a stopped import without bringing anything in twice", async () => {
    const created = await uploadBakery();
    await tools.api("PUT", `/wordpress-imports/${created.id}/mapping`, { media: "zip" });
    await tools.api("POST", `/wordpress-imports/${created.id}/start`);
    await tools.server.dataTools.tasks.finishAll();

    // As if the server had stopped before the posts: they're undone and the import was running.
    const database = testDatabase.database;
    const postItems = await database.select().from(wordpressImportItemsTable).where(eq(wordpressImportItemsTable.kind, "post"));
    for (const item of postItems.filter((candidate) => candidate.targetId)) {
      await database.delete(entriesTable).where(eq(entriesTable.id, item.targetId as string));
    }
    await database.update(wordpressImportItemsTable).set({ status: "pending", targetId: null }).where(eq(wordpressImportItemsTable.kind, "post"));
    await database.update(wordpressImportsTable).set({ status: "running" });
    await pauseInterruptedImports(database);
    expect((await tools.api("GET", `/wordpress-imports/${created.id}`)).json().status).toBe("paused");

    await tools.api("POST", `/wordpress-imports/${created.id}/start`);
    await tools.server.dataTools.tasks.finishAll();

    expect((await entriesIn("posts")).length).toBe(2);
    expect((await entriesIn("pages")).length).toBe(2);
    expect((await tools.api("GET", "/media")).json().total).toBe(1);
  });

  it("refuses a file that isn't a WordPress export, and needs permission", async () => {
    const response = await tools.server.inject({
      method: "POST",
      url: "/wordpress-imports",
      cookies: tools.cookies,
      ...multipartFiles([{ fieldName: "export", filename: "notes.xml", contents: Buffer.from("<notes/>") }]),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("NOT_A_WORDPRESS_EXPORT");

    expect((await tools.server.inject({ method: "GET", url: "/wordpress-imports" })).statusCode).toBe(401);
  });
});
