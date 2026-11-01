import { describe, expect, it } from "vitest";
import {
  inTreeOrder,
  moveEntryBy,
  moveEntryInTree,
  moveEntryTo,
  moveOutOfParent,
  nestUnderPreviousSibling,
  projectTreeDrop,
  subtreeIds,
  treeDepths,
} from "./treeOrder.js";

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

const parents = (list: Array<{ id: string; parentId: string | null }>) =>
  Object.fromEntries(list.map((page) => [page.id, page.parentId]));

describe("changing a page's parent", () => {
  it("puts a list back in tree order, keeping siblings in order", () => {
    const shuffled = [
      { id: "team", parentId: "about" },
      { id: "home", parentId: null },
      { id: "about", parentId: null },
      { id: "story", parentId: "about" },
    ];
    expect(ids(inTreeOrder(shuffled))).toEqual(["home", "about", "team", "story"]);
  });

  it("nests a dragged page under the page above when it is dragged right", () => {
    // Home dragged down past Web design: how far right decides where it ends up.
    expect(projectTreeDrop(pages, "home", "web", 2)).toEqual({ depth: 2, parentId: "web" });
    expect(projectTreeDrop(pages, "home", "web", 1)).toEqual({ depth: 1, parentId: "services" });
    expect(projectTreeDrop(pages, "home", "web", 0)).toEqual({ depth: 0, parentId: null });
  });

  it("never nests deeper than one below the page above, nor leaves the page below orphaned", () => {
    expect(projectTreeDrop(pages, "home", "web", 9)).toEqual({ depth: 2, parentId: "web" });
    // Dragged up between Services and Web design, Contact has to become Services' child.
    expect(projectTreeDrop(pages, "contact", "web", 0)).toEqual({ depth: 1, parentId: "services" });
  });

  it("moves a page out to the top level when dragged left where it is", () => {
    expect(projectTreeDrop(pages, "team", "team", -1)).toEqual({ depth: 0, parentId: null });
  });

  it("moves the page, children and all, under its new parent", () => {
    // Dragged up onto Our story, Services lands just before it, as About's first child.
    const moved = moveEntryInTree(pages, "services", "story", "about");

    expect(ids(moved)).toEqual(["home", "about", "services", "web", "story", "team", "contact"]);
    expect(parents(moved)).toMatchObject({ services: "about", web: "services" });
  });

  it("refuses to drop a page into its own subtree", () => {
    expect(projectTreeDrop(pages, "about", "team", 1)).toBeNull();
    expect(ids(moveEntryInTree(pages, "about", "team", "team"))).toEqual(ids(pages));
  });

  it("nests under the previous sibling, and moves out to sit after the parent, by keyboard", () => {
    const nested = nestUnderPreviousSibling(pages, "services");
    expect(ids(nested)).toEqual(["home", "about", "story", "team", "services", "web", "contact"]);
    expect(parents(nested).services).toBe("about");
    expect(ids(nestUnderPreviousSibling(pages, "home"))).toEqual(ids(pages));

    const out = moveOutOfParent(pages, "story");
    expect(ids(out)).toEqual(["home", "about", "team", "story", "services", "web", "contact"]);
    expect(parents(out).story).toBeNull();
    expect(ids(moveOutOfParent(pages, "home"))).toEqual(ids(pages));
  });
});
