import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords.js";

describe("passwords", () => {
  it("accepts the password that was hashed", async () => {
    const storedHash = await hashPassword("correct horse battery staple");

    expect(await verifyPassword("correct horse battery staple", storedHash)).toBe(true);
  });

  it("rejects a different password", async () => {
    const storedHash = await hashPassword("correct horse battery staple");

    expect(await verifyPassword("correct horse battery stapler", storedHash)).toBe(false);
  });

  it("salts every hash, so the same password never looks the same twice", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");

    expect(first).not.toBe(second);
    expect(first).toMatch(/^scrypt\$32768\$8\$3\$/);
  });

  it("treats an unreadable stored hash as a wrong password instead of crashing", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$x$8$3$c2FsdA==$a2V5")).toBe(false);
  });
});
