import { createHash, createPublicKey, type KeyObject, sign, verify } from "node:crypto";

/**
 * Checking that a downloaded release is the one that was published. A release carries
 * `SHA256SUMS` (one "<sha-256>  <file name>" line per file) and `SHA256SUMS.minisig`, a
 * minisign signature of that file made with Lintel's release key. Lintel checks the
 * signature against the public key built into it (release-public-key.ts), then the file's
 * SHA-256 against its line. Either failing stops the update before anything is unpacked.
 *
 * minisign's format is used so releases can be signed with the `minisign` tool or with
 * `scripts/release` (which uses Node's Ed25519); both are checked here with Node's crypto.
 *
 *   public key:  base64("Ed" + key id (8 bytes) + Ed25519 public key (32 bytes))
 *   signature:   untrusted comment line
 *                base64(algorithm "Ed" or "ED" + key id + signature (64 bytes))
 *                "trusted comment: ..." line
 *                base64(signature of signature + trusted comment)
 *
 * "ED" signs the BLAKE2b-512 hash of the file (minisign's default since 0.10), "Ed" the file.
 */

export class ReleaseSignatureError extends Error {
  constructor(reason: string) {
    super(
      `This download couldn't be confirmed as a genuine Lintel release (${reason}). ` +
        "Nothing was changed. If it happens again, tell whoever publishes your updates.",
    );
    this.name = "ReleaseSignatureError";
  }
}

export class ChecksumMismatchError extends Error {
  constructor(fileName: string) {
    super(
      `The downloaded ${fileName} isn't the file that was published: it may have been ` +
        "damaged on the way. Nothing was changed. Try the update again.",
    );
    this.name = "ChecksumMismatchError";
  }
}

interface MinisignPublicKey {
  keyId: Buffer;
  key: KeyObject;
}

/** Reads a minisign public key: the base64 line alone, or the whole .pub file. */
export function readMinisignPublicKey(text: string): MinisignPublicKey {
  const line = text
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0 && !candidate.startsWith("untrusted comment:"));
  const bytes = Buffer.from(line ?? "", "base64");
  if (bytes.length !== 42 || bytes.subarray(0, 2).toString("latin1") !== "Ed") {
    throw new ReleaseSignatureError("the public key isn't a minisign Ed25519 key");
  }
  return { keyId: bytes.subarray(2, 10), key: ed25519PublicKey(bytes.subarray(10)) };
}

/** Throws ReleaseSignatureError unless `signatureFile` is a good signature of `content`. */
export function verifyMinisignSignature(
  content: Buffer,
  signatureFile: string,
  publicKeyText: string,
): void {
  const publicKey = readMinisignPublicKey(publicKeyText);
  const lines = signatureFile.split(/\r?\n/).map((line) => line.trim());
  const [, signatureLine = "", trustedLine = "", globalLine = ""] = lines;
  const signatureBytes = Buffer.from(signatureLine, "base64");
  if (signatureBytes.length !== 74 || !trustedLine.startsWith("trusted comment: ")) {
    throw new ReleaseSignatureError("the signature file isn't in minisign's format");
  }
  const algorithm = signatureBytes.subarray(0, 2).toString("latin1");
  const keyId = signatureBytes.subarray(2, 10);
  const signature = signatureBytes.subarray(10);
  if (!keyId.equals(publicKey.keyId)) {
    throw new ReleaseSignatureError("it was signed with a different key");
  }
  if (algorithm !== "Ed" && algorithm !== "ED") {
    throw new ReleaseSignatureError("the signature uses an unknown method");
  }
  const signed = algorithm === "ED" ? createHash("blake2b512").update(content).digest() : content;
  if (!verify(null, signed, publicKey.key, signature)) {
    throw new ReleaseSignatureError("the signature doesn't match");
  }
  const trustedComment = Buffer.from(trustedLine.slice("trusted comment: ".length), "utf8");
  const globalSignature = Buffer.from(globalLine, "base64");
  if (!verify(null, Buffer.concat([signature, trustedComment]), publicKey.key, globalSignature)) {
    throw new ReleaseSignatureError("the signature's comment was changed");
  }
}

/**
 * Signs `content` as minisign does (prehashed, "ED"). Used by scripts/release and tests;
 * Lintel itself never signs anything.
 */
export function signMinisign(
  content: Buffer,
  privateKey: KeyObject,
  keyId: Buffer,
  trustedComment: string,
): string {
  const signature = sign(null, createHash("blake2b512").update(content).digest(), privateKey);
  const globalSignature = sign(
    null,
    Buffer.concat([signature, Buffer.from(trustedComment, "utf8")]),
    privateKey,
  );
  return [
    "untrusted comment: signature from the Lintel release key",
    Buffer.concat([Buffer.from("ED", "latin1"), keyId, signature]).toString("base64"),
    `trusted comment: ${trustedComment}`,
    globalSignature.toString("base64"),
    "",
  ].join("\n");
}

/** A minisign public key line for an Ed25519 key pair made with Node. */
export function minisignPublicKeyLine(privateKeyOrPublic: KeyObject, keyId: Buffer): string {
  const publicKey =
    privateKeyOrPublic.type === "private"
      ? createPublicKey(privateKeyOrPublic)
      : privateKeyOrPublic;
  const jwk = publicKey.export({ format: "jwk" });
  const raw = Buffer.from(jwk.x ?? "", "base64url");
  return Buffer.concat([Buffer.from("Ed", "latin1"), keyId, raw]).toString("base64");
}

/** "<sha-256>  <file name>" lines (sha256sum's format) → file name to hash. */
export function parseChecksumFile(text: string): Map<string, string> {
  const checksums = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (match?.[1] && match[2]) {
      checksums.set(match[2].trim(), match[1].toLowerCase());
    }
  }
  return checksums;
}

/** Throws ChecksumMismatchError unless `checksums` lists `fileName` with this SHA-256. */
export function requireChecksum(
  checksums: ReadonlyMap<string, string>,
  fileName: string,
  sha256: string,
): void {
  const expected = checksums.get(fileName);
  if (!expected) {
    throw new ReleaseSignatureError(`the checksum file doesn't list ${fileName}`);
  }
  if (expected !== sha256.toLowerCase()) {
    throw new ChecksumMismatchError(fileName);
  }
}

function ed25519PublicKey(raw: Buffer): KeyObject {
  return createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: raw.toString("base64url") },
    format: "jwk",
  });
}
