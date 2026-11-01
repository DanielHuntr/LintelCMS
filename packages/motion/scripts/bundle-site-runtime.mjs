// Bundles the site runtime into one minified file that published pages load.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
  entryPoints: [
    fileURLToPath(new URL("../src/site-runtime/site-runtime-entry.ts", import.meta.url)),
  ],
  outfile: fileURLToPath(new URL("../dist/site-runtime.js", import.meta.url)),
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  legalComments: "none",
});
