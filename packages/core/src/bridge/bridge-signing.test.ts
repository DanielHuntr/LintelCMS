import { describe, expect, it } from "vitest";
import { buildBridgeConfig, phpString } from "./bridge-files.js";
import { hmacHex, openEnvelope, signedRequestHeaders, signEnvelope } from "./bridge-signing.js";

describe("signing for the PHP companion", () => {
  const secret = "c".repeat(64);

  it("signs files so a changed price is noticed", () => {
    const signed = signEnvelope(secret, { price: 450 });
    expect(openEnvelope(secret, signed)).toEqual({ price: 450 });
    const tampered = signed.replace("450", "1");
    expect(() => openEnvelope(secret, tampered)).toThrow("doesn't match");
    expect(() => openEnvelope("d".repeat(64), signed)).toThrow("doesn't match");
  });

  it("signs each request over the time, a fresh nonce, the action and the body", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const first = signedRequestHeaders(secret, "ack", '{"orders":[]}', now);
    const second = signedRequestHeaders(secret, "ack", '{"orders":[]}', now);
    expect(first["x-lintel-timestamp"]).toBe("1793534400");
    expect(first["x-lintel-nonce"]).not.toBe(second["x-lintel-nonce"]);
    expect(first["x-lintel-signature"]).toBe(
      hmacHex(secret, `1793534400\n${first["x-lintel-nonce"]}\nack\n{"orders":[]}`),
    );
  });

  it("writes settings PHP can read without anything in them breaking out", () => {
    expect(phpString("it's \\ fine")).toBe("'it\\'s \\\\ fine'");
    const config = buildBridgeConfig({
      secret,
      siteAddress: "https://www.example.com",
      stripeSecretKey: null,
      stripeWebhookSecret: "whsec_x';echo 1;'",
      mollieApiKey: null,
      emailFromHost: false,
      emailFrom: "",
    });
    expect(config).toContain("'stripeWebhookSecret' => 'whsec_x\\';echo 1;\\'',");
    expect(config).not.toContain("stripeSecretKey");
    expect(config.startsWith("<?php")).toBe(true);
  });
});
