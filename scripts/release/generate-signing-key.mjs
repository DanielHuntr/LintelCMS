#!/usr/bin/env node
// Makes a new release signing key pair (Ed25519, minisign's public key format).
//
//   node scripts/release/generate-signing-key.mjs <folder outside the repository>
//
// Writes lintel-release.key (the private key: keep it secret, never commit it) and
// lintel-release.pub, and prints the public key line to paste into
// packages/core/src/updates/release-public-key.ts. See the "Releases and the update feed" guide.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node scripts/release/generate-signing-key.mjs <folder>");
  process.exit(1);
}
const target = resolve(folder);
const privateFile = join(target, "lintel-release.key");
if (existsSync(privateFile)) {
  console.error(`${privateFile} already exists. Move it away first; nothing was changed.`);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const keyId = randomBytes(8);
const raw = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
const publicLine = Buffer.concat([Buffer.from("Ed", "latin1"), keyId, raw]).toString("base64");

mkdirSync(target, { recursive: true });
writeFileSync(
  privateFile,
  JSON.stringify(
    {
      keyId: keyId.toString("hex"),
      privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
writeFileSync(
  join(target, "lintel-release.pub"),
  `untrusted comment: minisign public key ${keyId.toString("hex").toUpperCase()}\n${publicLine}\n`,
);
console.log(`Private key: ${privateFile} (keep it secret and backed up)`);
console.log(`Public key:  ${publicLine}`);
