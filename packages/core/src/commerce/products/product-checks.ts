import { type FieldMessages, InvalidFieldsError } from "../../http/http-errors.js";
import type { AssetExists } from "../../fieldtypes/image-assets.js";
import { isReadableRichText, type RichTextDocument } from "../../fieldtypes/rich-text.js";
import type { ProductRequest } from "./products.schema.js";

/**
 * The rules a product must follow beyond its shape, checked before anything is saved. Each
 * problem is reported against the field it's about ("variants.1.prices"), so the admin can
 * show it in the right place.
 */
export async function checkProduct(
  product: ProductRequest,
  primaryCurrency: string | null,
  assetExists: AssetExists,
): Promise<void> {
  const problems: FieldMessages = {
    ...checkOptions(product),
    ...checkVariants(product, primaryCurrency),
    ...(await checkMedia(product.mediaIds, assetExists)),
  };
  if (product.description && !isReadableRichText(product.description as RichTextDocument)) {
    problems.description = "The description couldn't be read. Try writing it again.";
  }
  if (Object.keys(problems).length > 0) {
    throw new InvalidFieldsError(problems);
  }
}

/** "Red / Large", or "Default" for a product without options. */
export function variantTitle(optionValues: readonly string[]): string {
  return optionValues.length === 0 ? "Default" : optionValues.join(" / ");
}

function checkOptions(product: ProductRequest): FieldMessages {
  const problems: FieldMessages = {};
  const names = product.options.map((option) => option.name.toLowerCase());
  product.options.forEach((option, index) => {
    if (names.indexOf(option.name.toLowerCase()) !== index) {
      problems[`options.${index}.name`] = `There is already an option called ${option.name}`;
    }
    if (new Set(option.values).size !== option.values.length) {
      problems[`options.${index}.values`] = "Each value can only be listed once";
    }
  });
  return problems;
}

function checkVariants(product: ProductRequest, primaryCurrency: string | null): FieldMessages {
  const problems: FieldMessages = {};
  const combinations = new Set<string>();
  const skus = new Set<string>();

  product.variants.forEach((variant, index) => {
    const field = `variants.${index}`;
    const fitsOptions =
      variant.optionValues.length === product.options.length &&
      variant.optionValues.every((value, position) =>
        product.options[position]?.values.includes(value),
      );
    if (!fitsOptions) {
      problems[`${field}.optionValues`] =
        product.options.length === 0
          ? "A product without options has one variant with no option values"
          : `Choose one value for each option (${product.options.map((option) => option.name).join(", ")})`;
    }
    const combination = variant.optionValues.join("\u0000");
    if (combinations.has(combination)) {
      problems[`${field}.optionValues`] = `${variantTitle(variant.optionValues)} is listed twice`;
    }
    combinations.add(combination);

    if (variant.sku) {
      if (skus.has(variant.sku)) problems[`${field}.sku`] = "Two variants can't share a SKU";
      skus.add(variant.sku);
    }
    const currencies = variant.prices.map((price) => price.currency);
    if (new Set(currencies).size !== currencies.length) {
      problems[`${field}.prices`] = "Each currency can only have one price";
    }
    if (product.status === "active" && primaryCurrency && !currencies.includes(primaryCurrency)) {
      problems[`${field}.prices`] =
        `Give ${variantTitle(variant.optionValues)} a price in ${primaryCurrency} before making the product active`;
    }
    for (const price of variant.prices) {
      if (price.compareAtAmount !== null && price.compareAtAmount <= price.amount) {
        problems[`${field}.prices`] = "The “compare at” price should be higher than the price";
      }
    }
  });
  return problems;
}

async function checkMedia(
  mediaIds: readonly string[],
  assetExists: AssetExists,
): Promise<FieldMessages> {
  for (const assetId of mediaIds) {
    if (!(await assetExists(assetId))) {
      return { mediaIds: "One of the photos is no longer in the media library" };
    }
  }
  return {};
}
