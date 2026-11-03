import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import yazl from "yazl";
import { redirectsTable } from "../seo/seo.table.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng } from "../testing/test-media.js";
import { ArchiveHasTooManyFilesError } from "../archives/archives.errors.js";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import { archiveLimitsForImports, isSafeArchiveName } from "./import-archives.js";
import {
  entriesIn,
  entryData,
  fixturesFolder,
  mappingChoices,
  runImport,
  uploadImport,
  zipFolder,
} from "./site-import-test-helpers.js";
import { routePrefix, splitFrontMatter } from "./sources/statamic-reader.js";

/** Moving from Statamic: a zip of a made-up site's content folder (fixtures/statamic). */
describe("reading Statamic's files", () => {
  it("splits front matter from the body, and routes into prefixes", () => {
    expect(splitFrontMatter("---\ntitle: Hi\n---\nBody text")).toEqual({
      data: { title: "Hi" },
      body: "Body text",
    });
    expect(routePrefix("/news/{slug}")).toBe("/news");
    expect(routePrefix("{parent_uri}/{slug}")).toBe("");
  });

  it("never uses names that climb out of the zip", () => {
    expect(isSafeArchiveName("content/collections/pages.yaml")).toBe(true);
    expect(isSafeArchiveName("../../etc/passwd")).toBe(false);
    expect(isSafeArchiveName("/etc/passwd")).toBe(false);
    expect(isSafeArchiveName("content\\..\\x")).toBe(false);
    expect(isSafeArchiveName("C:/Windows/x")).toBe(false);
  });
});

describe("importing from Statamic", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);

  async function archive() {
    return zipFolder(join(fixturesFolder, "statamic"), {
      "public/assets/photos/seeds.png": await makeTestPng(50, 50, 3),
    });
  }

  it("brings collections, the page tree, terms, globals, navigation and assets", async () => {
    const created = await uploadImport(tools, "statamic", { archive: await archive() });
    expect(created.found).toMatchObject({
      media: 1,
      menus: 1,
      globals: 1,
      taxonomies: [{ key: "topics", name: "Topics", handle: "topics", terms: 2 }],
    });
    expect(created.found.notes.join(" ")).toContain("gallery_layout (replicator)");

    const choices = await mappingChoices(tools, created.id);
    // Statamic's pages go into Pages here, their Markdown into its body.
    expect(choices.suggested.contentTypes.pages).toMatchObject({
      collection: "pages",
      create: false,
      fields: { content: "body" },
    });
    expect(choices.suggested.contentTypes.blog).toMatchObject({ collection: "blog", create: true });

    const finished = await runImport(tools, created.id);
    expect(finished.status).toBe("complete");
    expect(finished.report.problems).toEqual([]);

    const pages = await entriesIn(tools, "pages");
    const about = pages.find((page) => page.slug === "about");
    expect(pages.find((page) => page.slug === "rules")?.parentId).toBe(about?.id);
    const rules = await entryData(tools, pages.find((page) => page.slug === "rules")?.id);
    expect(JSON.stringify(rules.data.body)).toContain("No hosepipes in July");

    const news = await entriesIn(tools, "blog");
    expect(news.map((post) => [post.slug, post.status]).sort()).toEqual([
      ["draft-plans", "draft"],
      ["seed-swap", "published"],
    ]);
    const swap = await entryData(tools, news.find((post) => post.slug === "seed-swap")?.id);
    expect(swap.publishedAt).toBe("2024-03-02T00:00:00.000Z");
    expect(swap.data.hero).toEqual(expect.any(String));
    expect(swap.data.topics).toHaveLength(1);
    expect(JSON.stringify(swap.data.intro)).toContain("hut");

    const terms = (await tools.api("GET", "/taxonomies/topics/terms")).json<{
      terms: Array<{ slug: string }>;
    }>();
    expect(terms.terms.map((term) => term.slug).sort()).toEqual(["events", "growing"]);

    const contact = (await tools.api("GET", "/globals/contact")).json<{ data: unknown }>();
    expect(contact.data).toMatchObject({ phone: "01234 567890", email: "hello@brookside.example" });

    const menu = (await tools.api("GET", "/navigation/main_menu")).json<{
      items: Array<{ entryId: string | null; url: string | null; children: unknown[] }>;
    }>();
    expect(menu.items[0]?.entryId).toBe(about?.id);
    expect(menu.items[0]?.children).toHaveLength(1);
    expect(menu.items[1]?.url).toBe("https://council.example/allotments");

    // The page tree's addresses carry over; news loses the year from its addresses.
    const redirects = await testDatabase.database.select().from(redirectsTable);
    expect(
      redirects.map((redirect) => [redirect.fromPath, redirect.toPath, redirect.status]),
    ).toEqual([["/news/2024/seed-swap", "/news/seed-swap", "suggested"]]);
  });

  it("refuses a zip without a Statamic content folder, or with too many files", async () => {
    const response = await tools.server.inject({
      method: "POST",
      url: "/site-imports/statamic",
      cookies: tools.cookies,
      ...(await import("../testing/multipart.js")).multipartFiles([
        {
          fieldName: "archive",
          filename: "site.zip",
          contents: await zipFolder(join(fixturesFolder, "webflow", "site")),
        },
      ]),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("NOT_AN_EXPORT");

    const crowded = new yazl.ZipFile();
    for (let index = 0; index < 4; index += 1) {
      crowded.addBuffer(Buffer.alloc(0), `content/collections/x/${index}.md`);
    }
    crowded.end();
    const chunks: Buffer[] = [];
    for await (const chunk of crowded.outputStream) chunks.push(chunk as Buffer);
    const path = join(tools.folder, "crowded.zip");
    await writeFile(path, Buffer.concat(chunks));
    await expect(
      ZipArchiveReader.open(path, { ...archiveLimitsForImports, maxFiles: 3 }),
    ).rejects.toBeInstanceOf(ArchiveHasTooManyFilesError);
  });
});
