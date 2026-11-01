import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { deliverValues } from "../delivery/delivered-values.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildEntryDataValidator } from "./entry-data-validator.js";
import { type FieldDefinition, fieldDefinitionSchema } from "./field-definition.schema.js";
import { acceptAnyAsset, type DeliveredAsset } from "./image-assets.js";

const IMAGE_ID = "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f";
const HERO_ID = "0b6c9c4e-7d8f-4a43-9a52-1f3f35a2c001";
const TEXT_ID = "0b6c9c4e-7d8f-4a43-9a52-1f3f35a2c002";

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** A blocks field the way the blueprint builder sends one: inner fields without defaults. */
const sectionsField: FieldDefinition = fieldDefinitionSchema.parse({
  handle: "sections",
  label: "Sections",
  type: "blocks",
  options: {
    blockTypes: [
      {
        handle: "hero",
        name: "Hero",
        fields: [
          { handle: "heading", label: "Heading", type: "text", required: true },
          { handle: "image", label: "Image", type: "image" },
        ],
      },
      {
        handle: "text",
        name: "Text",
        fields: [{ handle: "body", label: "Text", type: "richText", required: true }],
      },
    ],
  },
});

async function check(data: Record<string, unknown>, fields = [sectionsField]) {
  return buildEntryDataValidator(fields, { assetExists: acceptAnyAsset })(data);
}

async function messagesFor(data: Record<string, unknown>): Promise<Record<string, string>> {
  try {
    await check(data);
    return {};
  } catch (error) {
    if (error instanceof InvalidFieldsError) return error.fields;
    throw error;
  }
}

describe("the blocks fieldtype", () => {
  it("fills in each block type's fields with the same defaults as blueprint fields", () => {
    const [hero] = (sectionsField.options as { blockTypes: { fields: FieldDefinition[] }[] })
      .blockTypes;

    expect(hero?.fields[1]).toEqual({
      handle: "image",
      label: "Image",
      type: "image",
      required: false,
      helpText: "",
      options: {},
    });
  });

  it("refuses block types without fields that make sense, and blocks inside blocks", () => {
    const problem = (options: unknown) => {
      const parsed = fieldDefinitionSchema.safeParse({
        handle: "sections",
        label: "Sections",
        type: "blocks",
        options,
      });
      return parsed.success ? null : parsed.error.issues[0]?.message;
    };

    expect(problem({ blockTypes: [] })).toBe("A blocks field needs at least one block type");
    expect(
      problem({
        blockTypes: [
          { handle: "hero", name: "Hero", fields: [] },
          { handle: "hero", name: "Banner", fields: [] },
        ],
      }),
    ).toBe("Each block type needs a different handle");
    expect(
      problem({
        blockTypes: [{ handle: "hero", name: "Hero", fields: [{ handle: "x", type: "text" }] }],
      }),
    ).toBe("Hero, field 1: Each field needs a label");
    expect(
      problem({
        blockTypes: [
          {
            handle: "row",
            name: "Row",
            fields: [
              {
                handle: "inner",
                label: "Inner",
                type: "blocks",
                options: { blockTypes: [{ handle: "cell", name: "Cell" }] },
              },
            ],
          },
        ],
      }),
    ).toBe("Row can't have a Blocks field inside it");
  });

  it("keeps blocks in order and checks each one against its block type", async () => {
    const values = await check({
      sections: [
        { id: TEXT_ID, type: "text", data: { body: paragraph("Hello"), stray: "dropped" } },
        { id: HERO_ID, type: "hero", data: { heading: "Welcome", image: "" } },
      ],
    });

    expect(values.sections).toEqual([
      { id: TEXT_ID, type: "text", data: { body: paragraph("Hello") } },
      { id: HERO_ID, type: "hero", data: { heading: "Welcome", image: null } },
    ]);
  });

  it("says which block and which field need attention, keyed by the block's id", async () => {
    const messages = await messagesFor({
      sections: [
        { id: HERO_ID, type: "hero", data: { heading: "" } },
        { id: TEXT_ID, type: "text", data: {} },
      ],
    });

    expect(messages).toEqual({
      sections: "Hero (block 1): Heading is required, and 1 more in Sections",
      [`sections.${HERO_ID}.heading`]: "Heading is required",
      [`sections.${TEXT_ID}.body`]: "Text is required",
    });
  });

  it("drops blocks whose type was removed, and refuses lists that aren't blocks", async () => {
    const values = await check({
      sections: [{ id: HERO_ID, type: "gallery", data: { photos: [] } }],
    });
    expect(values.sections).toEqual([]);

    expect(await messagesFor({ sections: "hello" })).toEqual({
      sections: "Sections should be a list of blocks",
    });
    expect(
      await messagesFor({
        sections: [
          { id: HERO_ID, type: "hero", data: { heading: "One" } },
          { id: HERO_ID, type: "hero", data: { heading: "Two" } },
        ],
      }),
    ).toEqual({ sections: "Two blocks in Sections have the same id" });
  });

  it("delivers blocks as an ordered array, expanding images and rich text inside them", () => {
    const image: DeliveredAsset = {
      id: IMAGE_ID,
      url: "https://cdn.example.com/hero.jpg",
      alt: "The shop front",
      width: 1200,
      height: 800,
      focalPoint: null,
    };
    const delivered = deliverValues(
      [sectionsField],
      {
        sections: [
          { id: HERO_ID, type: "hero", data: { heading: "Welcome", image: IMAGE_ID } },
          { id: TEXT_ID, type: "text", data: { body: paragraph("Hi") } },
          { id: "gone", type: "removed_type", data: {} },
        ],
      },
      new Map([[IMAGE_ID, image]]),
    );

    expect(delivered.sections).toEqual([
      { id: HERO_ID, type: "hero", data: { heading: "Welcome", image } },
      {
        id: TEXT_ID,
        type: "text",
        data: { body: { json: paragraph("Hi"), html: "<p>Hi</p>" } },
      },
    ]);
  });
});

describe("page sections on the default Pages collection", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  it("offers Hero, Text, Image, Call to action and FAQ blocks", async () => {
    const blueprint = (await api("GET", "/blueprints/page")).json();
    const sections = blueprint.fields.find(
      (field: { handle: string }) => field.handle === "sections",
    );

    expect(sections.type).toBe("blocks");
    expect(sections.options.blockTypes.map((type: { name: string }) => type.name)).toEqual([
      "Hero",
      "Text",
      "Image",
      "Call to action",
      "FAQ",
    ]);
  });

  it("keeps pages without sections working, and saves and publishes pages with them", async () => {
    const plain = await api("POST", "/collections/pages/entries", {
      data: { title: "About", body: paragraph("Who we are") },
    });
    expect(plain.statusCode).toBe(201);
    expect(plain.json().data.sections).toBeNull();

    const built = await api("POST", "/collections/pages/entries", {
      data: {
        title: "Home",
        sections: [
          { id: HERO_ID, type: "hero", data: { heading: "Fresh bread daily" } },
          {
            id: TEXT_ID,
            type: "call_to_action",
            data: { heading: "Visit us", button: { url: "/contact", label: "Find us" } },
          },
        ],
      },
    });
    expect(built.statusCode).toBe(201);
    await api("POST", `/entries/${built.json().id}/publish`);

    const delivered = await server.inject({ method: "GET", url: "/delivery/pages/home" });
    expect(delivered.json().data.sections).toEqual([
      {
        id: HERO_ID,
        type: "hero",
        data: { heading: "Fresh bread daily", subheading: null, image: null, button: null },
      },
      {
        id: TEXT_ID,
        type: "call_to_action",
        data: { heading: "Visit us", text: null, button: { url: "/contact", label: "Find us" } },
      },
    ]);
  });

  it("answers a save with a message per block field", async () => {
    const response = await api("POST", "/collections/pages/entries", {
      data: { title: "Home", sections: [{ id: HERO_ID, type: "faq", data: { question: "Why?" } }] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({
      sections: "FAQ (block 1): Answer is required",
      [`sections.${HERO_ID}.answer`]: "Answer is required",
    });
  });
});
