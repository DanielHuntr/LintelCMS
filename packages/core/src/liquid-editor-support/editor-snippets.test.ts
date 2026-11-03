import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modelFromUnits } from "../content-model-sync/content-model.schema.js";
import { fieldSnippetsForModel } from "./field-snippets.js";
import { writeEditorSnippets } from "./liquid-editor-commands.js";
import {
  parseSnippetsText,
  SnippetsFileUnreadableError,
  writeSnippetsFile,
} from "./snippets-file.repository.js";
import { TAG_SNIPPETS } from "./tag-snippets.js";

function field(handle: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    handle,
    label: handle.charAt(0).toUpperCase() + handle.slice(1).replace(/_/g, " "),
    type,
    required: false,
    helpText: "",
    options: {},
    ...extra,
  };
}

const recipe = {
  kind: "contentType" as const,
  handle: "recipe",
  name: "Recipe",
  collections: [],
  fields: [
    field("title", "text", { required: true }),
    field("photo", "image", { required: true }),
    field("method", "richText"),
    field("notes", "markdown"),
    field("baked_on", "date"),
    field("vegan", "toggle"),
    field("cuisines", "terms"),
    field("details", "tab"),
    field("seo", "fieldset", {
      options: { fieldset: "seo", fields: [field("meta_title", "text")] },
    }),
  ],
};

describe("snippets for Lintel's tags and filters", () => {
  it("cover every tag and filter, each with a description and tab stops", () => {
    const bodies = Object.values(TAG_SNIPPETS).map((snippet) => snippet.body.join("\n"));
    for (const part of [
      "{% image",
      "{% menu",
      "{% form",
      "{% design %}",
      "{% lintel_head %}",
      "{% site_header %}",
      "{% site_footer %}",
      "{% cookie_settings %}",
      "| rich_text",
      "| image_url",
    ]) {
      expect(
        bodies.some((body) => body.includes(part)),
        part,
      ).toBe(true);
    }
    for (const [name, snippet] of Object.entries(TAG_SNIPPETS)) {
      expect(snippet.description.length, name).toBeGreaterThan(20);
      expect(snippet.body.join("\n"), name).toContain("$0");
      expect(snippet.scope).toBe("liquid,html");
      expect(name.startsWith("Lintel: ")).toBe(true);
    }
    expect(TAG_SNIPPETS["Lintel: menu"]?.body).toEqual(['{% menu "${1:main}" %}$0']);
  });
});

describe("snippets for the site's own fields", () => {
  const snippets = fieldSnippetsForModel(modelFromUnits([recipe]));

  it("complete entry.data.<field>, with the label and type in the description", () => {
    expect(snippets["Lintel: recipe.photo"]).toEqual({
      scope: "liquid,html",
      prefix: ["entry.data.photo", "recipe.photo"],
      body: ["{% image entry.data.photo width: ${1:800} %}$0"],
      description: "Photo: image field of Recipe (required)",
    });
    expect(snippets["Lintel: recipe.title"]?.body).toEqual(["{{ entry.data.title }}$0"]);
  });

  it("print rich text and Markdown with | rich_text", () => {
    expect(snippets["Lintel: recipe.method"]?.body).toEqual([
      "{{ entry.data.method | rich_text }}$0",
    ]);
    expect(snippets["Lintel: recipe.notes"]?.body).toEqual([
      "{{ entry.data.notes | rich_text }}$0",
    ]);
    expect(snippets["Lintel: recipe.method"]?.description).toBe(
      "Method: rich text field of Recipe",
    );
  });

  it("loop over lists, test toggles and format dates", () => {
    expect(snippets["Lintel: recipe.cuisines"]?.body).toEqual([
      "{% for ${1:item} in entry.data.cuisines %}",
      "\t$0",
      "{% endfor %}",
    ]);
    expect(snippets["Lintel: recipe.vegan"]?.body[0]).toBe("{% if entry.data.vegan %}");
    expect(snippets["Lintel: recipe.baked_on"]?.body[0]).toContain('| date: "${1:%-d %B %Y}"');
  });

  it("open up fieldsets and leave out layout-only fields", () => {
    expect(snippets["Lintel: recipe.seo.meta_title"]?.prefix[0]).toBe("entry.data.seo.meta_title");
    expect(snippets["Lintel: recipe.seo"]).toBeUndefined();
    expect(snippets["Lintel: recipe.details"]).toBeUndefined();
  });

  it("only come from content types", () => {
    const withGlobals = fieldSnippetsForModel(
      modelFromUnits([
        { kind: "globalSet", handle: "site_settings", name: "Site", fields: [field("x", "text")] },
      ]),
    );
    expect(withGlobals).toEqual({});
  });
});

describe("the snippets files", () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-snippets-"));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it("are written to .vscode, and not again when nothing changed", async () => {
    const vscode = join(folder, ".vscode");
    const first = await writeEditorSnippets(vscode, modelFromUnits([recipe]));
    expect(first.written.map((path) => path.slice(vscode.length + 1))).toEqual([
      "lintel-liquid.code-snippets",
      "lintel-fields.code-snippets",
    ]);
    expect(first.fieldCount).toBe(8);
    const again = await writeEditorSnippets(vscode, modelFromUnits([recipe]));
    expect(again.written).toEqual([]);

    const text = await readFile(join(vscode, "lintel-fields.code-snippets"), "utf8");
    expect(text.startsWith("// Snippets for Lintel's Liquid templates")).toBe(true);
    expect(Object.keys(parseSnippetsText(text, "fields"))).toContain("Lintel: recipe.photo");
  });

  it("keep the developer's own snippets, comments and trailing commas and all", async () => {
    const path = join(folder, "lintel-fields.code-snippets");
    await writeFile(
      path,
      [
        "// my snippets",
        "{",
        '  "Lintel: recipe.gone": { "prefix": "old", "body": ["old"] },',
        "  /* a price */",
        '  "Price": { "prefix": "price", "body": ["{{ price | money }}"], },',
        '  "Url": { "prefix": "u", "body": ["http://example.com // not a comment"] },',
        "}",
      ].join("\n"),
    );
    await writeSnippetsFile(path, { "Lintel: recipe.photo": TAG_SNIPPETS["Lintel: image"]! });
    const entries = parseSnippetsText(await readFile(path, "utf8"), path);
    expect(Object.keys(entries)).toEqual(["Lintel: recipe.photo", "Price", "Url"]);
    expect(entries.Price).toEqual({ prefix: "price", body: ["{{ price | money }}"] });
    expect(entries.Url).toEqual({ prefix: "u", body: ["http://example.com // not a comment"] });
  });

  it("leave a file that can't be read as it is", async () => {
    const path = join(folder, "lintel-liquid.code-snippets");
    await writeFile(path, "{ this isn't json");
    await expect(writeSnippetsFile(path, TAG_SNIPPETS)).rejects.toBeInstanceOf(
      SnippetsFileUnreadableError,
    );
    expect(await readFile(path, "utf8")).toBe("{ this isn't json");
  });
});
