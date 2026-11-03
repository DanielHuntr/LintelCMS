import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { minisignPublicKeyLine, signMinisign } from "../updates/release-signature.js";
import {
  buildFileName,
  CHECKSUM_FILE,
  SIGNATURE_FILE,
  tarProgram,
} from "../updates/release-download.js";
import type { AvailableRelease } from "../updates/updates.schema.js";

/**
 * A release key of the tests' own and releases signed with it, served by a pretend
 * `fetch`, so the updater can be tested without the internet or the real key.
 */
export function makeTestReleaseKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const keyId = randomBytes(8);
  return { privateKey, keyId, publicKey: minisignPublicKeyLine(privateKey, keyId) };
}

export type TestReleaseKey = ReturnType<typeof makeTestReleaseKey>;

export interface TestRelease {
  release: AvailableRelease;
  files: Map<string, Buffer>;
}

/** A release whose build is a real .tar.gz holding release.json and one file. */
export async function makeTestRelease(
  key: TestReleaseKey,
  version: string,
  options: { tamperWithBuild?: boolean; security?: boolean } = {},
): Promise<TestRelease> {
  const folder = await mkdtemp(join(tmpdir(), "lintel-test-release-"));
  try {
    const contents = join(folder, "contents");
    await mkdir(contents, { recursive: true });
    await writeFile(join(contents, "release.json"), JSON.stringify({ version }));
    await writeFile(join(contents, "hello.txt"), `Lintel ${version}\n`);
    const buildName = buildFileName(version);
    execFileSync(tarProgram(), ["-czf", join(folder, buildName), "-C", contents, "."]);
    let build = await readFile(join(folder, buildName));
    const checksums = `${createHash("sha256").update(build).digest("hex")}  ${buildName}\n`;
    const signature = signMinisign(
      Buffer.from(checksums),
      key.privateKey,
      key.keyId,
      `lintel ${version}`,
    );
    if (options.tamperWithBuild) {
      build = Buffer.concat([build, Buffer.from("extra")]);
    }
    const files = new Map<string, Buffer>([
      [buildName, build],
      [CHECKSUM_FILE, Buffer.from(checksums)],
      [SIGNATURE_FILE, Buffer.from(signature)],
    ]);
    const release: AvailableRelease = {
      version,
      name: `Lintel ${version}`,
      channel: "stable",
      publishedAt: "2026-11-01T09:00:00.000Z",
      notesHtml: "<p>Better things.</p>",
      summary: "Better things.",
      security: options.security ?? false,
      breaking: false,
      minimumVersion: null,
      pageUrl: null,
      assets: [...files.entries()].map(([name, bytes]) => ({
        name,
        url: `https://downloads.test/${version}/${name}`,
        size: bytes.length,
      })),
    };
    return { release, files };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

/** A `fetch` that answers download addresses from the releases given, and 404 otherwise. */
export function fetchServing(
  releases: readonly TestRelease[],
  extra: (url: string, init?: RequestInit) => Response | undefined = () => undefined,
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const answered = extra(url, init);
    if (answered) return answered;
    for (const { release, files } of releases) {
      const asset = release.assets.find((candidate) => candidate.url === url);
      const bytes = asset ? files.get(asset.name) : undefined;
      if (bytes) {
        return new Response(new Uint8Array(bytes), {
          headers: { "content-length": String(bytes.length) },
        });
      }
    }
    return new Response("Not found", { status: 404 });
  };
}
