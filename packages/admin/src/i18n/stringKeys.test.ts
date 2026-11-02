import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFolder = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every strings file: `i18n/strings.ts` and the feature files it spreads in. */
function stringFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return stringFiles(path);
    return /^(strings|\w+Strings)\.ts$/.test(entry.name) ? [path] : [];
  });
}

// Two files used the same key, and whichever was spread in last won: Account said "Create
// your account", and an automation's review section said "Check your details".
describe("admin strings", () => {
  it("never uses the same key in two places", () => {
    const placesByKey = new Map<string, string[]>();
    for (const file of stringFiles(sourceFolder)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/^ {2}"([^"]+)":/gm)) {
        const key = match[1] ?? "";
        const where = relative(sourceFolder, file).split("\\").join("/");
        placesByKey.set(key, [...(placesByKey.get(key) ?? []), where]);
      }
    }

    const repeated = [...placesByKey].filter(([, places]) => places.length > 1);
    expect(Object.fromEntries(repeated)).toEqual({});
  });
});
