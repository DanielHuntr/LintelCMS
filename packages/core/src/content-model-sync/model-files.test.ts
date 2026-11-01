import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fieldtypeNames } from "../fieldtypes/fieldtypes.registry.js";
import { sameUnit, sortedUnits, unitKey } from "./content-model.schema.js";
import { ContentModelProblemsError } from "./content-model-sync.errors.js";
import * as contentModel from "./content-model.js";
import { defaultContentModel } from "./default-content-model.js";
import { modelDefinitionJsonSchema } from "./model-definition.schema.js";
import { modelFromDefinitions } from "./model-from-definitions.js";
import { newUnitPath, readModelFolder, writeUnitFile } from "./model-files.js";
import { printTypeScriptFile } from "./typescript-printer.js";

const { defineContentType, defineTaxonomy, text, textarea, terms, blocks, select } = contentModel;

let folder: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "lintel-model-"));
});

afterEach(() => rm(folder, { recursive: true, force: true }));

describe("defining the content model in code", () => {
  it("has a helper for every fieldtype, named after it", () => {
    for (const type of fieldtypeNames()) {
      expect(contentModel, `a helper for ${type}`).toHaveProperty(type);
    }
  });

  it("turns definitions into the fields the admin would store, with labels from handles", () => {
    const { model } = modelFromDefinitions([
      {
        source: "content-types/event.ts",
        definition: defineContentType({
          handle: "event",
          name: "Event",
          collection: { handle: "events", name: "Events", structure: "dated" },
          fields: {
            title: text(),
            hero_image: contentModel.image({ helpText: "Wide pictures work best" }),
            audience: select({ choices: [{ value: "everyone", label: "Everyone" }] }),
          },
        }),
      },
    ]);

    expect(model.get("contentType:event")).toEqual({
      kind: "contentType",
      handle: "event",
      name: "Event",
      collections: [
        {
          handle: "events",
          name: "Events",
          structure: "dated",
          routePattern: "/events/{slug}",
          allowedAtRoot: true,
          allowedChildren: [],
          childrenAsCollection: false,
          listColumns: [],
        },
      ],
      fields: [
        {
          handle: "title",
          label: "Title",
          type: "text",
          required: true,
          helpText: "",
          options: {},
        },
        {
          handle: "hero_image",
          label: "Hero image",
          type: "image",
          required: false,
          helpText: "Wide pictures work best",
          options: {},
        },
        {
          handle: "audience",
          label: "Audience",
          type: "select",
          required: false,
          helpText: "",
          options: { choices: [{ value: "everyone", label: "Everyone" }], multiple: false },
        },
      ],
    });
  });

  it("reports every problem at once, each with its file", () => {
    const attempt = () =>
      modelFromDefinitions([
        {
          source: "content-types/bad.ts",
          definition: defineContentType({
            handle: "Bad Handle",
            name: "Bad",
            fields: { title: text() },
          }),
        },
        {
          source: "content-types/post.ts",
          definition: defineContentType({
            handle: "post",
            name: "Post",
            fields: { excerpt: textarea() },
          }),
        },
        {
          source: "content-types/note.ts",
          definition: defineContentType({
            handle: "note",
            name: "Note",
            fields: { title: text(), tags: terms({ taxonomy: "tags" }) },
          }),
        },
        {
          source: "taxonomies/oops.yaml",
          definition: { kind: "taxonomy", handle: "oops", name: "Oops", colour: "red" },
        },
      ]);

    expect(attempt).toThrow(ContentModelProblemsError);
    try {
      attempt();
    } catch (error) {
      const problems = (error as ContentModelProblemsError).problems.join("\n");
      expect(problems).toMatch(/content-types\/bad\.ts: handle: Handles use lowercase letters/);
      expect(problems).toMatch(
        /content-types\/post\.ts: field "title": Every content type needs a Title field/,
      );
      expect(problems).toMatch(/taxonomies\/oops\.yaml: .*colour/);
      expect(problems).toMatch(
        /content-types\/note\.ts: field "tags" chooses terms from "tags", but no file defines that taxonomy/,
      );
    }
  });

  it("writes JSON Schema for YAML files, with every fieldtype", () => {
    const schema = JSON.stringify(modelDefinitionJsonSchema());
    for (const type of fieldtypeNames()) {
      expect(schema).toContain(`"const":"${type}"`);
    }
  });
});

describe("content model files", () => {
  it("writes each unit as a file and reads back exactly the same model, in both formats", async () => {
    const model = defaultContentModel();
    for (const [index, unit] of sortedUnits(model).entries()) {
      await writeUnitFile(
        folder,
        newUnitPath(folder, unit, index % 2 === 0 ? "typescript" : "yaml"),
        unit,
      );
    }

    const read = await readModelFolder(folder);

    expect(read.model.size).toBe(model.size);
    for (const unit of model.values()) {
      expect(sameUnit(unit, read.model.get(unitKey(unit))), unitKey(unit)).toBe(true);
    }
    expect(await readFile(join(folder, "lintel.schema.json"), "utf8")).toContain(
      "Lintel content model file",
    );
  });

  it("writes short, readable TypeScript that leaves out defaults", () => {
    const post = defaultContentModel().get("contentType:post");
    if (!post) throw new Error("The default model has no posts.");

    expect(printTypeScriptFile(post)).toBe(`import {
  defineContentType,
  image,
  richText,
  terms,
  text,
  textarea,
} from "@lintel/core/content-model";

export default defineContentType({
  handle: "post",
  name: "Blog post",
  collection: { handle: "posts", name: "Blog posts", structure: "dated", route: "/blog/{slug}" },
  fields: {
    title: text(),
    excerpt: textarea({ helpText: "Shown in lists of posts and in link previews" }),
    featured_image: image(),
    body: richText(),
    categories: terms({ taxonomy: "categories", maxItems: 3 }),
    tags: terms({ taxonomy: "tags" }),
  },
});
`);
  });

  it("keeps the comments at the top of a file and doesn't touch a file that already matches", async () => {
    const tags = { kind: "taxonomy" as const, handle: "tags", name: "Tags" };
    const path = join(folder, "taxonomies", "tags.ts");
    await mkdir(join(folder, "taxonomies"), { recursive: true });
    await writeFile(
      path,
      `// Tags are free-form; categories are curated.\n${printTypeScriptFile({ ...tags, name: "Old" })}`,
    );

    expect(await writeUnitFile(folder, path, tags)).toBe(true);
    expect(await readFile(path, "utf8")).toBe(
      `// Tags are free-form; categories are curated.\n${printTypeScriptFile(tags)}`,
    );
    expect(await writeUnitFile(folder, path, tags)).toBe(false);
  });

  it("reads files that share fields through a helper file of their own", async () => {
    await mkdir(join(folder, "shared"), { recursive: true });
    await writeFile(
      join(folder, "shared", "seo.ts"),
      `import { textarea } from "@lintel/core/content-model";\nexport const seoFields = { meta_description: textarea({ maxLength: 160 }) };\n`,
    );
    await writeFile(
      join(folder, "article.ts"),
      `import { defineContentType, text } from "@lintel/core/content-model";\nimport { seoFields } from "./shared/seo";\n` +
        `export default defineContentType({ handle: "article", name: "Article", fields: { title: text(), ...seoFields } });\n`,
    );

    const { model } = await readModelFolder(folder);

    const article = model.get("contentType:article");
    expect(article?.kind === "contentType" && article.fields.map((field) => field.handle)).toEqual([
      "title",
      "meta_description",
    ]);
  });

  it("says which file can't be read", async () => {
    await writeFile(join(folder, "broken.ts"), "export default defineContentType({");

    await expect(readModelFolder(folder)).rejects.toThrow(/broken\.ts can't be read/);
  });

  it("reads blocks fields from YAML", async () => {
    await writeFile(
      join(folder, "landing.yaml"),
      [
        "kind: contentType",
        "handle: landing",
        "name: Landing page",
        "fields:",
        "  title: { type: text }",
        "  sections:",
        "    type: blocks",
        "    blockTypes:",
        "      quote:",
        "        fields:",
        "          text: { type: textarea, required: true }",
      ].join("\n"),
    );

    const { model } = await readModelFolder(folder);

    const landing = model.get("contentType:landing");
    const sections = landing?.kind === "contentType" ? landing.fields[1] : undefined;
    expect(sections?.options.blockTypes).toEqual([
      expect.objectContaining({
        handle: "quote",
        name: "Quote",
        fields: [expect.objectContaining({ handle: "text", required: true })],
      }),
    ]);
  });

  it("lets helpers be used together with the define functions", () => {
    const definition = defineTaxonomy({ handle: "topics", name: "Topics" });
    const sections = blocks({ blockTypes: { hero: { fields: { heading: text() } } } });

    expect(definition).toEqual({ kind: "taxonomy", handle: "topics", name: "Topics" });
    expect(sections.type).toBe("blocks");
  });
});
