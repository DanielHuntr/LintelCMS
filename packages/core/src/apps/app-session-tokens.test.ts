import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "./app-session-tokens.js";

const secret = "lintelapp_test-secret-that-is-long-enough-for-tests";
const subject = {
  iss: "https://api.example.com",
  dest: "https://admin.example.com",
  aud: "app_0123456789abcdef0123",
  sub: "a7f0c9c4-3d0b-4c43-a4a1-6b6f6c0f3b11",
  appId: "f2b4a4f6-1e8f-4a39-9a7c-0b4b8f5b0c22",
  permissions: ["entries:read"],
};
const expected = { clientId: subject.aud };
const signedAt = new Date("2026-11-01T12:00:00Z");

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("session tokens", () => {
  it("are standard HS256 JWTs that last five minutes", () => {
    const { token, expiresAt } = signSessionToken(secret, subject, signedAt);
    const [header, payload] = token.split(".");

    expect(JSON.parse(Buffer.from(header ?? "", "base64url").toString())).toEqual({
      alg: "HS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(payload ?? "", "base64url").toString())).toMatchObject({
      ...subject,
      iat: 1793534400,
      nbf: 1793534400,
      exp: 1793534700,
      jti: expect.any(String),
    });
    expect(expiresAt.toISOString()).toBe("2026-11-01T12:05:00.000Z");
  });

  it("verify with the right secret while they last", () => {
    const { token } = signSessionToken(secret, subject, signedAt);
    const inFourMinutes = new Date(signedAt.getTime() + 4 * 60_000);

    expect(verifySessionToken(secret, token, expected, inFourMinutes)).toMatchObject({
      valid: true,
      claims: { sub: subject.sub },
    });
  });

  it("are refused when expired, early, for another app, or signed with another secret", () => {
    const { token } = signSessionToken(secret, subject, signedAt);
    const later = new Date(signedAt.getTime() + 6 * 60_000);
    const earlier = new Date(signedAt.getTime() - 60_000);

    expect(verifySessionToken(secret, token, expected, later)).toEqual({
      valid: false,
      reason: "expired",
    });
    expect(verifySessionToken(secret, token, expected, earlier)).toEqual({
      valid: false,
      reason: "not-yet-valid",
    });
    expect(verifySessionToken(secret, token, { clientId: "app_other" }, signedAt)).toEqual({
      valid: false,
      reason: "wrong-audience",
    });
    expect(verifySessionToken("lintelapp_another", token, expected, signedAt)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("are refused when changed, or when they name another algorithm", () => {
    const { token } = signSessionToken(secret, subject, signedAt);
    const [header, , signature] = token.split(".");
    const widened = encode({
      ...subject,
      permissions: ["*"],
      iat: 0,
      nbf: 0,
      exp: 9999999999,
      jti: "x",
    });

    expect(
      verifySessionToken(secret, `${header}.${widened}.${signature}`, expected, signedAt),
    ).toEqual({
      valid: false,
      reason: "bad-signature",
    });

    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${widened}.`;
    expect(verifySessionToken(secret, unsigned, expected, signedAt)).toEqual({
      valid: false,
      reason: "wrong-algorithm",
    });
    expect(verifySessionToken(secret, "not-a-token", expected, signedAt)).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("can be checked by any JWT library: the signature is plain HMAC-SHA256", () => {
    const { token } = signSessionToken(secret, subject, signedAt);
    const [header, payload, signature] = token.split(".");
    const computed = createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(signature).toBe(computed);
  });
});
