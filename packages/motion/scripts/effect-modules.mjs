// Builds the lazily loaded effect modules: one ES module per file in src/effects/modules,
// with code they share split into chunks, and a manifest the server reads to find them.
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const modulesFolder = fileURLToPath(new URL("../src/effects/modules/", import.meta.url));

export function effectModuleEntries() {
  return Object.fromEntries(
    readdirSync(modulesFolder)
      .filter((file) => file.endsWith(".module.ts"))
      .map((file) => [file.replace(".module.ts", ""), `${modulesFolder}${file}`]),
  );
}

/**
 * Bundles the modules. With `outdir` it writes them; either way it returns the manifest:
 * each module's file and what it costs a page (gzipped, with the shared chunks it imports).
 */
export async function buildEffectModules({ outdir } = {}) {
  const result = await build({
    entryPoints: effectModuleEntries(),
    bundle: true,
    splitting: true,
    minify: true,
    format: "esm",
    target: "es2020",
    legalComments: "none",
    entryNames: "[name]-[hash]",
    chunkNames: "shared-[hash]",
    outdir: outdir ?? "/virtual-effects",
    write: Boolean(outdir),
    metafile: true,
  });
  const gzipped = new Map();
  const sizeOf = (path) => {
    if (!gzipped.has(path)) {
      const file = result.outputFiles?.find((output) =>
        output.path.endsWith(path.split("/").pop()),
      );
      const text = file ? file.text : null;
      gzipped.set(
        path,
        text === null ? result.metafile.outputs[path].bytes : gzipSync(text).byteLength,
      );
    }
    return gzipped.get(path);
  };
  const modules = {};
  for (const [path, output] of Object.entries(result.metafile.outputs)) {
    if (!output.entryPoint) continue;
    const name = output.entryPoint.split("/").pop().replace(".module.ts", "");
    const seen = new Set([path]);
    const queue = [path];
    while (queue.length) {
      for (const imported of result.metafile.outputs[queue.shift()].imports) {
        if (imported.kind === "import-statement" && !seen.has(imported.path)) {
          seen.add(imported.path);
          queue.push(imported.path);
        }
      }
    }
    modules[name] = {
      file: path.split("/").pop(),
      gzipBytes: [...seen].reduce((total, file) => total + sizeOf(file), 0),
    };
  }
  return {
    modules,
    files: Object.keys(result.metafile.outputs).map((path) => path.split("/").pop()),
  };
}
