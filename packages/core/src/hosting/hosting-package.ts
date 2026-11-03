import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What goes into the shared-hosting package (see build-hosting-package.ts): which
 * workspace packages Lintel needs at run time, which npm packages they need, and the
 * package.json files that describe them, written for plain `npm install`.
 */

export interface WorkspacePackage {
  name: string;
  folder: string;
  manifest: PackageManifest;
}

export interface PackageManifest {
  name: string;
  version?: string;
  type?: string;
  exports?: unknown;
  dependencies?: Record<string, string>;
}

export function readManifest(folder: string): PackageManifest {
  return JSON.parse(readFileSync(join(folder, "package.json"), "utf8")) as PackageManifest;
}

export function isWorkspaceDependency(range: string): boolean {
  return range.startsWith("workspace:");
}

/**
 * Core and every workspace package it depends on, directly or not (the builder, the site
 * components...). `findFolder` says where a workspace package used by another one lives.
 */
export function runtimeWorkspacePackages(
  coreFolder: string,
  findFolder: (name: string, fromFolder: string) => string,
): WorkspacePackage[] {
  const found = new Map<string, WorkspacePackage>();
  const visit = (folder: string) => {
    const manifest = readManifest(folder);
    if (found.has(manifest.name)) return;
    found.set(manifest.name, { name: manifest.name, folder, manifest });
    for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
      if (isWorkspaceDependency(range)) visit(findFolder(name, folder));
    }
  };
  visit(coreFolder);
  return [...found.values()];
}

export class ConflictingDependencyError extends Error {
  constructor(name: string, versions: string[]) {
    super(
      `Lintel's packages use different versions of ${name} (${versions.join(", ")}). ` +
        "The hosting package installs one copy of each, so make them match first.",
    );
    this.name = "ConflictingDependencyError";
  }
}

/**
 * The npm packages to install, at exactly the versions the workspace was tested with.
 * `installedVersion` reads the version installed for a package's dependency.
 */
export function npmDependencies(
  packages: readonly WorkspacePackage[],
  installedVersion: (from: WorkspacePackage, dependency: string) => string,
): Record<string, string> {
  const versions = new Map<string, Set<string>>();
  for (const workspacePackage of packages) {
    for (const [name, range] of Object.entries(workspacePackage.manifest.dependencies ?? {})) {
      if (isWorkspaceDependency(range)) continue;
      const version = installedVersion(workspacePackage, name);
      versions.set(name, (versions.get(name) ?? new Set()).add(version));
    }
  }
  const dependencies: Record<string, string> = {};
  for (const name of [...versions.keys()].sort()) {
    const found = [...(versions.get(name) ?? [])];
    if (found.length > 1) throw new ConflictingDependencyError(name, found);
    dependencies[name] = found[0] ?? "*";
  }
  return dependencies;
}

/**
 * A workspace package's package.json as it ships: only what Node needs to load it. The
 * `development` condition (TypeScript sources) and types are dropped, so every export
 * points at the built file.
 */
export function shippedManifest(manifest: PackageManifest): PackageManifest {
  const shipped: PackageManifest = { name: manifest.name, version: manifest.version ?? "0.0.0" };
  if (manifest.type) shipped.type = manifest.type;
  if (manifest.exports !== undefined) shipped.exports = builtExports(manifest.exports);
  return shipped;
}

function builtExports(exports: unknown): unknown {
  if (typeof exports !== "object" || exports === null) return exports;
  const entries = Object.entries(exports);
  if (entries.every(([key]) => !key.startsWith("."))) {
    // A set of conditions: keep the built file.
    const conditions = Object.fromEntries(entries);
    return conditions.default ?? conditions.import ?? exports;
  }
  return Object.fromEntries(entries.map(([path, target]) => [path, builtExports(target)]));
}

/**
 * The package.json at the top of the hosting package. No "type" (so app.js is CommonJS,
 * which every Passenger version loads), no workspaces, production dependencies only. The
 * scripts are what cPanel's "Run JS script" button offers.
 */
export function hostingManifest(version: string, dependencies: Record<string, string>) {
  return {
    name: "lintel-site",
    version,
    private: true,
    description: "Lintel, ready for hosting with a control panel (cPanel, Plesk) or plain Node.js.",
    main: "app.js",
    engines: { node: ">=22" },
    scripts: {
      start: "node app.js",
      check: "node lintel-check.js",
      doctor: "node lintel.js doctor --hosting",
      cron: "node lintel.js cron",
      "cron-line": "node lintel.js cron --print-line",
    },
    dependencies,
  };
}
