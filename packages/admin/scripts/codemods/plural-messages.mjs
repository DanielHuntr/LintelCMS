/**
 * Turns pairs of ".one"/".other" strings into one ICU plural message, and tCount() calls
 * into t(). Safe to run again: it only changes what still has the old shape.
 *
 *   "entries.count.one": "{count} entry",          "entries.count":
 *   "entries.count.other": "{count} entries",  →     "{count, plural, one {# entry} other {# entries}}",
 *
 *   tCount({ one: "entries.count.one", other: "entries.count.other" }, total)  →  t("entries.count", { count: total })
 *
 * Run from packages/admin: node scripts/codemods/plural-messages.mjs
 */
import { isStringsFile, listSourceFiles, rewriteFiles } from "./source-files.mjs";

const stringLiteral = String.raw`"(?:[^"\\]|\\.)*"`;
const pluralPair = new RegExp(
  String.raw`"([\w.-]+)\.one":\s*(${stringLiteral}),(\s*)"\1\.other":\s*(${stringLiteral}),`,
  "g",
);

export function mergePluralPairs(source) {
  return source.replace(pluralPair, (_match, key, one, spacing, other) => {
    const message = `{count, plural, one {${toPluralText(one)}} other {${toPluralText(other)}}}`;
    return `"${key}": ${JSON.stringify(message)},${spacing.includes("\n") ? "" : ""}`;
  });
}

function toPluralText(literal) {
  return JSON.parse(literal).replaceAll("{count}", "#");
}

/** Finds the end of a call's arguments, allowing for nested brackets in the count. */
function closingBracket(source, start) {
  let depth = 1;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

const tCountStart = /tCount\(\s*\{\s*one:\s*"([\w.-]+)\.one",\s*other:\s*"\1\.other",?\s*\},\s*/g;

export function replaceCountCalls(source) {
  let result = "";
  let position = 0;
  for (const match of source.matchAll(tCountStart)) {
    if (match.index < position) continue;
    const argumentsStart = match.index + match[0].length;
    const end = closingBracket(source, argumentsStart);
    if (end === -1) continue;
    const count = source.slice(argumentsStart, end).trim().replace(/,$/, "").trim();
    result += source.slice(position, match.index);
    result +=
      count === "count" ? `t("${match[1]}", { count })` : `t("${match[1]}", { count: ${count} })`;
    position = end + 1;
  }
  result += source.slice(position);

  // `total === 1 ? t("x.one") : t("x.other", { count: total })`
  result = result.replace(
    /[\w.]+\s*===\s*1\s*\?\s*t\("([\w.-]+)\.one"(?:,\s*\{[^}]*\})?\)\s*:\s*t\("\1\.other",\s*\{\s*count:\s*([^}]+?)\s*\}\)/g,
    (_match, key, count) => `t("${key}", { count: ${count} })`,
  );

  return removeCountImport(result);
}

function removeCountImport(source) {
  if (/\btCount\(/.test(source)) return source;
  return source
    .replace(/(import\s*\{[^}]*?)\s*,\s*tCount\b/g, "$1")
    .replace(/(import\s*\{\s*)tCount\s*,\s*/g, "$1");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = listSourceFiles();
  const strings = rewriteFiles(files.filter(isStringsFile), mergePluralPairs);
  const calls = rewriteFiles(
    files.filter((path) => !isStringsFile(path)),
    replaceCountCalls,
  );
  console.warn(`Plural messages: ${strings} string files and ${calls} other files changed.`);
}
