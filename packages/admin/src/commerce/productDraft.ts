import type { RichTextDocument } from "../fields/field.types.js";
import { inputToMinor, minorToInput } from "./money.js";
import type { Product, ProductInput, ProductStatus, VariantPrice } from "./products.api.js";

/**
 * The product editor's working copy. Numbers stay as the text people type until saving, so
 * "45." or an empty box never jumps about while they're typing. Only the primary currency's
 * price is edited here; prices set for other currencies are kept as they were.
 */

export interface VariantDraft {
  /** Stable across edits, for React keys: the saved id, or the option values. */
  key: string;
  id?: string;
  optionValues: string[];
  price: string;
  compareAtPrice: string;
  sku: string;
  barcode: string;
  weightGrams: string;
  inventoryTracked: boolean;
  /** Stock typed for each location, by location id. */
  stock: Record<string, string>;
  otherPrices: VariantPrice[];
}

export interface OptionDraft {
  name: string;
  /** "Small, Medium, Large" */
  values: string;
}

export interface ProductDraft {
  title: string;
  handle: string;
  description: RichTextDocument | null;
  status: ProductStatus;
  vendor: string;
  productType: string;
  tags: string;
  mediaIds: string[];
  seoTitle: string;
  seoDescription: string;
  options: OptionDraft[];
  variants: VariantDraft[];
}

export function emptyVariant(optionValues: string[] = []): VariantDraft {
  return {
    key: optionValues.join(" / ") || "default",
    optionValues,
    price: "",
    compareAtPrice: "",
    sku: "",
    barcode: "",
    weightGrams: "",
    inventoryTracked: true,
    stock: {},
    otherPrices: [],
  };
}

export function emptyProductDraft(): ProductDraft {
  return {
    title: "",
    handle: "",
    description: null,
    status: "draft",
    vendor: "",
    productType: "",
    tags: "",
    mediaIds: [],
    seoTitle: "",
    seoDescription: "",
    options: [],
    variants: [emptyVariant()],
  };
}

export function draftFromProduct(product: Product, currency: string): ProductDraft {
  return {
    title: product.title,
    handle: product.handle,
    description: product.description,
    status: product.status,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags.join(", "),
    mediaIds: product.mediaIds,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    options: product.options.map((option) => ({
      name: option.name,
      values: option.values.join(", "),
    })),
    variants: product.variants.map((variant) => {
      const price = variant.prices.find((candidate) => candidate.currency === currency);
      return {
        key: variant.id,
        id: variant.id,
        optionValues: variant.optionValues,
        price: minorToInput(price?.amount, currency),
        compareAtPrice: minorToInput(price?.compareAtAmount, currency),
        sku: variant.sku ?? "",
        barcode: variant.barcode ?? "",
        weightGrams: variant.weightGrams ? String(variant.weightGrams) : "",
        inventoryTracked: variant.inventoryTracked,
        stock: Object.fromEntries(
          variant.stock.map((level) => [level.locationId, String(level.onHand)]),
        ),
        otherPrices: variant.prices.filter((candidate) => candidate.currency !== currency),
      };
    }),
  };
}

export function splitList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part !== ""),
    ),
  ];
}

/**
 * The variants for a set of options: one for every combination of values, keeping what was
 * typed for combinations that were already there. Without options, the one default variant.
 */
export function variantsForOptions(
  options: readonly OptionDraft[],
  existing: readonly VariantDraft[],
): VariantDraft[] {
  const lists = options
    .map((option) => splitList(option.values))
    .filter((values) => values.length > 0);
  if (lists.length === 0) {
    const first = existing[0] ?? emptyVariant();
    return [{ ...first, optionValues: [] }];
  }
  const combinations = lists.reduce<string[][]>(
    (sofar, values) =>
      sofar.flatMap((combination) => values.map((value) => [...combination, value])),
    [[]],
  );
  const byValues = new Map(
    existing.map((variant) => [variant.optionValues.join("\u0000"), variant]),
  );
  // A product gaining its first option keeps the old default variant's details for the first combination.
  const template =
    existing.length === 1 && existing[0]?.optionValues.length === 0 ? existing[0] : undefined;
  return combinations.map((combination, index) => {
    const kept = byValues.get(combination.join("\u0000"));
    if (kept) return kept;
    if (template && index === 0)
      return { ...template, key: combination.join(" / "), optionValues: combination };
    return { ...emptyVariant(combination), price: template?.price ?? existing[0]?.price ?? "" };
  });
}

/** Why a box can't be saved yet; each has a message under `shop.products.problem`. */
export type DraftProblemKind = "price" | "weight" | "stock";

export interface DraftProblems {
  [field: string]: DraftProblemKind;
}

/** What the API needs, or the boxes that don't hold a number yet. */
export function productInputFromDraft(
  draft: ProductDraft,
  currency: string | null,
  locationIds: readonly string[],
): { input: ProductInput; problems: DraftProblems } {
  const problems: DraftProblems = {};
  const variants = draft.variants.map((variant, index) => {
    const prices: VariantPrice[] = [...variant.otherPrices];
    if (currency && variant.price.trim() !== "") {
      const amount = inputToMinor(variant.price, currency);
      const compareAt =
        variant.compareAtPrice.trim() === ""
          ? null
          : inputToMinor(variant.compareAtPrice, currency);
      if (amount === null) problems[`variants.${index}.price`] = "price";
      if (variant.compareAtPrice.trim() !== "" && compareAt === null)
        problems[`variants.${index}.compareAtPrice`] = "price";
      if (amount !== null) prices.push({ currency, amount, compareAtAmount: compareAt });
    }
    const weight = variant.weightGrams.trim() === "" ? 0 : Number(variant.weightGrams);
    if (!Number.isInteger(weight) || weight < 0)
      problems[`variants.${index}.weightGrams`] = "weight";
    const stock = locationIds.flatMap((locationId) => {
      const typed = variant.stock[locationId]?.trim() ?? "";
      if (typed === "") return [];
      const onHand = Number(typed);
      if (!Number.isInteger(onHand)) {
        problems[`variants.${index}.stock`] = "stock";
        return [];
      }
      return [{ locationId, onHand }];
    });
    return {
      ...(variant.id && { id: variant.id }),
      optionValues: variant.optionValues,
      sku: variant.sku.trim() || null,
      barcode: variant.barcode.trim() || null,
      weightGrams: Number.isInteger(weight) && weight >= 0 ? weight : 0,
      inventoryTracked: variant.inventoryTracked,
      prices,
      stock,
    };
  });
  return {
    problems,
    input: {
      title: draft.title.trim(),
      ...(draft.handle.trim() !== "" && { handle: draft.handle.trim() }),
      description: draft.description,
      status: draft.status,
      vendor: draft.vendor.trim(),
      productType: draft.productType.trim(),
      tags: splitList(draft.tags),
      mediaIds: draft.mediaIds,
      seoTitle: draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim(),
      options: draft.options
        .map((option) => ({ name: option.name.trim(), values: splitList(option.values) }))
        .filter((option) => option.name !== "" && option.values.length > 0),
      variants,
    },
  };
}
