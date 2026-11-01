import { describe, expect, it } from "vitest";
import { moveEntryBy, moveEntryTo, subtreeIds, treeDepths } from "./treeOrder.js";

// Home, About (Our story, Team), Services (Web design), Contact: in tree order.
const pages = [
  { id: "home", parentId: null },
  { id: "about", parentId: null },
  { id: "story", parentId: "about" },
  { id: "team", parentId: "about" },
  { id: "services", parentId: null },
  { id: "web", parentId: "services" },
  { id: "contact", parentId: null },
];
const ids = (list: Array<{ id: string }>) => list.map((page) => page.id);

describe("tree order", () => {
  it("knows how deep each page is", () => {
    const depths = treeDepths(pages);

    expect(depths.get("home")).toBe(0);
    expect(depths.get("team")).toBe(1);
  });

  it("finds a page and everything under it", () => {
    expect([...subtreeIds(pages, "about")]).toEqual(["about", "story", "team"]);
  });

  it("moves a page down past its next sibling, children and all", () => {
    expect(ids(moveEntryBy(pages, "about", 1))).toEqual([
      "home",
      "services",
      "web",
      "about",
      "story",
      "team",
      "contact",
    ]);
  });

  it("moves a page up among its siblings only", () => {
    expect(ids(moveEntryBy(pages, "team", -1))).toEqual([
      "home",
      "about",
      "team",
      "story",
      "services",
      "web",
      "contact",
    ]);
    expect(ids(moveEntryBy(pages, "story", -1))).toEqual(ids(pages));
  });

  it("ignores a drop onto a page with a different parent", () => {
    expect(ids(moveEntryTo(pages, "web", "story"))).toEqual(ids(pages));
  });

  it("moves freely in a flat list", () => {
    const team = [
      { id: "ada", parentId: null },
      { id: "grace", parentId: null },
      { id: "alan", parentId: null },
    ];

    expect(ids(moveEntryTo(team, "alan", "ada"))).toEqual(["alan", "ada", "grace"]);
  });
});
