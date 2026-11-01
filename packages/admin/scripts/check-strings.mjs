/**
 * Reports on the admin's strings:
 *
 *   - unused:   English keys nothing in src/ refers to any more
 *   - missing:  keys a translation in src/i18n/catalogues/ doesn't have yet (shown in English)
 *   - stale:    keys a translation has that English no longer does
 *   - mismatch: translations whose {placeholders} differ from the English
 *
 * Run from the repository root:  pnpm --filter @lintel/admin strings:check
 * Add --verbose to list every missing key. Exits with 1 when something is unused, stale
 * or mismatched (missing translations are normal while a language is being worked on).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  adminFolder,
  isStringsFile,
  listSourceFiles,
  sourceFolder,
} from "./codemods/source-files.mjs";

const verbose = process.argv.includes("--verbose");
const keyAndValue = /^\s*"([\w.-]+)":\s*("(?:[^"\\]|\\.)*")/gm;

export function readEnglish(files) {
  const english = new Map();
  for (const path of files) {
    for (const [, key, literal] of readFileSync(path, "utf8").matchAll(keyAndValue)) {
      english.set(key, JSON.parse(literal));
    }
  }
  return english;
}

export function placeholders(message) {
  return [...new Set([...message.matchAll(/\{\s*(\w+)/g)].map((match) => match[1]))].sort();
}

/**
 * A key counts as used when its name appears in quotes anywhere in the code, or when the
 * code builds keys from a prefix, as in t(`help.${topic}`).
 */
export function findUnusedKeys(english, codeFiles) {
  const code = codeFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  const builtPrefixes = [...code.matchAll(/[`"']([\w.-]+\.)\$\{/g)].map((match) => match[1]);
  return [...english.keys()].filter(
    (key) => !code.includes(`"${key}"`) && !builtPrefixes.some((prefix) => key.startsWith(prefix)),
  );
}

function checkCatalogue(path, english) {
  const translation = JSON.parse(readFileSync(path, "utf8"));
  const missing = [...english.keys()].filter((key) => !(key in translation));
  const stale = Object.keys(translation).filter((key) => !english.has(key));
  const mismatched = Object.entries(translation).filter(
    ([key, message]) =>
      english.has(key) && placeholders(message).join() !== placeholders(english.get(key)).join(),
  );
  return { missing, stale, mismatched: mismatched.map(([key]) => key) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = listSourceFiles();
  const english = readEnglish(files.filter(isStringsFile));
  const unused = findUnusedKeys(
    english,
    files.filter(
      (path) => !isStringsFile(path) && !path.endsWith(".test.tsx") && !path.endsWith(".test.ts"),
    ),
  );
  let problems = unused.length;

  console.warn(`${english.size} English strings.`);
  if (unused.length > 0) {
    console.warn(`\nUnused (${unused.length}): remove them, or use them:`);
    for (const key of unused) console.warn(`  ${key}`);
  }

  const catalogueFolder = join(sourceFolder, "i18n", "catalogues");
  const catalogues = existsSync(catalogueFolder)
    ? readdirSync(catalogueFolder).filter((name) => name.endsWith(".json"))
    : [];
  if (catalogues.length === 0)
    console.warn("\nNo translations yet (src/i18n/catalogues is empty).");

  for (const name of catalogues) {
    const path = join(catalogueFolder, name);
    const { missing, stale, mismatched } = checkCatalogue(path, english);
    const done = Math.round(((english.size - missing.length) / english.size) * 100);
    console.warn(
      `\n${relative(adminFolder, path)}: ${done}% translated, ${missing.length} missing.`,
    );
    if (verbose) for (const key of missing) console.warn(`  missing  ${key}`);
    for (const key of stale) console.warn(`  stale    ${key}`);
    for (const key of mismatched)
      console.warn(`  mismatch ${key}: use ${placeholders(english.get(key)).join(", ")}`);
    problems += stale.length + mismatched.length;
  }

  process.exitCode = problems > 0 ? 1 : 0;
}
