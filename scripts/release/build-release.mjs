#!/usr/bin/env node
// Builds a Lintel release on this computer: the build for this platform, its checksum and
// the signature the updater checks. It never uploads or publishes anything.
//
//   node scripts/release/build-release.mjs --key <path to lintel-release.key> [--out release-files]
//
// Run it on each platform you publish a build for (linux-x64, linux-arm64...), pointing --out
// at the same folder: SHA256SUMS lists every build there and is signed again each time.
// Then attach every file in the folder to the GitHub release for the tag v<version>, as
// "Releases and the update feed" in the docs describes.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dirname, "../..");
const { values } = parseArgs({
  options: {
    key: { type: "string" },
    out: { type: "string", default: "release-files" },
    "skip-build": { type: "boolean", default: false },
  },
});
const keyFile = values.key ?? process.env.LINTEL_RELEASE_KEY;
if (!keyFile) {
  fail("Say where the release key is: --key <path to lintel-release.key> (or LINTEL_RELEASE_KEY).");
}
const out = resolve(root, values.out);

// 1. Every package carries the same version, which becomes the release's.
const version = readJson(join(root, "package.json")).version;
for (const folder of ["packages", "starters"]) {
  for (const name of readdirSync(join(root, folder))) {
    const manifest = join(root, folder, name, "package.json");
    if (existsSync(manifest) && readJson(manifest).version !== version) {
      fail(
        `${folder}/${name} is at ${readJson(manifest).version}, not ${version}. Make them agree first.`,
      );
    }
  }
}
say(`Building Lintel ${version} for ${process.platform}-${process.arch}`);

// 2. Build, then gather what runs: core and the command line with their production
//    dependencies, and the built admin. The same as the Docker image.
if (!values["skip-build"]) {
  run("pnpm", ["install", "--frozen-lockfile"]);
  run("pnpm", [
    "--filter",
    "@lintel/core",
    "--filter",
    "@lintel/cli",
    "--filter",
    "@lintel/admin",
    "build",
  ]);
}
const stage = join(out, `.stage-${version}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "packages"), { recursive: true });
run("pnpm", [
  "--filter",
  "@lintel/core",
  "deploy",
  "--prod",
  "--legacy",
  join(stage, "packages", "core"),
]);
cpSync(join(root, "packages/core/dist"), join(stage, "packages/core/dist"), { recursive: true });
cpSync(join(root, "packages/core/migrations"), join(stage, "packages/core/migrations"), {
  recursive: true,
});
run("pnpm", [
  "--filter",
  "@lintel/cli",
  "deploy",
  "--prod",
  "--legacy",
  join(stage, "packages", "cli"),
]);
cpSync(join(root, "packages/cli/dist"), join(stage, "packages/cli/dist"), { recursive: true });
cpSync(join(root, "packages/admin/dist"), join(stage, "packages/admin/dist"), { recursive: true });

writeFileSync(
  join(stage, "release.json"),
  `${JSON.stringify(
    {
      version,
      start: "packages/core/dist/main.js",
      migrate: "packages/core/dist/scripts/migrate.js",
      cli: "packages/cli/dist/main.js",
      admin: "packages/admin/dist",
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(stage, "package.json"),
  `${JSON.stringify({ name: "lintel-release", version, private: true, type: "module" }, null, 2)}\n`,
);
// `node lintel.mjs start` from the release folder runs the supervisor.
writeFileSync(join(stage, "lintel.mjs"), 'import "./packages/cli/dist/main.js";\n');

// 3. Pack: the release's files at the archive's top level.
const buildName = `lintel-${version}-${process.platform}-${process.arch}.tar.gz`;
run("tar", ["-czf", join(out, buildName), "-C", stage, "."]);
rmSync(stage, { recursive: true, force: true });

// 4. SHA256SUMS for every build in the folder, then its signature.
const builds = readdirSync(out).filter(
  (name) => name.startsWith(`lintel-${version}-`) && name.endsWith(".tar.gz"),
);
const checksums = builds
  .sort()
  .map(
    (name) =>
      `${createHash("sha256")
        .update(readFileSync(join(out, name)))
        .digest("hex")}  ${name}`,
  )
  .join("\n");
writeFileSync(join(out, "SHA256SUMS"), `${checksums}\n`);

const { signMinisign } = await import(
  join(root, "packages/core/dist/updates/release-signature.js")
);
const key = readJson(resolve(keyFile));
const signature = signMinisign(
  readFileSync(join(out, "SHA256SUMS")),
  createPrivateKey(key.privateKey),
  Buffer.from(key.keyId, "hex"),
  `lintel ${version}`,
);
writeFileSync(join(out, "SHA256SUMS.minisig"), signature);

say(`Done. Attach these to the GitHub release for v${version}:`);
for (const name of [...builds, "SHA256SUMS", "SHA256SUMS.minisig"]) say(`  ${join(out, name)}`);

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function say(message) {
  console.log(message);
}
function fail(message) {
  console.error(message);
  process.exit(1);
}
