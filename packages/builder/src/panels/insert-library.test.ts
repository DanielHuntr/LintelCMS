import { sectionTemplates, standardCatalogue } from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { builderStrings } from "../i18n/builder-strings.js";
import {
  groupInsertItems,
  insertItems,
  readRecentlyUsed,
  recentLimit,
  searchInsertItems,
  withRecentlyUsed,
} from "./insert-library.js";

const items = insertItems(sectionTemplates, standardCatalogue.definitions);
const words = (key: keyof typeof builderStrings) => builderStrings[key];

describe("the insert library", () => {
  it("lists sections by group, then elements by group, in the library's order", () => {
    const sections = groupInsertItems(items, "sections");
    expect(sections[0]?.id).toBe("hero");
    expect(sections[0]?.items.map((item) => item.label)).toEqual([
      "Hero",
      "Hero with picture",
      "Bold banner",
    ]);
    const elements = groupInsertItems(items, "elements");
    expect(elements.every((group) => group.items.length > 0)).toBe(true);
    expect(elements.flatMap((group) => group.items).every((item) => item.icon)).toBe(true);
  });

  it("finds names first, then descriptions and groups, needing every word", () => {
    const found = searchInsertItems(items, "quote", words);
    expect(found[0]?.label).toBe("Quote");
    expect(found.map((item) => item.label)).toContain("Customer quote");
    expect(searchInsertItems(items, "big welcome", words).map((item) => item.label)).toContain(
      "Hero",
    );
    expect(searchInsertItems(items, "hero spaceship", words)).toEqual([]);
    expect(searchInsertItems(items, "   ", words)).toEqual([]);
  });

  it("keeps the most recently used first, once each, and only a few", () => {
    let recent = readRecentlyUsed(null);
    recent = withRecentlyUsed(recent, "component:heading");
    recent = withRecentlyUsed(recent, "template:hero");
    recent = withRecentlyUsed(recent, "component:heading");
    expect(recent).toEqual(["component:heading", "template:hero"]);
    for (let index = 0; index < 20; index += 1) {
      recent = withRecentlyUsed(recent, `component:made-up-${index}`);
    }
    expect(recent).toHaveLength(recentLimit);
    expect(readRecentlyUsed("component:heading,nonsense,template:hero")).toEqual([
      "component:heading",
      "template:hero",
    ]);
  });
});
