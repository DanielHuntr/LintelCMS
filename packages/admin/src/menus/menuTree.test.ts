import { describe, expect, it } from "vitest";
import {
  buildMenu,
  canIndent,
  type FlatMenuItem,
  flattenMenu,
  indentItem,
  moveItemBy,
  moveItemTo,
  outdentItem,
  removeItem,
  addPageItems,
  shiftDepth,
} from "./menuTree.js";
import type { MenuItem } from "./menus.types.js";

function item(id: string, children: MenuItem[] = []): MenuItem {
  return { id, label: id, entryId: null, url: `/${id}`, newTab: false, children };
}

/** "about >team >jobs" style: each item's id with one ">" per level. */
function outline(flat: readonly FlatMenuItem[]): string[] {
  return flat.map((entry) => `${">".repeat(entry.depth)}${entry.id}`);
}

const menu = [item("home"), item("about", [item("team"), item("jobs")]), item("contact")];

describe("the menu tree", () => {
  it("flattens in reading order and builds back the same tree", () => {
    const flat = flattenMenu(menu);
    expect(outline(flat)).toEqual(["home", "about", ">team", ">jobs", "contact"]);
    expect(buildMenu(flat)).toEqual(menu);
  });

  it("moves an item with its children among its siblings only", () => {
    const flat = flattenMenu(menu);
    expect(outline(moveItemBy(flat, "about", -1))).toEqual([
      "about",
      ">team",
      ">jobs",
      "home",
      "contact",
    ]);
    expect(outline(moveItemBy(flat, "home", 1))).toEqual([
      "about",
      ">team",
      ">jobs",
      "home",
      "contact",
    ]);
    expect(outline(moveItemBy(flat, "jobs", -1))).toEqual([
      "home",
      "about",
      ">jobs",
      ">team",
      "contact",
    ]);
    // The first child can't move up out of its parent; that's what outdent is for.
    expect(outline(moveItemBy(flat, "team", -1))).toEqual(outline(flat));
  });

  it("indents into the sibling above, within the menu's levels", () => {
    const flat = flattenMenu(menu);
    expect(outline(indentItem(flat, "contact", 3))).toEqual([
      "home",
      "about",
      ">team",
      ">jobs",
      ">contact",
    ]);
    expect(canIndent(flat, "home", 3)).toBe(false);
    expect(canIndent(flat, "about", 2)).toBe(false);
    expect(canIndent(flat, "jobs", 2)).toBe(false);
    expect(outline(indentItem(flat, "jobs", 3))).toEqual([
      "home",
      "about",
      ">team",
      ">>jobs",
      "contact",
    ]);
  });

  it("outdents to just after the parent, leaving later siblings inside it", () => {
    const flat = flattenMenu(menu);
    expect(outline(outdentItem(flat, "team"))).toEqual([
      "home",
      "about",
      ">jobs",
      "team",
      "contact",
    ]);
  });

  it("drops a dragged item where another is, never deeper than below its new neighbour", () => {
    const flat = flattenMenu(menu);
    expect(outline(moveItemTo(flat, "contact", "home"))).toEqual([
      "contact",
      "home",
      "about",
      ">team",
      ">jobs",
    ]);
    expect(outline(moveItemTo(flat, "team", "contact"))).toEqual([
      "home",
      "about",
      ">jobs",
      "contact",
      ">team",
    ]);
    expect(outline(moveItemTo(flat, "about", "team"))).toEqual(outline(flat));
  });

  it("removes an item with everything inside it", () => {
    expect(outline(removeItem(flattenMenu(menu), "about"))).toEqual(["home", "contact"]);
  });
});

describe("dragging to the side and adding pages", () => {
  const flat = (entries: [string, number, ("link" | "button")?][]): FlatMenuItem[] =>
    entries.map(([id, depth, style]) => ({
      id,
      label: id,
      entryId: id,
      url: null,
      newTab: false,
      style: style ?? "link",
      depth,
    }));
  const shape = (items: readonly FlatMenuItem[]) => items.map((item) => `${item.id}:${item.depth}`);

  it("goes in one level per step to the right, as far as the menu allows", () => {
    const items = flat([
      ["a", 0],
      ["b", 0],
      ["c", 0],
    ]);
    expect(shape(shiftDepth(items, "c", 2, 3))).toEqual(["a:0", "b:0", "c:1"]);
    expect(
      shape(
        shiftDepth(
          flat([
            ["a", 0],
            ["b", 1],
            ["c", 1],
          ]),
          "c",
          1,
          3,
        ),
      ),
    ).toEqual(["a:0", "b:1", "c:2"]);
    expect(
      shape(
        shiftDepth(
          flat([
            ["a", 0],
            ["b", 1],
          ]),
          "b",
          -3,
          3,
        ),
      ),
    ).toEqual(["a:0", "b:0"]);
  });

  it("adds pages under their parent's item, and before buttons at the top", () => {
    const counter = { next: 0 };
    const added = addPageItems(
      flat([
        ["about", 0],
        ["book", 0, "button"],
      ]),
      [
        { id: "team", title: "Team", parentId: "about" },
        { id: "contact", title: "Contact", parentId: null },
        { id: "about", title: "About", parentId: null },
      ],
      2,
      () => `new-${counter.next++}`,
    );
    expect(added.map((item) => `${item.entryId}:${item.depth}`)).toEqual([
      "about:0",
      "team:1",
      "contact:0",
      "book:0",
    ]);
  });
});
