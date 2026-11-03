import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { REPOSITORY_ROOT } from "../plugins/installed-plugins.js";
import {
  hostingManifest,
  npmDependencies,
  readManifest,
  runtimeWorkspacePackages,
  shippedManifest,
  type WorkspacePackage,
} from "./hosting-package.js";
import { zipFolder } from "./zip-folder.js";

/**
 * `pnpm build:hosting`: makes `dist-hosting/lintel-hosting-<version>.zip`, Lintel ready to
 * upload to hosting with a control panel and install with plain npm. Inside `lintel/`:
 *
 *   app.js, lintel.js, lintel-check.js   the startup file, the commands, the checker
 *   package.json                         npm dependencies only, at the tested versions
 *   packages/core/                       the built server (dist) and its migrations
 *   packages/core/node_modules/@lintel/  the other workspace packages it uses, built
 *   packages/admin/dist/                 the built admin
 *   tmp/                                 where `restart.txt` goes to restart under Passenger
 *
 * The folder layout matches the repository's, so every path Lintel works out from its own
 * files (the admin, migrations, .lintel, .env) is the same. Workspace packages sit in core's
 * own node_modules, which npm leaves alone, and Node finds them there.
 *
 * Run `pnpm build` first (the root `build:hosting` script does).
 */
const OUTPUT_FOLDER = join(REPOSITORY_ROOT, "dist-hosting");
const CORE_FOLDER = join(REPOSITORY_ROOT, "packages", "core");
const ADMIN_BUILD = join(REPOSITORY_ROOT, "packages", "admin", "dist");
const FILES_FOLDER = join(CORE_FOLDER, "src", "hosting", "files");

export async function buildHostingPackage(): Promise<string> {
  const version = lintelVersion();
  const packageFolder = join(OUTPUT_FOLDER, "lintel");
  const zipFile = join(OUTPUT_FOLDER, `lintel-hosting-${version}.zip`);
  if (!existsSync(join(ADMIN_BUILD, "index.html"))) {
    throw new Error("The admin isn't built. Run `pnpm build` first.");
  }

  await rm(OUTPUT_FOLDER, { recursive: true, force: true });
  await mkdir(join(packageFolder, "tmp"), { recursive: true });

  const packages = runtimeWorkspacePackages(CORE_FOLDER, workspaceFolder);
  for (const workspacePackage of packages) {
    const isCore = workspacePackage.folder === CORE_FOLDER;
    const target = isCore
      ? join(packageFolder, "packages", "core")
      : join(packageFolder, "packages", "core", "node_modules", workspacePackage.name);
    await copyBuiltPackage(workspacePackage, target);
  }
  await cp(join(CORE_FOLDER, "migrations"), join(packageFolder, "packages", "core", "migrations"), {
    recursive: true,
  });
  await cp(ADMIN_BUILD, join(packageFolder, "packages", "admin", "dist"), { recursive: true });

  for (const [source, name] of [
    ["app.cjs", "app.js"],
    ["lintel.cjs", "lintel.js"],
    ["lintel-check.cjs", "lintel-check.js"],
    ["lintel-check.php", "lintel-check.php"],
    ["env.example", ".env.example"],
    ["README.txt", "README.txt"],
  ] as const) {
    await cp(join(FILES_FOLDER, source), join(packageFolder, name));
  }
  const dependencies = npmDependencies(packages, installedVersion);
  await writeJson(join(packageFolder, "package.json"), hostingManifest(version, dependencies));

  await zipFolder(packageFolder, zipFile, "lintel");
  // The checkers also go beside the zip, to upload on their own before anything else.
  await cp(join(FILES_FOLDER, "lintel-check.cjs"), join(OUTPUT_FOLDER, "lintel-check.js"));
  await cp(join(FILES_FOLDER, "lintel-check.php"), join(OUTPUT_FOLDER, "lintel-check.php"));
  return zipFile;
}

/** The repository's version, or core's while the repository has none. */
function lintelVersion(): string {
  return readManifest(REPOSITORY_ROOT).version ?? readManifest(CORE_FOLDER).version ?? "0.0.0";
}

function workspaceFolder(name: string, fromFolder: string): string {
  // pnpm links each workspace dependency into the node_modules of the package using it.
  const linked = join(fromFolder, "node_modules", name);
  if (existsSync(join(linked, "package.json"))) return linked;
  throw new Error(`${name} isn't installed. Run \`pnpm install\` first.`);
}

function installedVersion(from: WorkspacePackage, dependency: string): string {
  const manifest = join(from.folder, "node_modules", dependency, "package.json");
  if (!existsSync(manifest)) {
    throw new Error(`${dependency} (used by ${from.name}) isn't installed. Run \`pnpm install\`.`);
  }
  const version = readManifest(join(from.folder, "node_modules", dependency)).version;
  if (!version) throw new Error(`${dependency} has no version in its package.json.`);
  return version;
}

/** The built files only: no TypeScript declarations, source maps or tests. */
async function copyBuiltPackage(workspacePackage: WorkspacePackage, target: string) {
  const built = join(workspacePackage.folder, "dist");
  if (!existsSync(built)) {
    throw new Error(`${workspacePackage.name} isn't built. Run \`pnpm build\` first.`);
  }
  await cp(built, join(target, "dist"), {
    recursive: true,
    dereference: true,
    filter: (source) => !/\.(d\.ts|map|test\.js)$/.test(source),
  });
  await writeJson(join(target, "package.json"), shippedManifest(workspacePackage.manifest));
}

async function writeJson(file: string, value: unknown) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

// Only when run as a script (`pnpm build:hosting`), not when a test imports it.
if (process.argv[1]?.endsWith("build-hosting-package.ts")) {
  const zipFile = await buildHostingPackage();
  const size = (await readFile(zipFile)).length;
  process.stdout.write(`Made ${zipFile} (${(size / 1048576).toFixed(1)} MB)\n`);
}
