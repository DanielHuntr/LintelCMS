import { describe, expect, it } from "vitest";
import { emptyVariant, type VariantDraft } from "./productDraft.js";
import {
  groupingChoices,
  groupPosition,
  groupVariants,
  nameInGroup,
  sharedText,
  stockText,
  totalStock,
  variantProblems,
  withStock,
} from "./variantTableState.js";

const counted = (optionValues: string[], stock: Record<string, string>): VariantDraft => ({
  ...emptyVariant(optionValues),
  inventoryTracked: true,
  stock,
});

describe("groupingChoices", () => {
  it("offers each option with several choices", () => {
    expect(
      groupingChoices([
        { name: "Size", values: "S, M" },
        { name: "Colour", values: "Oat, Ink" },
      ]),
    ).toEqual([
      { name: "Size", position: 0 },
      { name: "Colour", position: 1 },
    ]);
  });

  it("doesn't group a single option", () => {
    expect(groupingChoices([{ name: "Size", values: "S, M" }])).toEqual([]);
  });

  it("doesn't group when only one option has several choices", () => {
    const options = [
      { name: "Size", values: "S, M" },
      { name: "Colour", values: "Oat" },
    ];
    expect(groupingChoices(options)).toEqual([]);
  });

  it("numbers positions by the options that make variants", () => {
    const options = [
      { name: "", values: "" },
      { name: "Size", values: "S, M" },
      { name: "Colour", values: "Oat, Ink" },
    ];
    expect(groupingChoices(options).map((choice) => choice.position)).toEqual([0, 1]);
  });
});

describe("groupPosition", () => {
  const choices = [
    { name: "Size", position: 0 },
    { name: "Colour", position: 1 },
  ];

  it("starts with the first option", () => {
    expect(groupPosition("first", choices)).toBe(0);
  });

  it("follows the choice, and falls back when that option has gone", () => {
    expect(groupPosition(1, choices)).toBe(1);
    expect(groupPosition(2, choices)).toBe(0);
  });

  it("is a plain list when grouping is off or impossible", () => {
    expect(groupPosition("none", choices)).toBeNull();
    expect(groupPosition("first", [])).toBeNull();
  });
});

describe("groupVariants", () => {
  it("groups in order and keeps each variant's place in the draft", () => {
    const variants = [
      ["S", "Oat"],
      ["S", "Ink"],
      ["M", "Oat"],
    ].map((values) => emptyVariant(values));
    const groups = groupVariants(variants, 1);
    expect(groups.map((group) => group.name)).toEqual(["Oat", "Ink"]);
    expect(groups[0]?.rows.map((row) => row.index)).toEqual([0, 2]);
  });
});

it("nameInGroup leaves out the group's value", () => {
  const variant = emptyVariant(["S", "Oat", "Cotton"]);
  expect(nameInGroup(variant, 1)).toBe("S / Cotton");
  expect(nameInGroup(variant, null)).toBe("S / Oat / Cotton");
});

it("sharedText is empty when the boxes differ", () => {
  expect(sharedText(["5", "5"])).toBe("5");
  expect(sharedText(["5", "6"])).toBe("");
});

describe("stock", () => {
  it("shows nothing for a variant that isn't counted, even with an old number", () => {
    expect(stockText({ ...emptyVariant(), stock: { main: "9" } }, "main")).toBe("");
  });

  it("starts counting when a number is typed, and leaves other locations alone", () => {
    const variant = withStock({ ...emptyVariant(), stock: { other: "2" } }, "main", "5");
    expect(variant).toMatchObject({ inventoryTracked: true, stock: { main: "5", other: "2" } });
  });

  it("doesn't start counting when the box is emptied", () => {
    expect(withStock(emptyVariant(), "main", " ").inventoryTracked).toBe(false);
  });

  it("adds up every location, leaving out half-typed boxes and uncounted variants", () => {
    const variants = [
      counted(["S"], { main: "3", other: "4" }),
      counted(["M"], { main: "x" }),
      { ...emptyVariant(["L"]), stock: { main: "100" } },
    ];
    expect(totalStock(variants, ["main", "other"])).toEqual({ inStock: 7, notCounted: 1 });
  });
});

it("variantProblems finds a variant's messages and no other's", () => {
  const errors = {
    "variants.1.sku": "Two variants can't share a SKU",
    "variants.1.prices": "Too low",
    "variants.11.sku": "Another",
    title: "Name it",
  };
  expect(variantProblems(errors, 1)).toEqual(["Two variants can't share a SKU", "Too low"]);
});
