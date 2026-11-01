import { describe, expect, it } from "vitest";
import type { BlockType, BlockValue } from "../field.types.js";
import {
  addBlock,
  blockErrors,
  blockSummary,
  blocksValue,
  changeBlockField,
  duplicateBlock,
  innerErrors,
  moveBlockBy,
  moveBlockTo,
  removeBlock,
} from "./blockValues.js";

const hero: BlockValue = { id: "b1", type: "hero", data: { heading: "Welcome" } };
const text: BlockValue = { id: "b2", type: "text", data: {} };
const faq: BlockValue = { id: "b3", type: "faq", data: { question: "Why?" } };
const blocks = [hero, text, faq];
const ids = (list: BlockValue[]) => list.map((block) => block.id);

describe("block values", () => {
  it("reads stored blocks safely, leaving out anything that isn't one", () => {
    expect(blocksValue(null)).toEqual([]);
    expect(blocksValue([hero, "nonsense", { id: 3 }, { id: "b4", type: "text" }])).toEqual([
      hero,
      { id: "b4", type: "text", data: {} },
    ]);
  });

  it("adds, removes and duplicates blocks, the copy straight after the original", () => {
    expect(ids(addBlock(blocks, "image", "new"))).toEqual(["b1", "b2", "b3", "new"]);
    expect(ids(addBlock(blocks, "image", "new", 1))).toEqual(["b1", "new", "b2", "b3"]);
    expect(ids(removeBlock(blocks, "b2"))).toEqual(["b1", "b3"]);

    const duplicated = duplicateBlock(blocks, "b1", "copy");
    expect(ids(duplicated)).toEqual(["b1", "copy", "b2", "b3"]);
    expect(duplicated[1]).toEqual({ id: "copy", type: "hero", data: { heading: "Welcome" } });
    // The copy's values are its own: changing one doesn't change the other.
    expect(duplicated[1]?.data).not.toBe(hero.data);
  });

  it("moves blocks by drag target or one place at a time", () => {
    expect(ids(moveBlockTo(blocks, "b1", "b3"))).toEqual(["b2", "b3", "b1"]);
    expect(ids(moveBlockTo(blocks, "b3", "b1"))).toEqual(["b3", "b1", "b2"]);
    expect(ids(moveBlockBy(blocks, "b2", -1))).toEqual(["b2", "b1", "b3"]);
    expect(ids(moveBlockBy(blocks, "b3", 1))).toEqual(["b1", "b2", "b3"]);
  });

  it("changes one field of one block", () => {
    const changed = changeBlockField(blocks, "b2", "heading", "About us");
    expect(changed[1]?.data).toEqual({ heading: "About us" });
    expect(changed[0]).toBe(hero);
  });

  it("sums a collapsed block up with its first text", () => {
    const heroType: BlockType = {
      handle: "hero",
      name: "Hero",
      fields: [
        { handle: "image", label: "Image", type: "image", required: false, options: {} },
        { handle: "heading", label: "Heading", type: "text", required: true, options: {} },
      ],
    };
    expect(blockSummary(hero, heroType)).toBe("Welcome");
    expect(blockSummary(text, undefined)).toBe("");
  });

  it("picks out the messages for one blocks field, then for one block", () => {
    const errors = {
      title: "Title is required",
      sections: "Hero (block 1): Heading is required",
      "sections.b1.heading": "Heading is required",
      "sections_extra.b9.x": "Not this one",
    };
    const inner = innerErrors(errors, "sections");
    expect(inner).toEqual({ "b1.heading": "Heading is required" });
    expect(blockErrors(inner, "b1")).toEqual({ heading: "Heading is required" });
  });
});
