// Bundles the elements script into one minified file that published pages load.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
  entryPoints: [
    fileURLToPath(new URL("../src/site-behaviours/site-behaviours-entry.ts", import.meta.url)),
  ],
  outfile: fileURLToPath(new URL("../dist/site-behaviours.js", import.meta.url)),
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  legalComments: "none",
});
