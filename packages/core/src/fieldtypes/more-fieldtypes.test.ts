import { describe, expect, it } from "vitest";
import { InvalidFieldsError } from "../http/http-errors.js";
import type { ContentReferences } from "./content-references.js";
import { buildEntryDataValidator } from "./entry-data-validator.js";
import { type FieldDefinition, fieldDefinitionSchema } from "./field-definition.schema.js";
import { acceptAnyAsset } from "./image-assets.js";
import { renderMarkdownHtml } from "./markdown.js";

const NEWS = "11111111-1111-4111-8111-111111111111";
const GUIDES = "22222222-2222-4222-8222-222222222222";
const DELETED = "33333333-3333-4333-8333-333333333333";

function field(definition: Partial<FieldDefinition> & Pick<FieldDefinition, "handle" | "type">) {
  const label = definition.handle.charAt(0).toUpperCase() + definition.handle.slice(1);
  return fieldDefinitionSchema.parse({ label, ...definition });
}

/** Terms NEWS and GUIDES are in "categories"; entry NEWS is in "posts". Nothing else exists. */
const knownReferences: ContentReferences = {
  findMissingTermIds: async (taxonomy, ids) =>
    ids.filter((id) => taxonomy !== "categories" || ![NEWS, GUIDES].includes(id)),
  findMissingEntryIds: async (collections, ids) =>
    ids.filter((id) => id !== NEWS || (collections.length > 0 && !collections.includes("posts"))),
  findMissingUserIds: async () => [],
};

async function check(fields: FieldDefinition[], data: Record<string, unknown>) {
  const validate = buildEntryDataValidator(fields, {
    assetExists: acceptAnyAsset,
    references: knownReferences,
  });
  try {
    return { values: await validate(data), messages: {} };
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return { values: undefined, messages: error.fields };
    }
    throw error;
  }
}

describe("the email, web address and colour fieldtypes", () => {
  const fields = [
    field({ handle: "email", type: "email" }),
    field({ handle: "website", type: "url" }),
    field({ handle: "brand", type: "colour", options: { swatches: ["#FF0000"] } }),
  ];

  it("keeps tidy values, with colours in lowercase", async () => {
    expect(
      await check(fields, {
        email: " hello@example.com ",
        website: "https://example.com/book",
        brand: "#1A2B3C",
      }),
    ).toEqual({
      values: { email: "hello@example.com", website: "https://example.com/book", brand: "#1a2b3c" },
      messages: {},
    });
  });

  it("explains what each one should look like", async () => {
    expect(
      (await check(fields, { email: "hello@", website: "javascript:alert(1)", brand: "red" }))
        .messages,
    ).toEqual({
      email: "Email should be an email address, like name@example.com",
      website: "Website should be a web address starting with https:// or http://",
      brand: "Brand should be a colour like #1a2b3c",
    });
  });

  it("checks suggested colours when the field is set up", () => {
    expect(fieldDefinitionSchema.parse(fields[2]).options).toEqual({ swatches: ["#ff0000"] });
    expect(
      fieldDefinitionSchema.safeParse({
        handle: "brand",
        label: "Brand",
        type: "colour",
        options: { swatches: ["blue"] },
      }).error?.issues[0]?.message,
    ).toBe("Each colour should look like #1a2b3c");
  });
});

describe("the markdown fieldtype", () => {
  it("keeps the text as typed, up to its limit", async () => {
    const fields = [field({ handle: "notes", type: "markdown", options: { maxLength: 10 } })];

    expect((await check(fields, { notes: "**Hi**" })).values).toEqual({ notes: "**Hi**" });
    expect((await check(fields, { notes: "far too long for this" })).messages).toEqual({
      notes: "Notes can be at most 10 characters",
    });
  });

  it("renders HTML that is safe to print", () => {
    expect(renderMarkdownHtml("Hello **there**")).toBe("<p>Hello <strong>there</strong></p>\n");
    expect(renderMarkdownHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n",
    );
    expect(renderMarkdownHtml("[click](javascript:alert(1))")).not.toContain("href");
  });
});

describe("the list fieldtype", () => {
  const fields = [field({ handle: "hours", type: "list", options: { maxItems: 2 } })];

  it("leaves out blank items, and treats a list of blanks as empty", async () => {
    expect((await check(fields, { hours: [" Mon 9-5 ", "", "  "] })).values).toEqual({
      hours: ["Mon 9-5"],
    });
    expect((await check(fields, { hours: ["", " "] })).values).toEqual({ hours: null });
  });

  it("respects the most items allowed", async () => {
    expect((await check(fields, { hours: ["a", "b", "c"] })).messages).toEqual({
      hours: "Hours can have at most 2 items",
    });
    expect((await check(fields, { hours: "Mon" })).messages).toEqual({
      hours: "Hours should be a list",
    });
  });
});

describe("the terms and entries fieldtypes", () => {
  const fields = [
    field({ handle: "categories", type: "terms", options: { taxonomy: "categories" } }),
    field({ handle: "topic", type: "terms", options: { taxonomy: "categories", maxItems: 1 } }),
    field({ handle: "related", type: "entries", options: { collections: ["posts"] } }),
  ];

  it("stores lists of ids that still exist", async () => {
    expect(
      (await check(fields, { categories: [GUIDES, NEWS], topic: [NEWS], related: [NEWS] })).values,
    ).toEqual({ categories: [GUIDES, NEWS], topic: [NEWS], related: [NEWS] });
  });

  it("refuses ids that are gone, repeated, or more than allowed", async () => {
    expect(
      (
        await check(fields, {
          categories: [NEWS, NEWS],
          topic: [NEWS, GUIDES],
          related: [DELETED],
        })
      ).messages,
    ).toEqual({
      categories: "Categories lists the same one twice",
      topic: "Topic can have only 1",
      related: "Some of the entries chosen for Related no longer exist, or can't be chosen here",
    });
    expect((await check(fields, { categories: [DELETED] })).messages).toEqual({
      categories: "Some of the terms chosen for Categories no longer exist",
    });
  });

  it("needs a taxonomy to choose from", () => {
    const parsed = fieldDefinitionSchema.safeParse({
      handle: "tags",
      label: "Tags",
      type: "terms",
      options: {},
    });
    expect(parsed.error?.issues[0]?.message).toBe("Choose which taxonomy the terms come from");
  });
});
