// Copies the component stylesheets into dist/styles beside the compiled code, and joins
// them into dist/styles/site.css for anyone who wants the styles as one file.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { stylesheetFiles } from "../dist/styles/stylesheet-order.js";

const source = new URL("../src/styles/", import.meta.url);
const target = new URL("../dist/styles/", import.meta.url);
mkdirSync(target, { recursive: true });

for (const file of stylesheetFiles) {
  copyFileSync(new URL(file, source), new URL(file, target));
}
const joined = stylesheetFiles.map((file) => readFileSync(new URL(file, source), "utf8"));
writeFileSync(new URL("site.css", target), joined.join("\n"));
