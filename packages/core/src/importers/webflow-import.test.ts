import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { entriesTable } from "../entries/entries.table.js";
import { redirectsTable } from "../seo/seo.table.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng } from "../testing/test-media.js";
import { designedPageFromHtml } from "./designed-pages.js";
import { pauseInterruptedSiteImports } from "./site-import.service.js";
import { siteImportItemsTable, siteImportsTable } from "./site-import.table.js";
import {
  entriesIn,
  entryData,
  fixturesFolder,
  mappingChoices,
  runImport,
  startPictureServer,
  uploadImport,
  zipFolder,
} from "./site-import-test-helpers.js";

/**
 * Moving from Webflow: a collection's CSV and the site's code export (fixtures/webflow,
 * made up). Pictures on the "CDN" come from a small server on this machine.
 */
const csvName = "Fernleaf - Blog Posts - 64f1c2a9e7.csv";

describe("turning an exported page into a designed page", () => {
  it("makes code blocks with editable text and pictures, and no scripts", () => {
    const page = designedPageFromHtml(
      `<body><section><h1>Hello</h1><img src="images/a.png" alt="A"><script>x()</script>
       <p onclick="steal()">Text</p></section><footer><p>Bye</p></footer></body>`,
      ".a { color: red; }",
      (address) =>
        address === "images/a.png" ? { src: "/media/1/file", assetId: "asset-1", alt: "" } : null,
    );
    expect(page.blocks).toBe(2);
    expect(page.editableTexts).toBe(3);
    const first = page.document.root.children[0];
    const html = String(first?.props.html);
    expect(html).toContain('data-lintel-field="text-1"');
    expect(html).toContain('src="/media/1/file"');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(first?.props.images).toEqual({
      "picture-1": { src: "/media/1/file", assetId: "asset-1", alt: "A" },
    });
    expect(first?.props.css).toBe(".a { color: red; }");
  });
});

describe("importing from Webflow", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);
  const closers: Array<() => void> = [];
  afterEach(() => closers.splice(0).forEach((close) => close()));

  async function upload() {
    const cdn = await startPictureServer(await makeTestPng(60, 40, 1));
    closers.push(() => cdn.server.close());
    const csv = (await readFile(join(fixturesFolder, "webflow", csvName), "utf8")).replaceAll(
      "{{pictures}}",
      `${cdn.address}/64f1c2a9e7`,
    );
    const archive = await zipFolder(
      join(fixturesFolder, "webflow", "site"),
      { "fernleaf-site/images/logo.png": await makeTestPng(40, 40, 2) },
      "fernleaf-site/",
    );
    const created = await uploadImport(tools, "webflow", {
      files: [{ filename: csvName, contents: Buffer.from(csv) }],
      archive,
    });
    return { created, cdn };
  }

  it("previews collections and pages, suggests a mapping and changes nothing in a dry run", async () => {
    const { created, cdn } = await upload();
    expect(created.found).toMatchObject({
      contentTypes: [
        expect.objectContaining({ key: "pages", entries: 3 }),
        expect.objectContaining({
          key: "blog-posts",
          name: "Blog Posts",
          structure: "dated",
          entries: 4,
          fields: [
            { key: "Post body", label: "Post body", kind: "richText" },
            { key: "Main image", label: "Main image", kind: "image" },
            { key: "Featured", label: "Featured", kind: "toggle" },
            { key: "Reading minutes", label: "Reading minutes", kind: "number" },
            { key: "Category", label: "Category", kind: "select" },
          ],
        }),
      ],
    });
    expect(created.found.notes.join(" ")).toContain("detail_blog-posts.html");

    const choices = await mappingChoices(tools, created.id);
    expect(choices.suggested.contentTypes.pages).toMatchObject({
      collection: "pages",
      create: false,
      fields: { design: "design" },
    });
    expect(choices.suggested.contentTypes["blog-posts"]).toMatchObject({
      collection: "blog_posts",
      create: true,
      fields: { "Post body": "post_body", "Main image": "main_image" },
    });

    // The picture server isn't the old site, so it has to be allowed first.
    const blocked = (await tools.api("POST", `/site-imports/${created.id}/dry-run`)).json<{
      problems: Array<{ message: string }>;
    }>();
    expect(blocked.problems.map((problem) => problem.message).join(" ")).toContain("127.0.0.1");

    const host = new URL(cdn.address).host;
    const saved = await tools.api("PUT", `/site-imports/${created.id}/mapping`, {
      ...choices.suggested,
      mediaHosts: [host],
    });
    expect(saved.statusCode, saved.body).toBe(200);
    const dryRun = (await tools.api("POST", `/site-imports/${created.id}/dry-run`)).json<{
      dryRun: boolean;
      counts: Record<string, { done: number; skipped: number; failed: number }>;
    }>();
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.counts.entry).toEqual({ done: 7, skipped: 0, failed: 0 });
    expect(dryRun.counts.media).toEqual({ done: 2, skipped: 0, failed: 0 });
    expect(cdn.requests).toEqual([]);
    expect((await tools.api("GET", "/collections/blog_posts")).statusCode).toBe(404);
  });

  it("refuses a mapping into fields that can't hold the values", async () => {
    const { created } = await upload();
    const choices = await mappingChoices(tools, created.id);
    const wrong = await tools.api("PUT", `/site-imports/${created.id}/mapping`, {
      ...choices.suggested,
      contentTypes: {
        ...choices.suggested.contentTypes,
        pages: { collection: "pages", create: false, name: "Pages", fields: { design: "title" } },
      },
    });
    expect(wrong.statusCode).toBe(400);
  });

  it("imports pages as designs, the collection as a new content type, and redirects", async () => {
    const { created, cdn } = await upload();
    const choices = await mappingChoices(tools, created.id);
    await tools.api("PUT", `/site-imports/${created.id}/mapping`, {
      ...choices.suggested,
      mediaHosts: [new URL(cdn.address).host],
    });
    const finished = await runImport(tools, created.id);
    expect(finished.status).toBe("complete");
    expect(finished.report.problems).toEqual([]);
    expect(finished.report.createdTypes).toEqual(["Blog Posts"]);
    expect(finished.report.designedPages.sort()).toEqual(["About", "Fernleaf", "Our team"]);
    expect(cdn.requests).toEqual(["/64f1c2a9e7/sowing.png"]);

    const pages = await entriesIn(tools, "pages");
    const about = pages.find((page) => page.slug === "about");
    expect(pages.find((page) => page.slug === "team")?.parentId).toBe(about?.id);
    const home = await entryData(tools, pages.find((page) => page.slug === "home")?.id);
    const design = home.data.design as {
      root: { children: Array<{ props: Record<string, unknown> }> };
    };
    const html = design.root.children.map((block) => String(block.props.html)).join("");
    expect(html).toContain("Grow something good");
    expect(html).toContain("http://api.test/media/");
    expect(html).not.toContain("tracking");

    const posts = await entriesIn(tools, "blog_posts");
    expect(posts.map((post) => [post.slug, post.status]).sort()).toEqual([
      ["old-offer", "draft"],
      ["spring-sowing", "published"],
      ["summer-plans", "draft"],
      ["tool-care", "published"],
    ]);
    const sowing = await entryData(tools, posts.find((post) => post.slug === "spring-sowing")?.id);
    expect(sowing.publishedAt).toBe("2024-03-02T10:00:00.000Z");
    expect(sowing.data).toMatchObject({
      featured: true,
      reading_minutes: 4,
      category: "Guides",
      main_image: expect.any(String),
    });
    expect(JSON.stringify(sowing.data.post_body)).toContain("every week");

    const redirects = await testDatabase.database.select().from(redirectsTable);
    // Every old address is the same here (the page tree and /blog-posts/ carry over), so
    // no redirects are needed.
    expect(redirects).toEqual([]);
  });

  it("resumes a stopped import without bringing anything in twice", async () => {
    const { created, cdn } = await upload();
    const choices = await mappingChoices(tools, created.id);
    await tools.api("PUT", `/site-imports/${created.id}/mapping`, {
      ...choices.suggested,
      mediaHosts: [new URL(cdn.address).host],
    });
    await runImport(tools, created.id);
    const database = testDatabase.database;
    const entryItems = await database
      .select()
      .from(siteImportItemsTable)
      .where(eq(siteImportItemsTable.kind, "entry"));
    // As if the server had stopped before the blog posts.
    const posts = entryItems.filter((item) => item.sourceId.startsWith("blog-posts/"));
    for (const item of posts) {
      if (item.targetId)
        await database.delete(entriesTable).where(eq(entriesTable.id, item.targetId));
      await database
        .update(siteImportItemsTable)
        .set({ status: "pending", targetId: null })
        .where(eq(siteImportItemsTable.id, item.id));
    }
    await database.update(siteImportsTable).set({ status: "running" });
    await pauseInterruptedSiteImports(database);
    expect((await tools.api("GET", `/site-imports/${created.id}`)).json().status).toBe("paused");

    const resumed = await runImport(tools, created.id);
    expect(resumed.status).toBe("complete");
    expect(await entriesIn(tools, "blog_posts")).toHaveLength(4);
    expect(await entriesIn(tools, "pages")).toHaveLength(3);
  });

  it("skips what an earlier import of the same files brought in", async () => {
    for (let run = 0; run < 2; run += 1) {
      const { created, cdn } = await upload();
      const choices = await mappingChoices(tools, created.id);
      await tools.api("PUT", `/site-imports/${created.id}/mapping`, {
        ...choices.suggested,
        contentTypes: {
          ...choices.suggested.contentTypes,
          "blog-posts": {
            ...choices.suggested.contentTypes["blog-posts"],
            create: run === 0,
            name: "Blog Posts",
          },
        },
        mediaHosts: [new URL(cdn.address).host],
      });
      const finished = await runImport(tools, created.id);
      if (run === 1) expect(finished.report.counts.entry).toMatchObject({ done: 0, skipped: 7 });
    }
    expect(await entriesIn(tools, "blog_posts")).toHaveLength(4);
  });
});
