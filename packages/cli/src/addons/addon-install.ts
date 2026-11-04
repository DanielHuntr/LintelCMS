import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  type AddonPackage,
  AddonPackageError,
  type AddonsList,
  describeAddonForReview,
  installedPackageFolder,
  isVersionInRange,
  prepareAddonsFolder,
  readAddonPackage,
  readAddonsList,
  writeAddonsList,
} from "@lintel/core/data-tools";
import { CommandError, formatTable, type Terminal } from "../terminal.js";
import { breaksItsPromise, readAddonBundleForMysql } from "./addon-check.js";

/**
 * Installing add-ons into a site's add-ons folder (see packages/core/src/addons): npm does
 * the installing, in the folder's own package.json; this keeps lintel-addons.json in step
 * and checks each package is an add-on that works with this Lintel before keeping it.
 */

/** Runs npm in a folder and says whether it worked. Tests pass their own. */
export type NpmRunner = (folder: string, npmArguments: readonly string[]) => boolean;

export const runNpm: NpmRunner = (folder, npmArguments) => {
  const result = spawnSync("npm", [...npmArguments], {
    cwd: folder,
    stdio: "inherit",
    // npm is npm.cmd on Windows, which only runs through a shell.
    shell: process.platform === "win32",
  });
  return result.status === 0;
};

export interface AddonsContext {
  folder: string;
  lintelVersion: string;
  npm: NpmRunner;
  terminal: Terminal;
}

const RESTART = "Restart Lintel to start using it.";

/** `lintel addons add <package>`: install it and switch it on at the next start. */
export async function addAddon(
  context: AddonsContext,
  specifier: string,
  options: { switchOn: boolean },
): Promise<AddonPackage> {
  const { folder, npm, terminal } = context;
  await prepareAddonsFolder(folder);
  const before = readDependencies(folder);
  const installArguments = [
    "install",
    specifier,
    "--save",
    "--omit=dev",
    "--no-audit",
    "--no-fund",
  ];
  if (!npm(folder, installArguments)) {
    throw new CommandError(`npm couldn't install ${specifier}. Its message is above.`);
  }
  const packageName = findInstalledName(before, readDependencies(folder), specifier);
  let addonPackage: AddonPackage;
  try {
    addonPackage = await readAddonPackage(installedPackageFolder(folder, packageName));
    checkCompatible(addonPackage, context.lintelVersion);
  } catch (error) {
    npm(folder, ["uninstall", packageName, "--no-audit", "--no-fund"]);
    throw asCommandError(error);
  }
  const list = await readAddonsList(folder);
  await writeAddonsList(folder, {
    ...list,
    packages: withItem(list.packages, packageName),
    enableOnStart: options.switchOn
      ? withItem(list.enableOnStart, addonPackage.manifest.id)
      : list.enableOnStart,
  });
  terminal.say(`Added ${packageName} ${addonPackage.version}.`);
  for (const line of describeAddonForReview(addonPackage)) terminal.say(line);
  warnIfNotPortable(addonPackage, terminal);
  terminal.say(
    options.switchOn
      ? `${RESTART} It will be switched on.`
      : `${RESTART} Switch it on in Settings → Add-ons.`,
  );
  return addonPackage;
}

/** Sites on Postgres are fine either way, so this warns rather than refuses. */
function warnIfNotPortable(addonPackage: AddonPackage, terminal: Terminal): void {
  const serverFile = join(addonPackage.folder, addonPackage.manifest.server);
  if (addonPackage.dataOnly || !existsSync(serverFile)) return;
  const found = readAddonBundleForMysql(serverFile);
  if (!breaksItsPromise(found)) return;
  terminal.warn(`${addonPackage.packageName} may fail on MySQL and MariaDB:`);
  for (const problem of found.problems) terminal.warn(`  ${problem}`);
}

/**
 * `lintel addons remove <package or id>`: uninstall it. Its data stays in the database;
 * Build → Add-ons can export it, or delete it, first.
 */
export async function removeAddon(context: AddonsContext, nameOrId: string): Promise<void> {
  const { folder, npm, terminal } = context;
  const list = await readAddonsList(folder);
  const packageName = await findListedPackage(folder, list, nameOrId);
  if (!packageName) {
    throw new CommandError(
      `There's no add-on called "${nameOrId}" installed. See them with lintel addons list.`,
    );
  }
  const id = (await readAddonPackage(installedPackageFolder(folder, packageName)).catch(() => null))
    ?.manifest.id;
  if (!npm(folder, ["uninstall", packageName, "--no-audit", "--no-fund"])) {
    throw new CommandError(`npm couldn't remove ${packageName}. Its message is above.`);
  }
  await writeAddonsList(folder, {
    ...list,
    packages: list.packages.filter((name) => name !== packageName),
    enableOnStart: list.enableOnStart.filter((enabledId) => enabledId !== id),
  });
  terminal.say(`Removed ${packageName}. ${RESTART.replace("using it", "without it")}`);
  terminal.say("Anything it saved stays in the database, in case you add it again.");
}

/** `lintel addons link <folder>`: use an add-on straight from a folder being worked on. */
export async function linkAddon(context: AddonsContext, addonFolder: string): Promise<void> {
  if (!isAbsolute(addonFolder)) throw new Error("Link with an absolute path.");
  const addonPackage = await readAddonPackage(addonFolder).catch((error: unknown) => {
    throw asCommandError(error);
  });
  const list = await readAddonsList(context.folder);
  await writeAddonsList(context.folder, {
    ...list,
    linked: withItem(list.linked, addonFolder),
    enableOnStart: withItem(list.enableOnStart, addonPackage.manifest.id),
  });
  context.terminal.say(`Linked ${addonPackage.packageName} from ${addonFolder}.`);
  context.terminal.say(
    `Build it with lintel addons build --watch in that folder, then restart Lintel. ` +
      "After that, restart Lintel whenever its server half changes; the admin picks up changes when you reload.",
  );
}

/** `lintel addons unlink <folder or id>` */
export async function unlinkAddon(context: AddonsContext, folderOrId: string): Promise<void> {
  const list = await readAddonsList(context.folder);
  const linked: string[] = [];
  for (const path of list.linked) {
    const id = (await readAddonPackage(path).catch(() => null))?.manifest.id;
    if (path === folderOrId || id === folderOrId) linked.push(path);
  }
  if (linked.length === 0) {
    throw new CommandError(`No linked add-on is called "${folderOrId}".`);
  }
  await writeAddonsList(context.folder, {
    ...list,
    linked: list.linked.filter((path) => !linked.includes(path)),
  });
  context.terminal.say(
    `Unlinked ${linked.join(", ")}. ${RESTART.replace("using it", "without it")}`,
  );
}

/** `lintel addons list` */
export async function listAddons(context: AddonsContext): Promise<void> {
  const { folder, terminal } = context;
  const list = await readAddonsList(folder);
  const sources = [
    ...list.packages.map((name) => ({ name, path: installedPackageFolder(folder, name) })),
    ...list.linked.map((path) => ({ name: path, path })),
  ];
  if (sources.length === 0) {
    terminal.say("No add-ons are installed. Add one with lintel addons add <package>.");
    return;
  }
  const rows: string[][] = [["Add-on", "Version", "Id", "Works with this Lintel"]];
  for (const source of sources) {
    const addonPackage = existsSync(source.path)
      ? await readAddonPackage(source.path).catch(() => null)
      : null;
    rows.push(
      addonPackage
        ? [
            addonPackage.packageName,
            addonPackage.version,
            addonPackage.manifest.id,
            isVersionInRange(context.lintelVersion, addonPackage.manifest.lintel)
              ? "yes"
              : `no (needs ${addonPackage.manifest.lintel})`,
          ]
        : [source.name, "", "", "can't be read"],
    );
  }
  for (const line of formatTable(rows)) terminal.say(line);
}

function checkCompatible(addonPackage: AddonPackage, lintelVersion: string): void {
  const { manifest, packageName, version } = addonPackage;
  if (!isVersionInRange(lintelVersion, manifest.lintel)) {
    throw new CommandError(
      `${packageName} ${version} works with Lintel ${manifest.lintel}, and this is Lintel ${lintelVersion}, so it wasn't added.`,
    );
  }
}

function readDependencies(folder: string): Record<string, string> {
  const file = `${folder}/package.json`;
  if (!existsSync(file)) return {};
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  const dependencies =
    typeof parsed === "object" && parsed !== null && "dependencies" in parsed
      ? parsed.dependencies
      : undefined;
  return typeof dependencies === "object" && dependencies !== null
    ? (dependencies as Record<string, string>)
    : {};
}

/**
 * The package npm just installed: the dependency that is new or changed, or, when it was
 * already there, the name in what was typed ("@acme/swatches@2" → "@acme/swatches").
 */
export function findInstalledName(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
  specifier: string,
): string {
  const changed = Object.keys(after).filter((name) => before[name] !== after[name]);
  if (changed.length === 1 && changed[0]) return changed[0];
  const versionAt = specifier.indexOf("@", specifier.startsWith("@") ? 1 : 0);
  const name = versionAt > 0 ? specifier.slice(0, versionAt) : specifier;
  if (name in after) return name;
  throw new CommandError(
    `npm installed ${specifier}, but Lintel can't tell which package it was. Add it by its package name.`,
  );
}

async function findListedPackage(
  folder: string,
  list: AddonsList,
  nameOrId: string,
): Promise<string | undefined> {
  if (list.packages.includes(nameOrId)) return nameOrId;
  for (const name of list.packages) {
    const addonPackage = await readAddonPackage(installedPackageFolder(folder, name)).catch(
      () => null,
    );
    if (addonPackage?.manifest.id === nameOrId) return name;
  }
  return undefined;
}

function withItem(list: readonly string[], item: string): string[] {
  return list.includes(item) ? [...list] : [...list, item];
}

function asCommandError(error: unknown): Error {
  if (error instanceof AddonPackageError) return new CommandError(error.message);
  return error instanceof Error ? error : new Error(String(error));
}
