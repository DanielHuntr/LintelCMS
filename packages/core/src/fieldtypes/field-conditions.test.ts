import { describe, expect, it } from "vitest";
import { checkBlueprintFields } from "../blueprints/blueprint-fields.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { buildEntryDataValidator } from "./entry-data-validator.js";
import { type FieldDefinition, fieldDefinitionSchema } from "./field-definition.schema.js";
import type { FieldCheckContext } from "./fieldtype.js";
import { acceptAnyAsset } from "./image-assets.js";

function field(definition: Record<string, unknown> & { handle: string; type: string }) {
  const label = definition.handle.charAt(0).toUpperCase() + definition.handle.slice(1);
  return fieldDefinitionSchema.parse({ label, ...definition });
}

async function check(
  fields: FieldDefinition[],
  data: Record<string, unknown>,
  context: Partial<FieldCheckContext> = {},
) {
  const validate = buildEntryDataValidator(fields, { assetExists: acceptAnyAsset, ...context });
  try {
    return { values: await validate(data), messages: {} };
  } catch (error) {
    if (error instanceof InvalidFieldsError) return { values: undefined, messages: error.fields };
    throw error;
  }
}

const layout = field({
  handle: "layout",
  type: "select",
  options: {
    choices: [
      { value: "video", label: "Video" },
      { value: "image", label: "Image" },
    ],
  },
});
const videoUrl = field({
  handle: "video_url",
  type: "video",
  required: true,
  conditions: { rules: [{ field: "layout", operator: "is", value: "video" }] },
});

describe("conditions when an entry is saved", () => {
  it("checks a field that is shown, including whether it is required", async () => {
    const result = await check([layout, videoUrl], { layout: "video" });
    expect(result.messages).toEqual({ video_url: "Video_url is required" });
  });

  it("skips a hidden field and clears its value", async () => {
    const result = await check([layout, videoUrl], {
      layout: "image",
      video_url: "not an address",
    });
    expect(result.values).toEqual({ layout: "image", video_url: null });
  });

  it("keeps a hidden field's value when it is set to, if the value still fits", async () => {
    const keeping = field({
      handle: "caption",
      type: "text",
      conditions: {
        action: "hide",
        rules: [{ field: "layout", operator: "is", value: "image" }],
        keepHiddenValues: true,
      },
    });
    const result = await check([layout, keeping], { layout: "image", caption: "Kept" });
    expect(result.values).toEqual({ layout: "image", caption: "Kept" });
  });

  it("lets fields in a repeater row look at the row and at the entry", async () => {
    const speakers = field({
      handle: "speakers",
      type: "repeater",
      options: {
        fields: [
          { handle: "kind", label: "Kind", type: "text" },
          {
            handle: "bio",
            label: "Bio",
            type: "text",
            required: true,
            conditions: {
              match: "all",
              rules: [
                { field: "kind", operator: "is", value: "guest" },
                { field: "$root.layout", operator: "is", value: "video" },
              ],
            },
          },
        ],
      },
    });
    const result = await check([layout, speakers], {
      layout: "video",
      speakers: [
        { id: "r1", data: { kind: "guest" } },
        { id: "r2", data: { kind: "host", bio: "dropped" } },
      ],
    });
    expect(result.messages).toEqual({
      speakers: "Speakers (row 1): Bio is required",
      "speakers.r1.bio": "Bio is required",
    });
  });

  it("checks groups like a blueprint's own fields", async () => {
    const address = field({
      handle: "address",
      type: "group",
      options: {
        fields: [
          { handle: "country", label: "Country", type: "text" },
          {
            handle: "postcode",
            label: "Postcode",
            type: "text",
            conditions: { rules: [{ field: "country", operator: "is", value: "UK" }] },
          },
        ],
      },
    });
    const result = await check([address], { address: { country: "France", postcode: "75001" } });
    expect(result.values).toEqual({ address: { country: "France", postcode: null } });
  });

  it("stores nothing for fields that only arrange the editor", async () => {
    const section = field({ handle: "about", type: "section" });
    const result = await check([section, layout], { about: "ignored", layout: "video" });
    expect(result.values).toEqual({ layout: "video" });
  });
});

describe("validation rules", () => {
  const code = field({
    handle: "code",
    type: "text",
    validation: { minLength: 3, pattern: "^[A-Z]+$" },
  });

  it("checks length and pattern on top of the fieldtype", async () => {
    expect((await check([code], { code: "AB" })).messages).toEqual({
      code: "Code needs at least 3 characters",
    });
    expect((await check([code], { code: "abc" })).messages).toEqual({
      code: "Code isn't in the expected format",
    });
    expect((await check([code], { code: "ABC" })).values).toEqual({ code: "ABC" });
  });

  it("shows the field's own message instead of Lintel's", async () => {
    const custom = field({
      handle: "code",
      type: "text",
      validation: { pattern: "^[A-Z]+$", message: "Use capital letters only" },
    });
    expect((await check([custom], { code: "abc" })).messages).toEqual({
      code: "Use capital letters only",
    });
  });

  it("asks whether a unique value is free", async () => {
    const sku = field({ handle: "sku", type: "text", validation: { unique: true } });
    const isValueUnique = async (_handle: string, value: unknown) => value !== "TAKEN";
    expect((await check([sku], { sku: "TAKEN" }, { isValueUnique })).messages).toEqual({
      sku: "Another entry already has this sku",
    });
    expect((await check([sku], { sku: "FREE" }, { isValueUnique })).values).toEqual({
      sku: "FREE",
    });
  });
});

describe("field settings in a blueprint", () => {
  const title = { handle: "title", label: "Title", type: "text" };

  it("leaves out settings that are the default", () => {
    const [, saved] = checkBlueprintFields([
      title,
      { handle: "summary", label: "Summary", type: "text", width: 100, readOnly: false },
    ]);
    expect(saved).toEqual({
      handle: "summary",
      label: "Summary",
      type: "text",
      required: false,
      helpText: "",
      options: {},
    });
  });

  it("keeps widths and other chosen settings", () => {
    const [, saved] = checkBlueprintFields([
      title,
      { handle: "summary", label: "Summary", type: "text", width: 50, showInList: true },
    ]);
    expect(saved).toMatchObject({ width: 50, showInList: true });
  });

  it("refuses conditions on a field that isn't there, or a default that doesn't fit", () => {
    const problems = (fields: unknown[]) => {
      try {
        checkBlueprintFields([title, ...fields]);
        return {};
      } catch (error) {
        return (error as InvalidFieldsError).fields;
      }
    };
    expect(
      problems([
        {
          handle: "url",
          label: "Address",
          type: "url",
          conditions: { rules: [{ field: "layout", operator: "isEmpty" }] },
        },
      ]),
    ).toEqual({
      url: 'Address has a condition on "layout", but there\'s no field with that handle',
    });
    expect(
      problems([{ handle: "count", label: "Count", type: "number", default: "many" }]),
    ).toEqual({ count: "The default for Count isn't right: Count should be a number" });
    expect(problems([{ handle: "half", label: "Half", type: "text", width: 40 }])).toEqual({
      half: "The width should be one of: 25, 33, 50, 66, 75, 100",
    });
  });
});
