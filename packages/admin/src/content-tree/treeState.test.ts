import { describe, expect, it } from "vitest";
import {
  clampTreeWidth,
  dropPosition,
  moveForDrop,
  parseKeys,
  toggled,
  TREE_WIDTH,
} from "./treeState.js";

describe("the tree pane's width", () => {
  it("stays between the narrowest and widest the workspace can live with", () => {
    expect(clampTreeWidth(100)).toBe(TREE_WIDTH.minimum);
    expect(clampTreeWidth(900)).toBe(TREE_WIDTH.maximum);
    expect(clampTreeWidth(300.4)).toBe(300);
    expect(clampTreeWidth(Number.NaN)).toBe(TREE_WIDTH.default);
  });
});

describe("open branches", () => {
  it("switches one branch, leaving the rest", () => {
    expect([...toggled(new Set(["a", "b"]), "a")]).toEqual(["b"]);
    expect([...toggled(new Set(["b"]), "a")]).toEqual(["b", "a"]);
  });

  it("reads what was saved, ignoring anything broken", () => {
    expect([...parseKeys('["root:pages","e1",3]')]).toEqual(["root:pages", "e1"]);
    expect(parseKeys("not json").size).toBe(0);
    expect(parseKeys(null).size).toBe(0);
  });
});

describe("dropping a dragged row", () => {
  it("puts it before, inside or after by where on the row it lands", () => {
    expect(dropPosition(2, 32, true)).toBe("before");
    expect(dropPosition(16, 32, true)).toBe("inside");
    expect(dropPosition(30, 32, true)).toBe("after");
    expect(dropPosition(15, 32, false)).toBe("before");
    expect(dropPosition(17, 32, false)).toBe("after");
  });

  it("works out the new parent and place among the siblings", () => {
    const siblings = ["home", "about", "contact"];
    const about = { id: "about", parentId: "root" };

    expect(moveForDrop("contact", about, "before", siblings)).toEqual({
      parentId: "root",
      index: 1,
    });
    expect(moveForDrop("home", about, "after", siblings)).toEqual({ parentId: "root", index: 1 });
    expect(moveForDrop("home", about, "inside", siblings)).toEqual({
      parentId: "about",
      index: Number.MAX_SAFE_INTEGER,
    });
  });
});
