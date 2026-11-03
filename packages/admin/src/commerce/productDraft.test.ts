import { describe, expect, it } from "vitest";
import {
  emptyProductDraft,
  emptyVariant,
  type OptionDraft,
  productInputFromDraft,
  renameChoice,
  type VariantDraft,
  variantsForOptions,
} from "./productDraft.js";

function saved(id: string, optionValues: string[], sku: string): VariantDraft {
  return {
    ...emptyVariant(optionValues),
    key: id,
    id,
    price: "10.00",
    sku,
    inventoryTracked: true,
    stock: { main: "4" },
  };
}

const size = (values: string): OptionDraft => ({ name: "Size", values });
const colour = (values: string): OptionDraft => ({ name: "Colour", values });

describe("variantsForOptions", () => {
  it("leaves the other variants alone when a choice is removed", () => {
    const variants = [saved("a", ["S"], "A"), saved("b", ["M"], "B"), saved("c", ["L"], "C")];
    expect(variantsForOptions([size("S, L")], variants)).toEqual([variants[0], variants[2]]);
  });

  it("gives a new choice an empty variant at the same price", () => {
    const [first, added] = variantsForOptions([size("S, M")], [saved("a", ["S"], "A")]);
    expect(first?.id).toBe("a");
    expect(added).toMatchObject({ optionValues: ["M"], price: "10.00", sku: "" });
    expect(added?.id).toBeUndefined();
  });

  it("brings a removed variant back with its details from those set aside", () => {
    const removed = saved("b", ["M"], "B");
    const [, restored] = variantsForOptions([size("S, M")], [saved("a", ["S"], "A")], [removed]);
    expect(restored).toBe(removed);
  });

  it("keeps each variant's details when a second option is added", () => {
    const variants = [saved("a", ["S"], "A"), saved("b", ["M"], "B")];
    const result = variantsForOptions([size("S, M"), colour("Oat, Ink")], variants);
    expect(result.map((variant) => [variant.optionValues.join("/"), variant.id])).toEqual([
      ["S/Oat", "a"],
      ["S/Ink", undefined],
      ["M/Oat", "b"],
      ["M/Ink", undefined],
    ]);
    expect(result[0]).toMatchObject({ sku: "A", stock: { main: "4" } });
  });

  it("new combinations take the price of the variant they came from", () => {
    const small = { ...saved("a", ["S"], "A"), price: "8.00" };
    const medium = { ...saved("b", ["M"], "B"), price: "9.00" };
    const result = variantsForOptions([size("S, M"), colour("Oat, Ink")], [small, medium]);
    expect(result.map((variant) => variant.price)).toEqual(["8.00", "8.00", "9.00", "9.00"]);
  });

  it("keeps one variant per value when an option is taken away, never the same id twice", () => {
    const variants = [
      saved("a", ["S", "Oat"], "A"),
      saved("b", ["S", "Ink"], "B"),
      saved("c", ["M", "Oat"], "C"),
    ];
    const result = variantsForOptions([size("S, M")], variants);
    expect(result.map((variant) => variant.id)).toEqual(["a", "c"]);
  });

  it("gives the first combination the single variant of a product gaining its first option", () => {
    const only = { ...saved("a", [], "A"), key: "a" };
    const result = variantsForOptions([size("S, M")], [only]);
    expect(result[0]).toMatchObject({ id: "a", sku: "A", optionValues: ["S"] });
    expect(result[1]).toMatchObject({ sku: "", price: "10.00", optionValues: ["M"] });
  });

  it("goes back to one variant when the last option goes", () => {
    const variants = [saved("a", ["S"], "A"), saved("b", ["M"], "B")];
    expect(variantsForOptions([], variants)).toEqual([{ ...variants[0], optionValues: [] }]);
  });
});

describe("renameChoice", () => {
  const draft = {
    options: [size("S, M"), colour("Oat, Ink")],
    variants: [
      saved("a", ["S", "Oat"], "A"),
      saved("b", ["S", "Ink"], "B"),
      saved("c", ["M", "Oat"], "C"),
    ],
  };

  it("rewords the choice on the option and its variants, keeping their details", () => {
    const renamed = renameChoice(draft, 0, "S", "Small");
    expect(renamed.options[0]?.values).toBe("Small, M");
    expect(renamed.variants.map((variant) => variant.optionValues)).toEqual([
      ["Small", "Oat"],
      ["Small", "Ink"],
      ["M", "Oat"],
    ]);
    expect(renamed.variants.map((variant) => variant.id)).toEqual(["a", "b", "c"]);
    expect(renamed.variants[1]?.sku).toBe("B");
  });

  it("only changes the option it was asked to", () => {
    const sameWords = {
      options: [size("Plain, Tall"), { name: "Finish", values: "Plain, Gloss" }],
      variants: [saved("a", ["Plain", "Plain"], "A")],
    };
    const renamed = renameChoice(sameWords, 1, "Plain", "Matt");
    expect(renamed.variants[0]?.optionValues).toEqual(["Plain", "Matt"]);
  });

  it("skips options with no choices yet when working out which value to change", () => {
    const withEmpty = { ...draft, options: [{ name: "", values: "" }, ...draft.options] };
    const renamed = renameChoice(withEmpty, 2, "Oat", "Cream");
    expect(renamed.variants[0]?.optionValues).toEqual(["S", "Cream"]);
  });

  it("gives an unsaved variant a new key, so a new variant can use the old wording", () => {
    const unsaved = { options: [size("S")], variants: [emptyVariant(["S"])] };
    expect(renameChoice(unsaved, 0, "S", "Small").variants[0]?.key).toBe("Small");
  });
});

describe("productInputFromDraft", () => {
  it("sends the choices as a list, in the same shape as before", () => {
    const options = [size("S, M")];
    const { input } = productInputFromDraft(
      {
        ...emptyProductDraft(),
        title: "Shirt",
        options,
        variants: variantsForOptions(options, []),
      },
      "GBP",
      [],
    );
    expect(input.options).toEqual([{ name: "Size", values: ["S", "M"] }]);
    expect(input.variants.map((variant) => variant.optionValues)).toEqual([["S"], ["M"]]);
  });

  it("asks for a name for an option that has choices", () => {
    const draft = { ...emptyProductDraft(), options: [{ name: " ", values: "S" }] };
    expect(productInputFromDraft(draft, "GBP", []).problems).toEqual({
      "options.0.name": "optionName",
    });
  });

  it("stops at the API's limit of 100 variants", () => {
    const options = [size(Array.from({ length: 101 }, (_, index) => `S${index}`).join(","))];
    const draft = { ...emptyProductDraft(), options, variants: variantsForOptions(options, []) };
    expect(productInputFromDraft(draft, "GBP", []).problems.variants).toBe("tooManyVariants");
  });
});
