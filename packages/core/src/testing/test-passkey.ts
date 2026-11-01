import { createHash, generateKeyPairSync, type KeyObject, randomBytes, sign } from "node:crypto";

/**
 * A passkey in software, for tests: it answers the WebAuthn requests a browser would pass
 * to a phone or laptop, with a real P-256 key, so the server's checks run for real.
 */
export class TestPasskey {
  readonly credentialId = randomBytes(16);
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private counter = 0;

  constructor(
    private readonly origin: string,
    private readonly rpId = new URL(origin).hostname,
  ) {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey;
  }

  /** The browser's answer to `navigator.credentials.create`, given the server's options. */
  register(options: { challenge: string }) {
    const clientDataJSON = this.clientData("webauthn.create", options.challenge);
    const jwk = this.publicKey.export({ format: "jwk" });
    const coseKey = new Map<number, number | Buffer>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x ?? "", "base64url")],
      [-3, Buffer.from(jwk.y ?? "", "base64url")],
    ]);
    const credentialLength = Buffer.alloc(2);
    credentialLength.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      this.authenticatorData(0x45),
      Buffer.alloc(16),
      credentialLength,
      this.credentialId,
      encodeCbor(coseKey),
    ]);
    const attestationObject = encodeCbor(
      new Map<string, unknown>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: this.credentialId.toString("base64url"),
      rawId: this.credentialId.toString("base64url"),
      type: "public-key",
      response: {
        clientDataJSON: clientDataJSON.toString("base64url"),
        attestationObject: attestationObject.toString("base64url"),
        transports: ["internal"],
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }

  /** The browser's answer to `navigator.credentials.get`, given the server's options. */
  signIn(options: { challenge: string }) {
    this.counter += 1;
    const clientDataJSON = this.clientData("webauthn.get", options.challenge);
    const authenticatorData = this.authenticatorData(0x05);
    const signature = sign(
      "sha256",
      Buffer.concat([authenticatorData, createHash("sha256").update(clientDataJSON).digest()]),
      this.privateKey,
    );
    return {
      id: this.credentialId.toString("base64url"),
      rawId: this.credentialId.toString("base64url"),
      type: "public-key",
      response: {
        clientDataJSON: clientDataJSON.toString("base64url"),
        authenticatorData: authenticatorData.toString("base64url"),
        signature: signature.toString("base64url"),
      },
      clientExtensionResults: {},
    };
  }

  private clientData(type: string, challenge: string): Buffer {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }),
    );
  }

  /** The relying party's hash, the flags (user present and verified) and the counter. */
  private authenticatorData(flags: number): Buffer {
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.counter);
    return Buffer.concat([
      createHash("sha256").update(this.rpId).digest(),
      Buffer.from([flags]),
      counter,
    ]);
  }
}

/** Just enough CBOR for attestation objects: maps, byte strings, text and small integers. */
function encodeCbor(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) {
    return Buffer.concat([cborHead(2, value.length), value]);
  }
  if (typeof value === "string") {
    const bytes = Buffer.from(value);
    return Buffer.concat([cborHead(3, bytes.length), bytes]);
  }
  if (typeof value === "number") {
    return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  }
  if (value instanceof Map) {
    const parts = [...value.entries()].flatMap(([key, item]) => [
      encodeCbor(key),
      encodeCbor(item),
    ]);
    return Buffer.concat([cborHead(5, value.size), ...parts]);
  }
  throw new Error(`This test CBOR encoder can't encode ${typeof value}.`);
}

function cborHead(majorType: number, length: number): Buffer {
  if (length < 24) {
    return Buffer.from([(majorType << 5) | length]);
  }
  if (length < 256) {
    return Buffer.from([(majorType << 5) | 24, length]);
  }
  const head = Buffer.alloc(3);
  head[0] = (majorType << 5) | 25;
  head.writeUInt16BE(length, 1);
  return head;
}
