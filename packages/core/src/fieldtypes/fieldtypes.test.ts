import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidFieldsError } from "../http/http-errors.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildEntryDataValidator } from "./entry-data-validator.js";
import { type FieldDefinition, fieldDefinitionSchema } from "./field-definition.schema.js";
import { acceptAnyAsset } from "./image-assets.js";
import { renderRichTextHtml } from "./rich-text.js";

const IMAGE_ID = "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f";

function field(definition: Partial<FieldDefinition> & Pick<FieldDefinition, "handle" | "type">) {
  return fieldDefinitionSchema.parse({ label: labelFor(definition.handle), ...definition });
}

function labelFor(handle: string): string {
  const words = handle.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The per-field messages for these values, or {} when they are all fine. */
async function messagesFor(
  fields: FieldDefinition[],
  data: Record<string, unknown>,
  assetExists = acceptAnyAsset,
): Promise<Record<string, string>> {
  try {
    await buildEntryDataValidator(fields, { assetExists })(data);
    return {};
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return error.fields;
    }
    throw error;
  }
}

describe("checking an entry's values against its blueprint", () => {
  it("stores the blueprint's fields only, with empty optional fields as null", async () => {
    const fields = [
      field({ handle: "title", type: "text", required: true }),
      field({ handle: "summary", type: "textarea" }),
    ];

    const values = await buildEntryDataValidator(fields, { assetExists: acceptAnyAsset })({
      title: "Hello",
      summary: "  ",
      leftover: "from a removed field",
    });

    expect(values).toEqual({ title: "Hello", summary: null });
  });

  it("says which required fields are missing, whatever their type", async () => {
    const fields = [
      field({ handle: "title", type: "text", required: true }),
      field({
        handle: "tags",
        type: "select",
        required: true,
        options: { choices: [{ value: "a", label: "A" }], multiple: true },
      }),
      field({ handle: "body", type: "richText", required: true }),
      field({ handle: "cta", type: "link", required: true }),
    ];

    expect(
      await messagesFor(fields, {
        title: " ",
        tags: [],
        body: { type: "doc", content: [{ type: "paragraph" }] },
        cta: { url: "" },
      }),
    ).toEqual({
      title: "Title is required",
      tags: "Tags is required",
      body: "Body is required",
      cta: "Cta is required",
    });
  });

  it("checks text and text areas, including their maximum length", async () => {
    const fields = [
      field({ handle: "name", type: "text", options: { maxLength: 5 } }),
      field({ handle: "about", type: "textarea" }),
    ];

    expect(await messagesFor(fields, { name: "Too long", about: 42 })).toEqual({
      name: "Name can be at most 5 characters",
      about: "About should be text",
    });
    expect(await messagesFor(fields, { name: "Short", about: "Fine" })).toEqual({});
  });

  it("checks numbers against their minimum, maximum and step", async () => {
    const fields = [
      field({ handle: "rating", type: "number", options: { min: 1, max: 5 } }),
      field({ handle: "price", type: "number", options: { step: 0.05 } }),
      field({ handle: "count", type: "number" }),
    ];

    expect(await messagesFor(fields, { rating: 9, price: 1.01, count: "3" })).toEqual({
      rating: "Rating should be at most 5",
      price: "Price should go up in steps of 0.05",
      count: "Count should be a number",
    });
    expect(await messagesFor(fields, { rating: 0 })).toEqual({
      rating: "Rating should be at least 1",
    });
    expect(await messagesFor(fields, { rating: 3, price: 0.3, count: 0 })).toEqual({});
  });

  it("checks toggles, dates and links", async () => {
    const fields = [
      field({ handle: "featured", type: "toggle" }),
      field({ handle: "day", type: "date" }),
      field({ handle: "starts", type: "date", options: { includeTime: true } }),
      field({ handle: "more", type: "link" }),
    ];

    expect(
      await messagesFor(fields, {
        featured: "yes",
        day: "31/10/2026",
        starts: "tomorrow",
        more: { url: "javascript:alert(1)" },
      }),
    ).toEqual({
      featured: "Featured should be on or off",
      day: "Day should be a date like 2026-10-31",
      starts: "Starts should be a date like 2026-10-31, or a date and time like 2026-10-31T09:30",
      more: "More should start with https://, mailto:, tel: or /",
    });
    expect(
      await messagesFor(fields, {
        featured: false,
        day: "2026-10-31",
        starts: "2026-10-31T09:30",
        more: { url: "/about", label: "About us" },
      }),
    ).toEqual({});
  });

  it("checks select values against the choices, one or several", async () => {
    const choices = [
      { value: "news", label: "News" },
      { value: "guides", label: "Guides" },
    ];
    const fields = [
      field({ handle: "category", type: "select", options: { choices } }),
      field({ handle: "topics", type: "select", options: { choices, multiple: true } }),
    ];

    expect(await messagesFor(fields, { category: "gossip", topics: "news" })).toEqual({
      category: "Category should be one of: News, Guides",
      topics: "Topics should be a list of choices",
    });
    expect(await messagesFor(fields, { category: "news", topics: ["news", "guides"] })).toEqual({});
  });

  it("checks rich text is a document the editor can open", async () => {
    const fields = [field({ handle: "body", type: "richText" })];

    expect(await messagesFor(fields, { body: "<p>Hi</p>" })).toEqual({
      body: "Body should be a rich text document",
    });
    expect(
      await messagesFor(fields, { body: { type: "doc", content: [{ type: "spaceship" }] } }),
    ).toEqual({
      body: "Body has formatting the editor doesn't recognise",
    });
    expect(
      await messagesFor(fields, {
        body: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
        },
      }),
    ).toEqual({});
  });

  it("checks that an image is a media library id that still exists", async () => {
    const fields = [field({ handle: "hero_image", type: "image" })];
    const onlyKnownImage = async (assetId: string) => assetId === IMAGE_ID;

    expect(await messagesFor(fields, { hero_image: "cat.jpg" })).toEqual({
      hero_image: "Hero image should be an image from the media library",
    });
    expect(
      await messagesFor(
        fields,
        { hero_image: "11111111-2222-4333-8444-555555555555" },
        onlyKnownImage,
      ),
    ).toEqual({ hero_image: "The image chosen for Hero image is no longer in the media library" });
    expect(await messagesFor(fields, { hero_image: IMAGE_ID }, onlyKnownImage)).toEqual({});
  });
});

describe("rich text", () => {
  it("renders to HTML on the server, dropping unsafe link addresses", () => {
    const html = renderRichTextHtml({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hello" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });

    expect(html).toContain("<h2>Hello</h2>");
    expect(html).not.toContain("javascript:");
  });
});

describe("GET /fieldtypes", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
  });

  afterEach(() => server.close());

  it("lists every fieldtype in plain English for the blueprint builder", async () => {
    await createTestUser(testDatabase.database, "builder@example.com", [["blueprints:read"]]);
    const cookies = await signInAndGetCookies(server, "builder@example.com");

    const response = await server.inject({ method: "GET", url: "/fieldtypes", cookies });

    expect(response.statusCode).toBe(200);
    const types = response.json().fieldtypes.map((fieldtype: { type: string }) => fieldtype.type);
    expect(types).toEqual([
      "text",
      "textarea",
      "richText",
      "number",
      "toggle",
      "select",
      "date",
      "image",
      "link",
      "email",
      "url",
      "colour",
      "markdown",
      "list",
      "entries",
      "terms",
      "blocks",
      "form",
    ]);
    expect(response.json().fieldtypes[0]).toEqual({
      type: "text",
      name: "Text",
      description: "A single line of text, such as a title or a name.",
    });
    expect((await server.inject({ method: "GET", url: "/fieldtypes" })).statusCode).toBe(401);
  });
});
