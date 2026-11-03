import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { LintelFolder } from "../database/database-choice.js";

/**
 * Passwords and keys Lintel must use later but never show again, such as the password of
 * an FTP account it publishes to. They are kept encrypted (AES-256-GCM) in the database,
 * with a key that is not: `LINTEL_SECRET_KEY` (64 hexadecimal characters) when it is set,
 * otherwise a key made on first use and kept in `.lintel/secret.key`. Someone with a copy
 * of the database alone can't read them.
 */

const VERSION = "v1";
const KEY_FILE_NAME = "secret.key";

export class SecretUnreadableError extends Error {
  constructor() {
    super(
      "A saved password can't be read with this server's secret key. Type the password again " +
        "(the secret key or LINTEL_SECRET_KEY may have changed since it was saved).",
    );
    this.name = "SecretUnreadableError";
  }
}

export interface SecretBox {
  seal(plainText: string): string;
  open(sealed: string): string;
}

export function createSecretBox(key: Buffer): SecretBox {
  if (key.length !== 32) {
    throw new Error("The secret key must be 32 bytes (64 hexadecimal characters).");
  }
  return {
    seal(plainText) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const body = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, nonce, tag, body].map(encode).join(".");
    },
    open(sealed) {
      const [version, nonce, tag, body] = sealed.split(".");
      if (version !== VERSION || !nonce || !tag || body === undefined) {
        throw new SecretUnreadableError();
      }
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"));
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([
          decipher.update(Buffer.from(body, "base64url")),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        throw new SecretUnreadableError();
      }
    },
  };
}

function encode(part: string | Buffer): string {
  return typeof part === "string" ? part : part.toString("base64url");
}

/** The key from LINTEL_SECRET_KEY, or the one kept beside the built-in database. */
export function loadSecretKey(
  folder: LintelFolder,
  environment: NodeJS.ProcessEnv = process.env,
): Buffer {
  const fromEnvironment = environment.LINTEL_SECRET_KEY?.trim();
  if (fromEnvironment) {
    if (!/^[0-9a-f]{64}$/i.test(fromEnvironment)) {
      throw new Error("LINTEL_SECRET_KEY should be 64 hexadecimal characters (32 bytes).");
    }
    return Buffer.from(fromEnvironment, "hex");
  }
  const keyFile = join(dirname(folder.dataFolder), KEY_FILE_NAME);
  if (existsSync(keyFile)) {
    return Buffer.from(readFileSync(keyFile, "utf8").trim(), "hex");
  }
  const key = randomBytes(32);
  mkdirSync(dirname(keyFile), { recursive: true });
  writeFileSync(keyFile, `${key.toString("hex")}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  return key;
}
