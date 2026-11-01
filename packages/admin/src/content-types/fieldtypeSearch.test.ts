import { afterEach, describe, expect, it } from "vitest";
import type { FieldtypeDescription } from "./blueprints.types.js";
import {
  categoriesWithFieldtypes,
  categoryOf,
  fieldtypesIn,
  gridTargetIndex,
  readRecentFieldtypes,
  rememberFieldtype,
  searchFieldtypes,
} from "./fieldtypeSearch.js";

function fieldtype(
  type: FieldtypeDescription["type"],
  name: string,
  category: FieldtypeDescription["category"],
  keywords: string[] = [],
  description = "",
): FieldtypeDescription {
  return { type, name, category, keywords, description, holdsValue: true, canBeInside: true };
}

const fieldtypes = [
  fieldtype("text", "Text", "text", ["input", "string"], "A single line of text."),
  fieldtype("richText", "Rich text", "text", ["wysiwyg", "editor", "html"], "Formatted writing."),
  fieldtype("select", "Select", "choices", ["dropdown", "options"], "A choice from a list."),
  fieldtype("radio", "Radio buttons", "choices", ["single choice"], "One choice from a list."),
  fieldtype("date", "Date", "dates", ["calendar"], "A calendar date."),
  fieldtype("time", "Time", "dates", ["clock"], "A time of day."),
];

describe("searchFieldtypes", () => {
  it("finds fieldtypes by the other words people use for them", () => {
    expect(searchFieldtypes(fieldtypes, "dropdown").map((found) => found.type)).toEqual(["select"]);
    expect(searchFieldtypes(fieldtypes, "WYSIWYG").map((found) => found.type)).toEqual([
      "richText",
    ]);
  });

  it("puts names first, then other words, then descriptions", () => {
    expect(searchFieldtypes(fieldtypes, "text").map((found) => found.type)).toEqual([
      "text",
      "richText",
    ]);
    expect(searchFieldtypes(fieldtypes, "choice").map((found) => found.type)).toEqual([
      "radio",
      "select",
    ]);
  });

  it("needs every word typed to match, and returns everything for an empty search", () => {
    expect(searchFieldtypes(fieldtypes, "calendar date").map((found) => found.type)).toEqual([
      "date",
    ]);
    expect(searchFieldtypes(fieldtypes, "calendar sandwich")).toEqual([]);
    expect(searchFieldtypes(fieldtypes, "  ")).toHaveLength(fieldtypes.length);
  });
});

describe("categories", () => {
  it("lists the categories in use, in order, and the fieldtypes in each", () => {
    expect(categoriesWithFieldtypes(fieldtypes)).toEqual(["text", "choices", "dates"]);
    expect(fieldtypesIn(fieldtypes, "dates").map((found) => found.type)).toEqual(["date", "time"]);
  });

  it("puts a fieldtype without a known category under Advanced", () => {
    expect(categoryOf({ category: undefined as never })).toBe("advanced");
  });
});

describe("gridTargetIndex", () => {
  it("moves a row with up and down and an item with left and right, stopping at the ends", () => {
    expect(gridTargetIndex("ArrowDown", 1, 7, 3)).toBe(4);
    expect(gridTargetIndex("ArrowUp", 4, 7, 3)).toBe(1);
    expect(gridTargetIndex("ArrowRight", 1, 7, 3)).toBe(2);
    expect(gridTargetIndex("ArrowLeft", 0, 7, 3)).toBe(0);
    expect(gridTargetIndex("ArrowDown", 5, 7, 3)).toBe(5);
    expect(gridTargetIndex("ArrowDown", -1, 7, 3)).toBe(0);
    expect(gridTargetIndex("Enter", 1, 7, 3)).toBeUndefined();
  });
});

describe("recently used", () => {
  afterEach(() => window.localStorage.clear());

  it("remembers the newest first, once each", () => {
    rememberFieldtype("text");
    rememberFieldtype("select");
    rememberFieldtype("text");
    expect(readRecentFieldtypes()).toEqual(["text", "select"]);
  });
});
