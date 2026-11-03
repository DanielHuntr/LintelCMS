import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateModelTypes } from "../content-model-sync/generate-types.js";
import { diffModel, pullModel, pushModel } from "../content-model-sync/model-commands.js";
import { readModelFolder } from "../content-model-sync/model-files.js";
import { useTestDatabase } from "../testing/test-database.js";
import { findBlock, findBlockUses } from "./blocks.service.js";

/**
 * Blocks in code: files in `content-model/blocks/`, synced like the rest of the content
 * model, read-only in the admin, and usable in content types' blocks fields.
 */

const quoteFile = `import { defineBlock, image, text, toggle } from "@lintel/core/content-model";

export default defineBlock({
  name: "Quote",
  icon: "message-square-quote",
  category: "Marketing",
  properties: {
    words: text({ required: true, helpText: "What they said" }),
    who: text(),
    photo: image(),
    show_photo: toggle({ default: true }),
  },
  render:
    '<figure class="quote">{{#show_photo}}<img src="{{photo}}" alt="{{photo.alt}}">{{/show_photo}}<blockquote>{{words}}</blockquote><figcaption>{{who}}</figcaption></figure>',
});
`;

const landingFile = `import { blocks, defineContentType, text } from "@lintel/core/content-model";

export default defineContentType({
  handle: "landing",
  name: "Landing page",
  collection: { handle: "landings", name: "Landing pages", structure: "flat" },
  fields: {
    title: text(),
    sections: blocks({ blockTypes: { quote: { block: "quote" } } }),
  },
});
`;

describe("blocks in code", { timeout: 30_000 }, () => {
  const testDatabase = useTestDatabase();
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-blocks-"));
    await mkdir(join(folder, "blocks"), { recursive: true });
    await mkdir(join(folder, "content-types"), { recursive: true });
    await writeFile(join(folder, "blocks", "quote.block.ts"), quoteFile);
    await writeFile(join(folder, "content-types", "landing.ts"), landingFile);
  });

  afterEach(() => rm(folder, { recursive: true, force: true }));

  it("reads a block file, named by its file, and gives blocks fields its properties", async () => {
    const { model } = await readModelFolder(folder);
    const block = model.get("block:quote");
    expect(block).toMatchObject({ kind: "block", name: "Quote", category: "Marketing" });
    expect(block?.kind === "block" && block.properties.map((property) => property.handle)).toEqual([
      "words",
      "who",
      "photo",
      "show_photo",
    ]);
    const landing = model.get("contentType:landing");
    const blockType =
      landing?.kind === "contentType" && (landing.fields[1]?.options.blockTypes as unknown[])[0];
    expect(blockType).toMatchObject({ handle: "quote", name: "Quote", block: "quote" });
  });

  it("refuses a template that names a property the block doesn't have", async () => {
    await writeFile(
      join(folder, "blocks", "quote.block.ts"),
      quoteFile.replace("{{who}}", "{{author}}"),
    );
    await expect(readModelFolder(folder)).rejects.toThrow(
      /blocks\/quote\.block\.ts: The template uses \{\{author\}\}/,
    );
  });

  it("goes to the database and back unchanged, read-only in the admin", async () => {
    expect(
      (await diffModel(testDatabase.database, folder)).changes.map((change) => change.summary),
    ).toContain("Add the block Quote");
    await pushModel(testDatabase.database, folder);
    const stored = await findBlock(testDatabase.database, "quote");
    expect(stored).toMatchObject({ source: "code", editable: false, usedIn: ["Landing page"] });
    expect(stored.template).toContain("{{words}}");
    expect((await diffModel(testDatabase.database, folder)).changes).toEqual([]);

    // Pulling writes the database's block back over a file that says something else.
    await writeFile(
      join(folder, "blocks", "quote.block.ts"),
      quoteFile.replace("Marketing", "Old"),
    );
    const pulled = await pullModel(testDatabase.database, folder, "typescript");
    expect(pulled.written).toContain(join(folder, "blocks", "quote.block.ts"));
    const written = await readFile(join(folder, "blocks", "quote.block.ts"), "utf8");
    expect(written).toContain("defineBlock({");
    expect(written).toContain('words: text({ required: true, helpText: "What they said" })');
    expect((await diffModel(testDatabase.database, folder)).changes).toEqual([]);
  });

  it("describes changes to a block, and holds back removing one pages use", async () => {
    await pushModel(testDatabase.database, folder);
    await writeFile(
      join(folder, "blocks", "quote.block.ts"),
      quoteFile.replace('category: "Marketing"', 'category: "Stories"'),
    );
    const { changes } = await diffModel(testDatabase.database, folder);
    expect(changes.map((change) => change.summary)).toEqual([
      "Change the group of the block Quote",
    ]);
    expect(changes[0]?.destructive).toBe(false);
    expect((await findBlockUses(testDatabase.database, "quote")).pages).toEqual([]);
  });

  it("generates the properties a React component is given", async () => {
    const { model } = await readModelFolder(folder);
    const types = generateModelTypes(model);
    expect(types).toContain("export interface QuoteBlockProperties {");
    expect(types).toContain("photo: BlockPicture | null;");
    expect(types).toContain("export interface BlockPicture {");
  });
});
