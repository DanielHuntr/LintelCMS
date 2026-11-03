import { describe, expect, it } from "vitest";
import { type CanvasMenuLink, markCurrentPage } from "./builderMenus.js";

const link = (id: string, entryId: string | null, children: CanvasMenuLink[] = []) => ({
  id,
  entryId,
  label: id,
  url: null,
  current: false,
  children,
});

describe("the builder's menus", () => {
  it("mark the page being designed as the current page, as the website does", () => {
    const menus = [
      {
        handle: "main",
        name: "Main menu",
        links: [link("home", "e1"), link("work", "e2", [link("team", "e3")]), link("shop", null)],
      },
    ];
    const marked = markCurrentPage(menus, "e3");
    expect(marked[0]!.links.map((each) => each.current)).toEqual([false, false, false]);
    expect(marked[0]!.links[1]!.children[0]!.current).toBe(true);
    expect(markCurrentPage(menus, "e1")[0]!.links[0]!.current).toBe(true);
    // Item ids come along, so links can be styled on their own.
    expect(marked[0]!.links.map((each) => each.id)).toEqual(["home", "work", "shop"]);
  });
});
