import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Shared by the codemods: where the admin's source and its string lists are. */

export const adminFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const sourceFolder = join(adminFolder, "src");

export function listSourceFiles(folder = sourceFolder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((item) => {
    const path = join(folder, item.name);
    if (item.isDirectory()) return item.name === "node_modules" ? [] : listSourceFiles(path);
    return /\.(ts|tsx)$/.test(item.name) ? [path] : [];
  });
}

/** strings.ts and every other list of English strings (contentModelStrings.ts, forms.strings.ts…). */
export function isStringsFile(path) {
  const name = path.split(/[/\\]/).pop() ?? "";
  return (
    (path.includes(`${join("src", "i18n")}`) && /strings\.ts$/i.test(name)) ||
    /(Strings|\.strings)\.ts$/.test(name)
  );
}

/** Rewrites each file with `change`, and lists the ones that changed. */
export function rewriteFiles(paths, change) {
  let changedCount = 0;
  for (const path of paths) {
    const before = readFileSync(path, "utf8");
    const after = change(before, path);
    if (after !== before) {
      writeFileSync(path, after);
      changedCount += 1;
      console.warn(`  changed ${relative(adminFolder, path)}`);
    }
  }
  return changedCount;
}
