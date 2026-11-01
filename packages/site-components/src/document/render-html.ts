import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * React writes a few attributes in its own camel case (`srcSet`, `dateTime`). Browsers
 * don't mind, but people reading or editing the HTML expect the usual lower case, and the
 * page builder's code view and HTML parser rely on one spelling. Only attribute names are
 * touched: React escapes quotes in text, so `name="` never appears outside a tag.
 */
const camelCaseAttributes = [
  "charSet",
  "srcSet",
  "imageSrcSet",
  "imageSizes",
  "fetchPriority",
  "dateTime",
  "hrefLang",
  "crossOrigin",
];

const attributePattern = new RegExp(` (${camelCaseAttributes.join("|")})="`, "g");

export function lowerCaseAttributes(markup: string): string {
  return markup.replace(attributePattern, (_match, name: string) => ` ${name.toLowerCase()}="`);
}

/**
 * A component's HTML exactly as the site sends it: static markup (no React markers, no
 * script) with attribute names in lower case. The same props always give the same HTML.
 */
export function renderComponentHtml(element: ReactElement): string {
  return lowerCaseAttributes(renderToStaticMarkup(element));
}
