import { describe, expect, it } from "vitest";
import { fieldDefinitionSchema } from "./field-definition.schema.js";
import { findFieldtype } from "./fieldtypes.registry.js";
import { describeVideoAddress } from "./video-addresses.js";

/** Whether a value fits a fieldtype with these options; the message when it doesn't. */
function fits(type: string, value: unknown, options: Record<string, unknown> = {}) {
  const fieldtype = findFieldtype(type);
  if (!fieldtype) throw new Error(`No fieldtype ${type}`);
  const parsed = fieldtype
    .buildValueSchema(fieldtype.optionsSchema.parse(options), "It")
    .safeParse(value);
  return parsed.success ? true : parsed.error.issues[0]?.message;
}

const choices = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

describe("the new fieldtypes", () => {
  it("radio, checkboxes and button group take values from their choices", () => {
    expect(fits("radio", "left", { choices })).toBe(true);
    expect(fits("radio", "up", { choices })).toBe("It should be one of: Left, Right");
    expect(fits("checkboxes", ["left", "right"], { choices })).toBe(true);
    expect(fits("checkboxes", ["left", "left"], { choices })).toBe(
      "It lists the same choice twice",
    );
    expect(fits("buttonGroup", "right", { choices })).toBe(true);
  });

  it("a slider stays within its limits and steps", () => {
    expect(fits("range", 50)).toBe(true);
    expect(fits("range", 101)).toBe("It should be at most 100");
    expect(fits("range", 0.5, { step: 0.25, max: 1 })).toBe(true);
    expect(fits("range", 0.3, { step: 0.25, max: 1 })).toBe("It should go up in steps of 0.25");
  });

  it("time, slug, code, icon and hidden values have their own shapes", () => {
    expect(fits("time", "09:30")).toBe(true);
    expect(fits("time", "25:00")).toBe("It should be a time like 09:30");
    expect(fits("slug", "summer-fair")).toBe(true);
    expect(fits("slug", "Summer Fair")).toContain("lowercase letters");
    expect(fits("code", "<b>hi</b>", { language: "html" })).toBe(true);
    expect(fits("icon", "map-pin")).toBe(true);
    expect(fits("icon", "Map Pin")).toContain("name of an icon");
    expect(fits("hidden", 3)).toBe(true);
  });

  it("a table is rows of cells, all the same length", () => {
    expect(
      fits("table", [
        ["Day", "Opens"],
        ["Monday", "9am"],
      ]),
    ).toBe(true);
    expect(fits("table", [["Day", "Opens"], ["Monday"]])).toBe(
      "Every row in It should have the same number of cells",
    );
    expect(fits("table", [["a"], ["b"], ["c"]], { maxRows: 2 })).toBe("It can have at most 2 rows");
    expect(findFieldtype("table")?.isEmpty([["", " "]])).toBe(true);
  });

  it("a video is a YouTube, Vimeo or video file address", () => {
    expect(fits("video", "https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(fits("video", "https://example.com/page")).toContain("YouTube or Vimeo");
    expect(describeVideoAddress("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
    expect(describeVideoAddress("https://vimeo.com/76979871")?.embedUrl).toBe(
      "https://player.vimeo.com/video/76979871",
    );
    expect(describeVideoAddress("https://cdn.example.com/clip.mp4")?.provider).toBe("file");
    expect(describeVideoAddress("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
  });

  it("groups and repeaters need fields, and can't hold a page builder", () => {
    const parse = (definition: unknown) => fieldDefinitionSchema.safeParse(definition);
    expect(
      parse({ handle: "g", label: "G", type: "group", options: { fields: [] } }).error?.issues[0]
        ?.message,
    ).toBe("A group needs at least one field");
    expect(
      parse({
        handle: "r",
        label: "R",
        type: "repeater",
        options: {
          fields: [
            {
              handle: "b",
              label: "B",
              type: "blocks",
              options: { blockTypes: [{ handle: "x", name: "X" }] },
            },
          ],
        },
      }).error?.issues[0]?.message,
    ).toContain("can't have a Blocks field inside it");
  });

  it("every fieldtype says where the picker lists it", () => {
    expect(findFieldtype("select")?.category).toBe("choices");
    expect(findFieldtype("select")?.keywords).toContain("dropdown");
    expect(findFieldtype("richText")?.keywords).toContain("wysiwyg");
    expect(findFieldtype("section")?.holdsValue).toBe(false);
  });
});
