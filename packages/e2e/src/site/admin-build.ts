import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { API_PREFIX } from "./admin-server.js";

/**
 * The tests run against a production build of the admin, not the dev server, so they see
 * what people get. It is built with VITE_API_URL=/api (see admin-server.ts) into
 * packages/e2e/.admin-build, and only rebuilt when the admin or the help pages changed.
 */

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
export const adminBuildFolder = join(repositoryRoot, "packages/e2e/.admin-build");
const stampFile = join(adminBuildFolder, ".source-time");

/** What the admin build is made from. A change to any of these needs a new build. */
const sources = [
  "packages/admin/src",
  "packages/admin/public",
  "packages/admin/index.html",
  "packages/admin/vite.config.ts",
  "packages/docs/src",
  "packages/core/dist",
].map((path) => join(repositoryRoot, path));

export function buildAdminIfChanged(): void {
  const sourceTime = String(Math.max(...sources.map(newestChangeIn)));
  const builtFrom = existsSync(stampFile) ? readFileSync(stampFile, "utf8") : "";
  if (builtFrom === sourceTime && existsSync(join(adminBuildFolder, "index.html"))) {
    return;
  }

  const result = spawnSync(
    "pnpm",
    [
      "--filter",
      "@lintel/admin",
      "exec",
      "vite",
      "build",
      "--outDir",
      adminBuildFolder,
      "--emptyOutDir",
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, VITE_API_URL: API_PREFIX },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  if (result.status !== 0) {
    throw new Error("Building the admin for the browser tests failed (see the output above).");
  }
  writeFileSync(stampFile, sourceTime);
}

function newestChangeIn(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }
  const stats = statSync(path);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }
  return Math.max(
    stats.mtimeMs,
    ...readdirSync(path).map((name) => newestChangeIn(join(path, name))),
  );
}
