import { describe, expect, it } from "vitest";
import type { Field } from "./field.types.js";
import { defaultValues, splitIntoTabs, widthClass, widthNearestColumns } from "./fieldLayout.js";

const field = (handle: string, type: Field["type"], extra: Partial<Field> = {}): Field => ({
  handle,
  label: handle,
  type,
  required: false,
  options: {},
  ...extra,
});

describe("splitIntoTabs", () => {
  it("keeps everything in one tab without Tab fields", () => {
    const tabs = splitIntoTabs([field("title", "text"), field("body", "richText")]);
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.tab).toBeNull();
  });

  it("starts a new tab at each Tab field, after the fields before the first", () => {
    const tabs = splitIntoTabs([
      field("title", "text"),
      field("seo_tab", "tab"),
      field("meta_title", "text"),
      field("extra_tab", "tab"),
    ]);
    expect(tabs.map((tab) => [tab.tab?.handle ?? null, tab.fields.map((f) => f.handle)])).toEqual([
      [null, ["title"]],
      ["seo_tab", ["meta_title"]],
      ["extra_tab", []],
    ]);
  });

  it("drops an empty first tab when the form starts with a Tab field", () => {
    const tabs = splitIntoTabs([field("main", "tab"), field("title", "text")]);
    expect(tabs.map((tab) => tab.tab?.handle)).toEqual(["main"]);
  });
});

describe("widths", () => {
  it("spans the whole row on narrow screens and its share of 12 columns on wider ones", () => {
    expect(widthClass(50)).toBe("col-span-12 @xl:col-span-6");
    expect(widthClass(undefined)).toBe("col-span-12");
  });

  it("snaps a dragged edge to the nearest width", () => {
    expect(widthNearestColumns(5.6)).toBe(50);
    expect(widthNearestColumns(4.2)).toBe(33);
    expect(widthNearestColumns(11)).toBe(100);
    expect(widthNearestColumns(1)).toBe(25);
  });
});

describe("defaultValues", () => {
  it("starts a new entry with each field's default, inside groups too", () => {
    expect(
      defaultValues([
        field("status", "select", { default: "draft" }),
        field("count", "number"),
        field("address", "group", {
          options: { fields: [field("country", "text", { default: "UK" })] },
        }),
      ]),
    ).toEqual({ status: "draft", address: { country: "UK" } });
  });
});
