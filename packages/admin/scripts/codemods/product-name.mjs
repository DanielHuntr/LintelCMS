/**
 * Replaces the word "Lintel" in English strings with {product}, so the admin says the
 * agency's name when it's branded. Leaves alone "Lintel-Signature" (a header name) and
 * the Branding screen's own strings, which are about Lintel itself. Safe to run again.
 *
 * Run from packages/admin: node scripts/codemods/product-name.mjs
 */
import { isStringsFile, listSourceFiles, rewriteFiles } from "./source-files.mjs";

/** Keys whose strings name Lintel on purpose. */
const keepsLintelPrefixes = ["branding.", "interfaceLanguage."];

const keyAndValue = /"([\w.-]+)":(\s*)("(?:[^"\\]|\\.)*")/g;

export function useProductName(source) {
  return source.replace(keyAndValue, (match, key, spacing, literal) => {
    if (keepsLintelPrefixes.some((prefix) => key.startsWith(prefix))) return match;
    const value = JSON.parse(literal);
    const changed = value.replace(/\bLintel\b(?![-\w])/g, "{product}");
    return changed === value ? match : `"${key}":${spacing}${JSON.stringify(changed)}`;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const changed = rewriteFiles(listSourceFiles().filter(isStringsFile), useProductName);
  console.warn(`Product name: ${changed} string files changed.`);
}
