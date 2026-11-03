// Bundles the elements script and the cookie notice's script, each into one minified file
// that published pages load.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundles = [
  ["site-behaviours-entry.ts", "site-behaviours.js"],
  ["cookie-notice-entry.ts", "cookie-notice.js"],
];

for (const [entry, output] of bundles) {
  await build({
    entryPoints: [fileURLToPath(new URL(`../src/site-behaviours/${entry}`, import.meta.url))],
    outfile: fileURLToPath(new URL(`../dist/${output}`, import.meta.url)),
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    legalComments: "none",
  });
}
