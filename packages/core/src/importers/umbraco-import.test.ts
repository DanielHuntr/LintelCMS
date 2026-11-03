import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { redirectsTable } from "../seo/seo.table.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng } from "../testing/test-media.js";
import {
  entriesIn,
  entryData,
  fixturesFolder,
  runImport,
  uploadImport,
  zipFolder,
} from "./site-import-test-helpers.js";

/** Moving from Umbraco: a made-up uSync export (fixtures/umbraco) and a Delivery API answer. */
describe("importing from Umbraco", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);

  it("brings document types, the content tree in order, media and dictionary items", async () => {
    const archive = await zipFolder(
      join(fixturesFolder, "umbraco", "uSync"),
      {
        "wwwroot/media/k2r4/loaf.png": await makeTestPng(80, 60, 4),
      },
      "uSync/",
    );
    const created = await uploadImport(tools, "umbraco", { archive });
    expect(created.found).toMatchObject({
      contentTypes: [
        expect.objectContaining({ key: "home", entries: 1 }),
        expect.objectContaining({ key: "contentPage", handle: "content_page", entries: 2 }),
      ],
      media: 1,
      globals: 1,
    });
    expect(created.found.notes.join(" ")).toContain("Sections (Umbraco.BlockList)");

    const finished = await runImport(tools, created.id);
    expect(finished.status).toBe("complete");
    expect(finished.report.problems).toEqual([]);
    expect(finished.report.createdTypes.sort()).toEqual(["Content page", "Home"]);

    const [home] = await entriesIn(tools, "home");
    const homeData = await entryData(tools, home?.id);
    expect(homeData.data.banner).toEqual(expect.any(String));
    expect(JSON.stringify(homeData.data.welcome_text)).toContain("the old mill");

    const pages = await entriesIn(tools, "content_page");
    const about = pages.find((page) => page.slug === "about-the-mill");
    // The tree is kept across content types: About sits under Home, History under About.
    expect(about?.parentId).toBe(home?.id);
    expect(pages.find((page) => page.slug === "our-history")).toMatchObject({
      parentId: about?.id,
      status: "draft",
    });

    const dictionary = (await tools.api("GET", "/globals/dictionary")).json<{ data: unknown }>();
    expect(dictionary.data).toMatchObject({ read_more: "Read more" });

    // Home is the site's "/" here too, so About keeps its address and needs no redirect.
    expect(await testDatabase.database.select().from(redirectsTable)).toEqual([]);
  });

  it("reads the Delivery API's JSON", async () => {
    const json = await readFile(join(fixturesFolder, "umbraco", "delivery.json"));
    const created = await uploadImport(tools, "umbraco", {
      files: [{ filename: "content.json", contents: json }],
    });
    expect(created.found).toMatchObject({
      contentTypes: [
        expect.objectContaining({ key: "home", entries: 1 }),
        expect.objectContaining({ key: "contentPage", entries: 1 }),
      ],
    });
    const finished = await runImport(tools, created.id);
    expect(finished.report.problems).toEqual([]);
    const pages = await entriesIn(tools, "content_page");
    expect(pages.map((page) => page.slug)).toEqual(["opening-times"]);
  });
});
