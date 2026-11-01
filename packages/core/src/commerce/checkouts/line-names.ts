/** "Linen shirt (Blue / M)", or just "Linen shirt" for a product without options. */
export function describeLine(productTitle: string, variantTitle: string): string {
  return variantTitle && variantTitle !== "Default"
    ? `${productTitle} (${variantTitle})`
    : productTitle;
}
