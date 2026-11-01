import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchServing, makeTestRelease, makeTestReleaseKey } from "../testing/test-releases.js";
import { buildFileName, prepareRelease, ReleaseBuildMissingError } from "./release-download.js";
import { LINTEL_RELEASE_PUBLIC_KEY } from "./release-public-key.js";
import {
  ChecksumMismatchError,
  parseChecksumFile,
  readMinisignPublicKey,
  ReleaseSignatureError,
  requireChecksum,
  signMinisign,
  verifyMinisignSignature,
} from "./release-signature.js";

describe("release signatures and checksums", () => {
  const key = makeTestReleaseKey();
  const content = Buffer.from("abc123  lintel-1.1.0-linux-x64.tar.gz\n");

  it("accepts a file signed with the release key", () => {
    const signature = signMinisign(content, key.privateKey, key.keyId, "lintel 1.1.0");
    expect(() => verifyMinisignSignature(content, signature, key.publicKey)).not.toThrow();
  });

  it("refuses a changed file, a changed comment and another key's signature", () => {
    const signature = signMinisign(content, key.privateKey, key.keyId, "lintel 1.1.0");
    expect(() =>
      verifyMinisignSignature(Buffer.from(`${content}x`), signature, key.publicKey),
    ).toThrow(ReleaseSignatureError);
    expect(() =>
      verifyMinisignSignature(
        content,
        signature.replace("trusted comment: lintel 1.1.0", "trusted comment: lintel 9.9.9"),
        key.publicKey,
      ),
    ).toThrow(/comment was changed/);

    const someoneElse = makeTestReleaseKey();
    const theirs = signMinisign(content, someoneElse.privateKey, key.keyId, "lintel 1.1.0");
    expect(() => verifyMinisignSignature(content, theirs, key.publicKey)).toThrow(
      /signature doesn't match/,
    );
    const otherId = signMinisign(content, someoneElse.privateKey, someoneElse.keyId, "x");
    expect(() => verifyMinisignSignature(content, otherId, key.publicKey)).toThrow(/different key/);
    expect(() => verifyMinisignSignature(content, "not a signature", key.publicKey)).toThrow(
      /format/,
    );
  });

  it("builds Lintel's own public key in, in minisign's format", () => {
    expect(() => readMinisignPublicKey(LINTEL_RELEASE_PUBLIC_KEY)).not.toThrow();
    expect(() => readMinisignPublicKey(`untrusted comment: x\n${key.publicKey}\n`)).not.toThrow();
    expect(() => readMinisignPublicKey("nonsense")).toThrow(ReleaseSignatureError);
  });

  it("checks a file's SHA-256 against the checksum file", () => {
    const hash = createHash("sha256").update("build").digest("hex");
    const checksums = parseChecksumFile(`${hash}  lintel.tar.gz\n${"0".repeat(64)} *other.zip\n`);
    expect(checksums.get("other.zip")).toBe("0".repeat(64));
    expect(() => requireChecksum(checksums, "lintel.tar.gz", hash)).not.toThrow();
    expect(() => requireChecksum(checksums, "lintel.tar.gz", "f".repeat(64))).toThrow(
      ChecksumMismatchError,
    );
    expect(() => requireChecksum(checksums, "missing.tar.gz", hash)).toThrow(/doesn't list/);
  });
});

describe("downloading a release", { timeout: 30_000 }, () => {
  const key = makeTestReleaseKey();
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "lintel-home-"));
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  it("downloads, checks and unpacks a good release into versions/<version>", async () => {
    const good = await makeTestRelease(key, "1.1.0");
    const steps: string[] = [];

    const folder = await prepareRelease(
      {
        home,
        publicKey: key.publicKey,
        fetch: fetchServing([good]),
        onProgress: (step) => {
          if (steps.at(-1) !== step) steps.push(step);
        },
      },
      good.release,
    );

    expect(folder).toBe(join(home, "versions", "1.1.0"));
    expect(await readFile(join(folder, "hello.txt"), "utf8")).toBe("Lintel 1.1.0\n");
    expect(steps).toEqual(["downloading", "verifying", "unpacking"]);
    expect(existsSync(join(home, "versions", ".downloads", buildFileName("1.1.0")))).toBe(false);
  });

  it("refuses a tampered build and leaves nothing unpacked", async () => {
    const tampered = await makeTestRelease(key, "1.1.0", { tamperWithBuild: true });
    await expect(
      prepareRelease(
        { home, publicKey: key.publicKey, fetch: fetchServing([tampered]) },
        tampered.release,
      ),
    ).rejects.toThrow(ChecksumMismatchError);
    expect(existsSync(join(home, "versions", "1.1.0"))).toBe(false);
  });

  it("refuses a release signed with another key", async () => {
    const good = await makeTestRelease(key, "1.1.0");
    await expect(
      prepareRelease(
        { home, publicKey: makeTestReleaseKey().publicKey, fetch: fetchServing([good]) },
        good.release,
      ),
    ).rejects.toThrow(ReleaseSignatureError);
  });

  it("says when there is no build for this server", async () => {
    const good = await makeTestRelease(key, "1.1.0");
    await expect(
      prepareRelease(
        { home, publicKey: key.publicKey, fetch: fetchServing([good]), platform: "sunos" },
        good.release,
      ),
    ).rejects.toThrow(ReleaseBuildMissingError);
  });
});
