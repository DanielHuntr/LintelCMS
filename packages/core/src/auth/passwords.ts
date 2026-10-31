import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt, so there is no native module to compile
 * on a self-hosted server.
 *
 * A stored hash looks like `scrypt$32768$8$3$<salt>$<hash>`. The cost settings travel with
 * each hash, so they can be raised later without breaking existing passwords.
 *
 * The settings follow OWASP's scrypt guidance (N=2^15, r=8, p=3): about 32 MiB of memory
 * per hash, which makes guessing passwords from a stolen database expensive.
 */
const SCHEME = "scrypt";
const DEFAULT_SETTINGS = { cost: 2 ** 15, blockSize: 8, parallelization: 3 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;

interface ScryptSettings {
  cost: number;
  blockSize: number;
  parallelization: number;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, KEY_BYTES, DEFAULT_SETTINGS);
  const { cost, blockSize, parallelization } = DEFAULT_SETTINGS;

  return [
    SCHEME,
    cost,
    blockSize,
    parallelization,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Returns false for a wrong password and for a hash it can't read, rather than throwing,
 * so a damaged row can't be told apart from a wrong password by someone signing in.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseStoredHash(storedHash);
  if (!parsed) {
    return false;
  }

  const key = await deriveKey(password, parsed.salt, parsed.key.length, parsed.settings);
  // timingSafeEqual takes the same time however many bytes match, so response times
  // don't reveal how close a guess was.
  return timingSafeEqual(key, parsed.key);
}

function parseStoredHash(storedHash: string) {
  const [scheme, cost, blockSize, parallelization, salt, key] = storedHash.split("$");
  if (scheme !== SCHEME || !salt || !key) {
    return undefined;
  }

  const settings = {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
  };
  if (!Object.values(settings).every((value) => Number.isInteger(value) && value > 0)) {
    return undefined;
  }

  return { settings, salt: Buffer.from(salt, "base64"), key: Buffer.from(key, "base64") };
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  settings: ScryptSettings,
): Promise<Buffer> {
  const options: ScryptOptions = {
    N: settings.cost,
    r: settings.blockSize,
    p: settings.parallelization,
    // scrypt needs about 128 * N * r bytes; Node's default limit (32 MiB) is just too small.
    maxmem: 256 * settings.cost * settings.blockSize,
  };

  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}
