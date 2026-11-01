import { readFileSync } from "node:fs";

/**
 * The version of Lintel that is running, from packages/core/package.json: the same file
 * from `src` and `dist`, in the repository, the Docker image and a release folder. Every
 * package carries the same number; `scripts/release` checks they agree before packing.
 */
const PACKAGE_FILE = new URL("../../package.json", import.meta.url);

let cachedVersion: string | null = null;

export function lintelVersion(): string {
  if (cachedVersion === null) {
    const manifest: unknown = JSON.parse(readFileSync(PACKAGE_FILE, "utf8"));
    cachedVersion =
      typeof manifest === "object" &&
      manifest !== null &&
      "version" in manifest &&
      typeof manifest.version === "string"
        ? manifest.version
        : "0.0.0";
  }
  return cachedVersion;
}
