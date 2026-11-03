import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { readReleaseManifest, versionFolder, versionsFolder } from "./install-home.js";
import {
  parseChecksumFile,
  ReleaseSignatureError,
  requireChecksum,
  verifyMinisignSignature,
} from "./release-signature.js";
import type { AvailableRelease, ReleaseAsset } from "./updates.schema.js";

/**
 * Getting a release onto disk for the supervisor: download its build for this computer,
 * check it against the signed checksum file, and unpack it into versions/<version>.
 *
 * A release has, attached:
 *   lintel-<version>-<platform>-<arch>.tar.gz   the built Lintel (see scripts/release)
 *   SHA256SUMS                                  "<sha-256>  <file name>" for each build
 *   SHA256SUMS.minisig                          SHA256SUMS signed with the release key
 *
 * <platform>-<arch> is Node's: linux-x64, linux-arm64, darwin-arm64, win32-x64...
 */

export const CHECKSUM_FILE = "SHA256SUMS";
export const SIGNATURE_FILE = "SHA256SUMS.minisig";

export function buildFileName(
  version: string,
  platform: string = process.platform,
  arch: string = process.arch,
) {
  return `lintel-${version}-${platform}-${arch}.tar.gz`;
}

export class ReleaseBuildMissingError extends Error {
  constructor(version: string, fileName: string) {
    super(
      `Lintel ${version} has no build for this server (${fileName} isn't attached to the ` +
        "release), so it can't be installed with the Update button.",
    );
    this.name = "ReleaseBuildMissingError";
  }
}

export class DownloadFailedError extends Error {
  constructor(fileName: string, reason: string) {
    super(`Downloading ${fileName} didn't work (${reason}). Nothing was changed. Try again later.`);
    this.name = "DownloadFailedError";
  }
}

export class UnpackFailedError extends Error {
  constructor(reason: string) {
    super(`The new version couldn't be unpacked (${reason}). Nothing was changed.`);
    this.name = "UnpackFailedError";
  }
}

export interface ReleaseDownloadContext {
  home: string;
  publicKey: string;
  fetch: typeof fetch;
  /** Unpacks a .tar.gz into a folder. Defaults to the system's `tar`. */
  unpack?: (archive: string, into: string) => Promise<void>;
  onProgress?: (step: "downloading" | "verifying" | "unpacking", fraction: number | null) => void;
  platform?: string;
  arch?: string;
}

/** Downloads, checks and unpacks `release`; resolves with its folder under versions/. */
export async function prepareRelease(
  context: ReleaseDownloadContext,
  release: AvailableRelease,
): Promise<string> {
  const fileName = buildFileName(release.version, context.platform, context.arch);
  const build = findAsset(release, fileName);
  const checksums = findAsset(release, CHECKSUM_FILE);
  const signature = findAsset(release, SIGNATURE_FILE);
  if (!build) {
    throw new ReleaseBuildMissingError(release.version, fileName);
  }
  if (!checksums || !signature) {
    throw new ReleaseSignatureError("the release has no signed checksum file");
  }

  const downloads = join(versionsFolder(context.home), ".downloads");
  await mkdir(downloads, { recursive: true });
  const archive = join(downloads, fileName);
  try {
    context.onProgress?.("downloading", 0);
    const checksumText = await downloadText(context.fetch, checksums);
    const signatureText = await downloadText(context.fetch, signature);
    const sha256 = await downloadFile(context.fetch, build, archive, (fraction) =>
      context.onProgress?.("downloading", fraction),
    );

    context.onProgress?.("verifying", null);
    verifyMinisignSignature(Buffer.from(checksumText, "utf8"), signatureText, context.publicKey);
    requireChecksum(parseChecksumFile(checksumText), fileName, sha256);

    context.onProgress?.("unpacking", null);
    return await unpackInto(context, archive, release.version);
  } finally {
    await rm(archive, { force: true });
  }
}

function findAsset(release: AvailableRelease, name: string): ReleaseAsset | undefined {
  return release.assets.find((asset) => asset.name === name);
}

async function downloadText(fetcher: typeof fetch, asset: ReleaseAsset): Promise<string> {
  const response = await request(fetcher, asset);
  return response.text();
}

async function request(fetcher: typeof fetch, asset: ReleaseAsset): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(asset.url, {
      headers: { Accept: "application/octet-stream" },
      redirect: "follow",
      signal: AbortSignal.timeout(10 * 60_000),
    });
  } catch (error) {
    throw new DownloadFailedError(asset.name, error instanceof Error ? error.message : "no answer");
  }
  if (!response.ok || !response.body) {
    throw new DownloadFailedError(asset.name, `the server answered ${response.status}`);
  }
  return response;
}

/** Saves the asset to `path`, reporting progress, and resolves with its SHA-256. */
async function downloadFile(
  fetcher: typeof fetch,
  asset: ReleaseAsset,
  path: string,
  onFraction: (fraction: number | null) => void,
): Promise<string> {
  const response = await request(fetcher, asset);
  const total = Number(response.headers.get("content-length")) || asset.size || 0;
  const hash = createHash("sha256");
  let received = 0;
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      received += chunk.length;
      onFraction(total > 0 ? Math.min(received / total, 1) : null);
      done(null, chunk);
    },
  });
  const body = Readable.fromWeb(response.body as WebReadableStream<Uint8Array>);
  await pipeline(body, measure, createWriteStream(path));
  return hash.digest("hex");
}

async function unpackInto(
  context: ReleaseDownloadContext,
  archive: string,
  version: string,
): Promise<string> {
  const target = versionFolder(context.home, version);
  const staging = `${target}.unpacking`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    await (context.unpack ?? unpackWithTar)(archive, staging);
    const manifest = await readReleaseManifest(staging).catch(() => {
      throw new UnpackFailedError("it has no release.json");
    });
    if (manifest.version !== version) {
      throw new UnpackFailedError(`it says it is version ${manifest.version}`);
    }
    // Plugin packages listed for this site come along to the new version.
    const siteConfig = join(context.home, "lintel.config.ts");
    if (existsSync(siteConfig)) {
      await copyFile(siteConfig, join(staging, "lintel.config.ts"));
    }
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
    return target;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

/**
 * The `tar` to run. On Windows that is the one Windows ships (System32\tar.exe): a GNU tar
 * found first on the PATH (Git for Windows has one) reads `C:\...` as a remote computer
 * and stops with "Error is not recoverable".
 */
export function tarProgram(platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") {
    const windowsTar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
    if (existsSync(windowsTar)) {
      return windowsTar;
    }
  }
  return "tar";
}

/** The release's files are at the archive's top level (scripts/release packs them so). */
function unpackWithTar(archive: string, into: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tar = spawn(tarProgram(), ["-xzf", archive, "-C", into], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errors = "";
    tar.stderr.on("data", (chunk: Buffer) => (errors += chunk.toString()));
    tar.once("error", (error) => reject(new UnpackFailedError(error.message)));
    tar.once("exit", (code) =>
      code === 0 ? resolve() : reject(new UnpackFailedError(errors.trim() || `tar exit ${code}`)),
    );
  });
}
