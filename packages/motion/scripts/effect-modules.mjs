// Builds the lazily loaded effect modules: one ES module per file in src/effects/modules,
// with code they share split into chunks, and a manifest the server reads to find them.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
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

const require = createRequire(import.meta.url);

const fingerprinted = (name, contents) => {
  const fingerprint = createHash("sha256").update(contents).digest("hex").slice(0, 8);
  const dot = name.lastIndexOf(".");
  return { name, file: `${name.slice(0, dot)}-${fingerprint}${name.slice(dot)}`, contents };
};

/** The Lottie and Rive players (src/effects/players), each bundled whole into one file. */
async function buildPlayers() {
  const players = ["lottie-player", "rive-player"];
  return Promise.all(
    players.map(async (name) => {
      const result = await build({
        entryPoints: [fileURLToPath(new URL(`../src/effects/players/${name}.ts`, import.meta.url))],
        bundle: true,
        minify: true,
        format: "esm",
        target: "es2020",
        legalComments: "none",
        write: false,
        outfile: `${name}.js`,
        logLevel: "silent",
      });
      return fingerprinted(`${name}.js`, Buffer.from(result.outputFiles[0].contents));
    }),
  );
}

/**
 * Files served beside the modules rather than bundled with them: the players, the Lottie and
 * Rive samples (made by samples/make-sample-*.mjs) and Rive's WebAssembly. Each gets a
 * fingerprint in its name, and the modules find them through `__LINTEL_EFFECT_FILES__`
 * (see kit/media-player.ts). Kept apart so the modules' shared chunks never change for them.
 */
export async function besideModuleFiles() {
  const sources = {
    "sample-hop.json": fileURLToPath(new URL("../samples/sample-hop.json", import.meta.url)),
    "sample-orbit.riv": fileURLToPath(new URL("../samples/sample-orbit.riv", import.meta.url)),
    "rive.wasm": require.resolve("@rive-app/canvas-lite/rive.wasm"),
  };
  return [
    ...(await buildPlayers()),
    ...Object.entries(sources).map(([name, path]) => fingerprinted(name, readFileSync(path))),
  ];
}

/** What each module's player costs a page, gzipped: { lottie: 48912, rive: 410628 }. */
export function effectPlayerSizes(beside, gzip) {
  const size = (name) => gzip(beside.find((file) => file.name === name).contents).byteLength;
  return {
    lottie: size("lottie-player.js"),
    rive: size("rive-player.js") + size("rive.wasm"),
  };
}

/**
 * Bundles the modules. With `outdir` it writes them; either way it returns the manifest:
 * each module's file and what it costs a page (gzipped, with the shared chunks it imports).
 */
export async function buildEffectModules({ outdir } = {}) {
  const beside = await besideModuleFiles();
  const result = await build({
    define: {
      __LINTEL_EFFECT_FILES__: JSON.stringify(
        Object.fromEntries(beside.map(({ name, file }) => [name, file])),
      ),
    },
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
    files: [
      ...Object.keys(result.metafile.outputs).map((path) => path.split("/").pop()),
      ...beside.map(({ file }) => file),
    ],
    beside,
  };
}
