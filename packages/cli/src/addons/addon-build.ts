import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ADDON_MODULES_GLOBAL,
  ADMIN_ADDON_MODULES,
  SERVER_ADDON_MODULES,
} from "@lintel/core/addon-modules";
import { AddonPackageError, readAddonPackage } from "@lintel/core/data-tools";
import type { BuildOptions, Plugin } from "esbuild";
import { CommandError, type Terminal } from "../terminal.js";

/**
 * `lintel addons build`: bundles an add-on's two halves with esbuild, from where the
 * scaffold puts them, into the files its package.json names:
 *
 *   src/server/index.ts            ->  "server" (dist/server.js)
 *   src/admin/index.tsx (or .ts)   ->  "admin"  (dist/admin.js), and its CSS, if it imports any
 *
 * Everything the add-on uses is bundled in, except the modules it must share with Lintel
 * (React, the query client, Zod, Drizzle, the plugin APIs; see addon-module-names.ts in
 * core). Those are read at run time from what Lintel provides, so the built add-on runs
 * in any Lintel without installing anything beside it.
 */

export interface BuildAddonOptions {
  watch: boolean;
  terminal: Terminal;
  /** More folders to find packages in, as NODE_PATH would. Tests use it. */
  nodePaths?: string[];
}

export interface BuiltAddon {
  /** Stops watching; resolves straight away for a one-off build. */
  stop(): Promise<void>;
}

export async function buildAddon(
  addonFolder: string,
  options: BuildAddonOptions,
): Promise<BuiltAddon> {
  const addonPackage = await readAddonPackage(addonFolder).catch((error: unknown) => {
    throw error instanceof AddonPackageError ? new CommandError(error.message) : error;
  });
  const { manifest } = addonPackage;
  const esbuild = await import("esbuild");
  const builds: BuildOptions[] = [];

  const serverEntry = join(addonFolder, "src", "server", "index.ts");
  if (!existsSync(serverEntry)) {
    throw new CommandError(
      `An add-on's server half goes in src/server/index.ts, and ${addonFolder} has none.`,
    );
  }
  builds.push({
    entryPoints: [serverEntry],
    outfile: join(addonFolder, manifest.server),
    platform: "node",
    target: "node22",
    // Bundled packages written for CommonJS may still call require().
    banner: {
      js: 'import { createRequire as lintelCreateRequire } from "node:module"; const require = lintelCreateRequire(import.meta.url);',
    },
    plugins: [shareWithLintel(SERVER_ADDON_MODULES)],
  });

  if (manifest.admin) {
    const adminEntry = ["index.tsx", "index.ts"]
      .map((name) => join(addonFolder, "src", "admin", name))
      .find((path) => existsSync(path));
    if (!adminEntry) {
      throw new CommandError(
        `${addonPackage.packageName} says it has an admin half, but src/admin/index.tsx is missing.`,
      );
    }
    builds.push({
      entryPoints: [adminEntry],
      outfile: join(addonFolder, manifest.admin),
      platform: "browser",
      target: "es2022",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [shareWithLintel(ADMIN_ADDON_MODULES)],
    });
  }

  const shared: BuildOptions = {
    bundle: true,
    format: "esm",
    sourcemap: true,
    logLevel: "warning",
    absWorkingDir: addonFolder,
    nodePaths: options.nodePaths,
  };

  if (!options.watch) {
    for (const build of builds) await esbuild.build({ ...shared, ...build });
    options.terminal.say(`Built ${addonPackage.packageName} ${addonPackage.version}.`);
    return { stop: async () => {} };
  }

  const contexts = await Promise.all(
    builds.map((build) =>
      esbuild.context({
        ...shared,
        ...build,
        plugins: [...(build.plugins ?? []), announceRebuilds(options.terminal, build)],
      }),
    ),
  );
  await Promise.all(contexts.map((context) => context.watch()));
  options.terminal.say(`Watching ${addonPackage.packageName} for changes. Press Ctrl+C to stop.`);
  return {
    stop: async () => {
      await Promise.all(contexts.map((context) => context.dispose()));
    },
  };
}

/**
 * Leaves `moduleNames` out of the bundle: each becomes a small module that hands over
 * Lintel's own copy. esbuild treats it as CommonJS, so named imports
 * (`import { useState } from "react"`) read properties of Lintel's module.
 */
export function shareWithLintel(moduleNames: readonly string[]): Plugin {
  const pattern = new RegExp(`^(${moduleNames.map(escapeForPattern).join("|")})$`);
  return {
    name: "lintel-shared-modules",
    setup(build) {
      build.onResolve({ filter: pattern }, (args) => ({ path: args.path, namespace: "lintel" }));
      build.onLoad({ filter: /.*/, namespace: "lintel" }, (args) => ({
        loader: "js",
        contents: [
          `const modules = globalThis[${JSON.stringify(ADDON_MODULES_GLOBAL)}];`,
          `const name = ${JSON.stringify(args.path)};`,
          "if (!modules || !(name in modules)) {",
          '  throw new Error("This add-on needs " + name + " from Lintel, and this version of Lintel doesn\'t provide it.");',
          "}",
          "module.exports = modules[name];",
        ].join("\n"),
      }));
    },
  };
}

function announceRebuilds(terminal: Terminal, build: BuildOptions): Plugin {
  return {
    name: "lintel-announce-rebuilds",
    setup(pluginBuild) {
      pluginBuild.onEnd((result) => {
        const time = new Date().toLocaleTimeString();
        terminal.say(
          result.errors.length > 0
            ? `${time} ${build.outfile} has errors (above).`
            : `${time} Built ${build.outfile}.`,
        );
      });
    },
  };
}

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
