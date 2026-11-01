import { describe, expect, it } from "vitest";
import { generateRecoveryCodes, hashRecoveryCode } from "./recovery-codes.js";
import {
  generateTotpSecret,
  totpCodeForStep,
  totpSetupUrl,
  totpStepAt,
  verifyTotpCode,
} from "./totp.js";

// The test key from RFC 6238 ("12345678901234567890"), in base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("authenticator app codes", () => {
  it("match the published test values", () => {
    // RFC 6238, appendix B: at 59 seconds the 8-digit SHA-1 code is 94287082.
    expect(totpCodeForStep(RFC_SECRET, totpStepAt(new Date(59_000)))).toBe("287082");
    expect(totpCodeForStep(RFC_SECRET, totpStepAt(new Date(1_111_111_109_000)))).toBe("081804");
  });

  it("accept the current code and one step either side, but no further", () => {
    const now = new Date(1_700_000_000_000);
    const step = totpStepAt(now);

    expect(verifyTotpCode(RFC_SECRET, totpCodeForStep(RFC_SECRET, step), now, null)).toBe(step);
    expect(verifyTotpCode(RFC_SECRET, totpCodeForStep(RFC_SECRET, step - 1), now, null)).toBe(
      step - 1,
    );
    expect(verifyTotpCode(RFC_SECRET, totpCodeForStep(RFC_SECRET, step + 1), now, null)).toBe(
      step + 1,
    );
    expect(
      verifyTotpCode(RFC_SECRET, totpCodeForStep(RFC_SECRET, step - 2), now, null),
    ).toBeUndefined();
  });

  it("refuse a code that was already used, and anything that isn't six digits", () => {
    const now = new Date(1_700_000_000_000);
    const step = totpStepAt(now);
    const code = totpCodeForStep(RFC_SECRET, step);

    expect(verifyTotpCode(RFC_SECRET, code, now, step)).toBeUndefined();
    expect(verifyTotpCode(RFC_SECRET, "12345", now, null)).toBeUndefined();
    expect(verifyTotpCode(RFC_SECRET, "abcdef", now, null)).toBeUndefined();
    expect(verifyTotpCode(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now, null)).toBe(
      step,
    );
  });

  it("make new random keys and a setup address apps understand", () => {
    const secret = generateTotpSecret();

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(secret).not.toBe(generateTotpSecret());
    expect(totpSetupUrl("Lintel", "ana@example.com", secret)).toBe(
      `otpauth://totp/Lintel%3Aana%40example.com?secret=${secret}&issuer=Lintel&algorithm=SHA1&digits=6&period=30`,
    );
  });
});

describe("recovery codes", () => {
  it("come ten at a time, readable, and match however they are typed", () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    }
    expect(hashRecoveryCode(codes[0]!.toUpperCase().replace("-", " "))).toBe(
      hashRecoveryCode(codes[0]!),
    );
  });
});
