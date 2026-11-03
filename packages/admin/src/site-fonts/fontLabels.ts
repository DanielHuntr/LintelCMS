import { type StringKey, t } from "../i18n/strings.js";
import type { FontCategory, FontStyle, SiteFont } from "./siteFonts.api.js";

/** Plain names for weights, kinds and sources, as the font screens show them. */

export const fontWeights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
export const fontCategories: FontCategory[] = ["sans", "serif", "display", "script", "mono"];

export function weightName(weight: string): string {
  return fontWeights.includes(weight) ? t(`siteFonts.weight.${weight}` as StringKey) : weight;
}

export function styleName(style: FontStyle): string {
  return t(`siteFonts.style.${style}`);
}

export function categoryName(category: FontCategory): string {
  return t(`siteFonts.category.${category}`);
}

export function sourceName(source: SiteFont["source"]): string {
  return t(`siteFonts.source.${source}`);
}

/** "Regular, Bold, with italics". */
export function describeWeights(weights: readonly string[], hasItalic: boolean): string {
  const names = weights.map(weightName).join(", ");
  return t(hasItalic ? "siteFonts.weightsItalic" : "siteFonts.weights", { weights: names });
}

/** What the CSS fallback is for each kind, so previews look right while the font loads. */
export const fallbackFor: Record<FontCategory, string> = {
  sans: "system-ui, sans-serif",
  serif: "Georgia, serif",
  display: "system-ui, sans-serif",
  script: "cursive",
  mono: "ui-monospace, monospace",
};
