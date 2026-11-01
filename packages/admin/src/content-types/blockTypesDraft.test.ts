import { describe, expect, it } from "vitest";
import type { BlockType } from "../fields/field.types.js";
import {
  addBlockType,
  addInnerField,
  blockTypesForSaving,
  blockTypesProblem,
  changeBlockType,
  changeInnerField,
  changeInnerFields,
  moveBlockType,
  withDraftKeys,
} from "./blockTypesDraft.js";
import { fieldForSaving } from "./blueprintDraft.js";

describe("block types in the blueprint builder", () => {
  it("makes a new block type's handle from its name until the handle is edited", () => {
    let types = addBlockType([], "k1");
    types = changeBlockType(types, "k1", { name: "Call to action" });
    expect(types[0]?.handle).toBe("call_to_action");

    types = changeBlockType(types, "k1", { handle: "cta" });
    types = changeBlockType(types, "k1", { name: "Big button" });
    expect(types[0]).toMatchObject({ name: "Big button", handle: "cta" });
  });

  it("keeps the handles of saved block types, and of their fields", () => {
    const saved = withDraftKeys([
      {
        handle: "hero",
        name: "Hero",
        fields: [
          { handle: "heading", label: "Heading", type: "text", required: true, options: {} },
        ],
      },
    ]);
    const renamed = changeInnerFields(
      changeBlockType(saved, "saved:hero", { name: "Banner" }),
      "saved:hero",
      (fields) => changeInnerField(fields, "saved:heading", { label: "Title" }),
    );
    expect(renamed[0]).toMatchObject({ handle: "hero", name: "Banner" });
    expect(renamed[0]?.fields[0]).toMatchObject({ handle: "heading", label: "Title" });
  });

  it("gives new fields handles that are free within their block type", () => {
    const fields = addInnerField(
      addInnerField([], "f1", "text", "Heading"),
      "f2",
      "text",
      "Heading",
    );
    expect(fields.map((field) => field.handle)).toEqual(["heading", "heading_2"]);
    expect(addInnerField([], "f3", "select", "Size")[0]?.options).toEqual({
      choices: [],
      multiple: false,
    });
  });

  it("moves block types up and down", () => {
    const types = withDraftKeys([
      { handle: "a", name: "A", fields: [] },
      { handle: "b", name: "B", fields: [] },
    ]);
    expect(moveBlockType(types, "saved:b", -1).map((type) => type.handle)).toEqual(["b", "a"]);
    expect(moveBlockType(types, "saved:a", -1).map((type) => type.handle)).toEqual(["a", "b"]);
  });

  it("says what to fix before saving, in plain words", () => {
    expect(blockTypesProblem([])).toBe("Add at least one block type.");
    expect(blockTypesProblem(addBlockType([], "k1"))).toBe("Give every block type a name.");

    const unlabelled: BlockType[] = [
      {
        handle: "faq",
        name: "FAQ",
        fields: [{ handle: "q", label: " ", type: "text", required: false, options: {} }],
      },
    ];
    expect(blockTypesProblem(unlabelled)).toBe("Give every field in FAQ a label.");

    const noChoices: BlockType[] = [
      {
        handle: "card",
        name: "Card",
        fields: [{ handle: "size", label: "Size", type: "select", required: false, options: {} }],
      },
    ];
    expect(blockTypesProblem(noChoices)).toBe("Add at least one choice to Size in Card.");
  });

  it("sends the API clean block types, without the builder's bookkeeping", () => {
    let types = changeBlockType(addBlockType([], "k1"), "k1", { name: " Hero ", description: "" });
    types = changeInnerFields(types, "k1", (fields) =>
      addInnerField(fields, "f1", "text", "Heading"),
    );

    expect(blockTypesForSaving(types, fieldForSaving)).toEqual([
      {
        handle: "hero",
        name: "Hero",
        fields: [
          { handle: "heading", label: "Heading", type: "text", required: false, options: {} },
        ],
      },
    ]);
  });
});
