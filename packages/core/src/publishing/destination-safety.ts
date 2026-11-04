import { lookup } from "node:dns/promises";
import { realpath } from "node:fs/promises";
import { isIP } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { bareHostname, isLocalHostName, isPrivateAddress } from "../webhooks/address-safety.js";
import { PrivateDestinationError, UnsafeFolderError } from "./publishing.errors.js";
import type { PublishTargetOptions, PublishTargetRow } from "./publishing.table.js";

/**
 * Where publishing may go. A destination is a request the server makes, and writes files for,
 * so it gets the care webhooks and apps get (src/webhooks/address-safety.ts): no private or
 * local addresses from a live site, or anyone who can change settings could point the server
 * at its own network. A site that is itself on someone's computer or office network may use
 * them: that's where its hosting is.
 *
 * "Folder on this server" writes straight to the disk, so it can't be pointed at Lintel's own
 * folders or the system's.
 */

export interface DestinationRules {
  /** The site itself is local, or the server allows it (WEBHOOKS_ALLOW_PRIVATE_ADDRESSES). */
  allowPrivateAddresses: boolean;
  /** Where Lintel keeps its program and its data. */
  lintelFolders: string[];
}

type Resolve = (hostname: string) => Promise<string[]>;

const resolveAddresses: Resolve = async (hostname) =>
  (await lookup(hostname, { all: true })).map((found) => found.address);

/**
 * A name that doesn't resolve is let through: connecting will fail with a better message. Node
 * looks the name up again to connect, so this can't stop a name changing in that moment.
 */
export async function checkRemoteAddress(
  host: string,
  rules: Pick<DestinationRules, "allowPrivateAddresses">,
  resolve: Resolve = resolveAddresses,
): Promise<void> {
  if (rules.allowPrivateAddresses || host === "") return;
  const bare = host.replace(/^\[(.*)\]$/, "$1");
  if (isLocalHostName(bare)) throw new PrivateDestinationError(host);
  if (isIP(bare) !== 0) {
    if (isPrivateAddress(bare)) throw new PrivateDestinationError(host);
    return;
  }
  const addresses = await resolve(bare).catch(() => []);
  if (addresses.some(isPrivateAddress)) throw new PrivateDestinationError(host);
}

function hostOf(address: string | undefined): string {
  if (!address) return "";
  try {
    return bareHostname(new URL(address));
  } catch {
    return "";
  }
}

/** Every address a destination's settings would make the server reach. */
export async function checkDestinationAddresses(
  kind: PublishTargetRow["kind"],
  options: PublishTargetOptions,
  rules: DestinationRules,
): Promise<void> {
  if (kind === "ftp" || kind === "sftp") await checkRemoteAddress(options.host ?? "", rules);
  if (kind === "s3") await checkRemoteAddress(hostOf(options.endpoint), rules);
  await checkRemoteAddress(hostOf(options.siteAddress), rules);
}

/** Never written to, nor anything inside them. */
const systemFolders: Record<"posix" | "win32", string[]> = {
  posix: [
    "/bin",
    "/boot",
    "/dev",
    "/etc",
    "/lib",
    "/lib64",
    "/proc",
    "/root",
    "/run",
    "/sbin",
    "/sys",
    "/usr",
    "/var/lib",
    "/var/log",
    "/var/run",
    "/var/spool",
    "/Library",
    "/System",
  ],
  win32: [
    process.env.SystemRoot ?? "C:\\Windows",
    process.env.ProgramFiles ?? "C:\\Program Files",
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    process.env.ProgramData ?? "C:\\ProgramData",
  ],
};

/** Too wide to publish straight into, though a folder inside them is fine. */
const wideFolders = ["/home", "/mnt", "/opt", "/srv", "/tmp", "/var", "/Users", "/Volumes"];

/** The folder as it really is, through any links, whether or not all of it exists yet. */
async function realFolder(folder: string, paths: typeof path.posix): Promise<string> {
  const missing: string[] = [];
  let current = folder;
  for (;;) {
    try {
      return paths.join(await realpath(current), ...missing);
    } catch {
      const parent = paths.dirname(current);
      if (parent === current) return folder;
      missing.unshift(paths.basename(current));
      current = parent;
    }
  }
}

export async function checkFolderIsSafe(
  folder: string,
  rules: Pick<DestinationRules, "lintelFolders">,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const isWindows = platform === "win32";
  const paths = isWindows ? path.win32 : path.posix;
  const onThisSystem = platform === process.platform;
  const resolved = paths.resolve(folder);
  const real = onThisSystem ? await realFolder(resolved, paths) : resolved;
  const same = (text: string) => (isWindows ? text.toLowerCase() : text);
  const isInside = (child: string, parent: string) => {
    const reach = paths.relative(same(parent), same(child));
    return reach === "" || (!reach.startsWith("..") && !paths.isAbsolute(reach));
  };

  const home = homedir();
  const refusedInside = [
    ...systemFolders[isWindows ? "win32" : "posix"],
    ...(onThisSystem ? [paths.join(home, ".ssh")] : []),
  ];
  const refusedExactly = [...(isWindows ? [] : wideFolders), ...(onThisSystem ? [home] : [])];
  const isDriveRoot = paths.dirname(real) === real;
  if (
    isDriveRoot ||
    refusedInside.some((system) => isInside(real, system)) ||
    refusedExactly.some((wide) => same(wide) === same(real))
  ) {
    throw new UnsafeFolderError(folder, "it belongs to the system");
  }
  // The companion's private folder goes beside the website, so its parent counts too.
  const writesTo = [real, paths.dirname(real)];
  for (const lintel of rules.lintelFolders) {
    const own = onThisSystem ? await realFolder(paths.resolve(lintel), paths) : lintel;
    if (writesTo.some((place) => isInside(place, own)) || isInside(own, real)) {
      throw new UnsafeFolderError(folder, "Lintel keeps its own files there");
    }
  }
}

/** Everything about a destination that must pass before it is saved or used. */
export async function checkDestination(
  target: Pick<PublishTargetRow, "kind" | "options">,
  rules: DestinationRules | undefined,
): Promise<void> {
  if (!rules) return;
  await checkDestinationAddresses(target.kind, target.options, rules);
  if (target.kind === "folder" && target.options.folderPath) {
    await checkFolderIsSafe(target.options.folderPath, rules);
  }
}
