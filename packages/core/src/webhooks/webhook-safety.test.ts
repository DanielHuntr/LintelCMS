import { describe, expect, it } from "vitest";
import { isLocalHostName, isPrivateAddress } from "./address-safety.js";
import {
  checkWebhookAddress,
  publicOnlyLookup,
  sendWebhookRequest,
  WebhookSendError,
} from "./webhook-sender.js";
import { MAX_DELIVERY_ATTEMPTS, nextRetryAt } from "./webhook-retries.js";
import { signWebhookBody, verifyWebhookSignature } from "./webhook-signatures.js";

describe("private addresses", () => {
  it("catches loopback, private, link-local and metadata addresses, however they're written", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.5",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:a9fe:a9fe",
      "::127.0.0.1",
      "2002:7f00:1::",
      "2002:a9fe:a9fe::1",
      "2001:0:4136:e378::1",
      "64:ff9b::a9fe:a9fe",
      "not an address",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("lets public addresses through", () => {
    for (const address of [
      "93.184.215.14",
      "1.1.1.1",
      "2606:4700:4700::1111",
      "::ffff:8.8.8.8",
      "2002:808:808::",
    ]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it("treats localhost names as local", () => {
    expect(isLocalHostName("localhost")).toBe(true);
    expect(isLocalHostName("api.localhost.")).toBe(true);
    expect(isLocalHostName("printer.local")).toBe(true);
    expect(isLocalHostName("example.com")).toBe(false);
  });

  it("refuses private URLs before sending, unless they're allowed", () => {
    const blocked = { allowPrivateAddresses: false };
    expect(() => checkWebhookAddress(new URL("http://127.0.0.1:8080/hook"), blocked)).toThrow(
      WebhookSendError,
    );
    expect(() => checkWebhookAddress(new URL("http://[::1]/hook"), blocked)).toThrow(
      WebhookSendError,
    );
    expect(() => checkWebhookAddress(new URL("http://localhost/hook"), blocked)).toThrow(
      WebhookSendError,
    );
    expect(() =>
      checkWebhookAddress(new URL("http://localhost/hook"), { allowPrivateAddresses: true }),
    ).not.toThrow();
  });

  it("sees through addresses written as plain numbers", async () => {
    // Browsers and Node read http://2130706433 as http://127.0.0.1.
    const sending = sendWebhookRequest(
      { url: "http://2130706433/hook", body: "{}", headers: {} },
      { allowPrivateAddresses: false, timeoutMilliseconds: 2000 },
    );
    await expect(sending).rejects.toThrow(WebhookSendError);
  });

  it("checks the address a name resolves to, as it connects", async () => {
    // "localhost" stands in for any name that points at a private address.
    const error = await new Promise<Error | null>((resolve) => {
      publicOnlyLookup("localhost", { family: 0 }, (lookupError) => resolve(lookupError));
    });
    expect(error).toBeInstanceOf(WebhookSendError);
    expect(error?.message).toContain("points to a private or local address");
  });
});

describe("signatures", () => {
  const secret = "whsec_test";
  const body = '{"event":"entry.published"}';
  const signedAt = new Date("2026-11-01T09:00:00Z");

  it("can be checked by the receiver, and fail when anything changes", () => {
    const header = signWebhookBody(secret, body, signedAt);

    expect(header).toMatch(/^t=1793523600,v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature(secret, body, header, signedAt)).toBe(true);
    expect(verifyWebhookSignature(secret, `${body} `, header, signedAt)).toBe(false);
    expect(verifyWebhookSignature("whsec_other", body, header, signedAt)).toBe(false);
  });

  it("goes stale after five minutes, so a captured request can't be replayed later", () => {
    const header = signWebhookBody(secret, body, signedAt);
    const later = new Date(signedAt.getTime() + 6 * 60_000);

    expect(verifyWebhookSignature(secret, body, header, later)).toBe(false);
  });
});

describe("retries", () => {
  it("back off from a minute to twelve hours, then give up", () => {
    const now = new Date("2026-11-01T09:00:00Z");
    const minutesLater = (attempts: number) => {
      const retryAt = nextRetryAt(attempts, now);
      return retryAt === null ? null : (retryAt.getTime() - now.getTime()) / 60_000;
    };

    expect([1, 2, 3, 4, 5, 6].map(minutesLater)).toEqual([1, 5, 30, 120, 720, null]);
    expect(MAX_DELIVERY_ATTEMPTS).toBe(6);
  });
});
