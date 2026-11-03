import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lintelFolderAt } from "../database/database-choice.js";
import { createSecretBox, loadSecretKey, SecretUnreadableError } from "./secret-box.js";

describe("the secret box", () => {
  const folders: string[] = [];
  afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true })));

  function temporaryFolder() {
    const folder = mkdtempSync(join(tmpdir(), "lintel-secrets-"));
    folders.push(folder);
    return lintelFolderAt(folder);
  }

  it("seals and opens a password, never storing it as it is", () => {
    const box = createSecretBox(Buffer.alloc(32, 7));
    const sealed = box.seal("correct horse battery staple");
    expect(sealed).not.toContain("horse");
    expect(box.seal("same")).not.toBe(box.seal("same"));
    expect(box.open(sealed)).toBe("correct horse battery staple");
  });

  it("refuses a sealed value that was changed or sealed with another key", () => {
    const box = createSecretBox(Buffer.alloc(32, 7));
    const sealed = box.seal("secret");
    const tampered = `${sealed.slice(0, -2)}AA`;
    expect(() => box.open(tampered)).toThrow(SecretUnreadableError);
    expect(() => createSecretBox(Buffer.alloc(32, 8)).open(sealed)).toThrow(SecretUnreadableError);
  });

  it("makes a key file once, readable only by its owner, and reuses it", () => {
    const folder = temporaryFolder();
    const first = loadSecretKey(folder, {});
    const keyFile = join(folder.dataFolder, "..", "secret.key");
    expect(readFileSync(keyFile, "utf8").trim()).toBe(first.toString("hex"));
    if (process.platform !== "win32") expect(statSync(keyFile).mode & 0o077).toBe(0);
    expect(loadSecretKey(folder, {}).equals(first)).toBe(true);
  });

  it("prefers LINTEL_SECRET_KEY and explains a badly typed one", () => {
    const folder = temporaryFolder();
    const key = "ab".repeat(32);
    expect(loadSecretKey(folder, { LINTEL_SECRET_KEY: key }).toString("hex")).toBe(key);
    expect(() => loadSecretKey(folder, { LINTEL_SECRET_KEY: "short" })).toThrow(/64 hexadecimal/);
  });
});
