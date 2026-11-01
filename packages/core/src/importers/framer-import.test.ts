import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";
import {
  entriesIn,
  entryData,
  fixturesFolder,
  mappingChoices,
  runImport,
  uploadImport,
} from "./site-import-test-helpers.js";
import { collectionName } from "./sources/csv-collections.js";

/** Moving from Framer: a made-up CMS collection's CSV (fixtures/framer). */
describe("importing from Framer", { timeout: 60_000 }, () => {
  const tools = useDataToolsTestServer(useTestDatabase());

  it("names collections from their files", () => {
    expect(collectionName("Fernleaf - Blog Posts - 64f1c2a9e7.csv")).toBe("Blog Posts");
    expect(collectionName("Recipes.csv")).toBe("Recipes");
  });

  it("brings a CMS collection in, and says plainly what can't be moved", async () => {
    const csv = await readFile(join(fixturesFolder, "framer", "Recipes.csv"));
    const created = await uploadImport(tools, "framer", {
      files: [{ filename: "Recipes.csv", contents: csv }],
    });
    expect(created.found.notes.join(" ")).toContain("can't be moved");

    const choices = await mappingChoices(tools, created.id);
    // Leave Serves out, and keep the rest as suggested.
    const recipes = choices.suggested.contentTypes.recipes;
    await tools.api("PUT", `/site-imports/${created.id}/mapping`, {
      ...choices.suggested,
      contentTypes: {
        recipes: { ...recipes, name: "Recipes", fields: { ...recipes?.fields, Serves: null } },
      },
    });
    const finished = await runImport(tools, created.id);
    expect(finished.report.problems).toEqual([]);
    expect(finished.report.notes.length).toBeGreaterThan(0);

    const entries = await entriesIn(tools, "recipes");
    expect(entries.map((entry) => entry.slug).sort()).toEqual(["bean-stew", "nettle-soup"]);
    const soup = await entryData(tools, entries.find((entry) => entry.slug === "nettle-soup")?.id);
    expect(soup.data).toMatchObject({
      summary: "A spring soup from the hedgerow.",
      vegetarian: true,
    });
    expect(soup.data.serves).toBeUndefined();
    expect(JSON.stringify(soup.data.method)).toContain("Simmer");
  });
});
