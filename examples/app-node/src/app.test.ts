import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { appManifestSchema } from "@lintel/core/app-manifest";
import { signSessionToken } from "@lintel/core/app-session-tokens";
import { signWebhookBody } from "@lintel/core/webhook-signatures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppConfig, readConfig } from "./config.js";
import { createAppServer } from "./server.js";
import { verifySessionToken } from "./session-tokens.js";
import { verifyWebhook } from "./webhook-signatures.js";

// Tokens and signatures here are made by Lintel's own code, so these tests prove the app's
// checks (written without Lintel) agree with what Lintel sends.

const clientId = "app_0123456789abcdef0123";
const clientSecret = "lintelapp_example-secret-for-the-tests-only-123456";
const subject = {
  iss: "http://localhost:4000",
  dest: "http://localhost:5173",
  aud: clientId,
  sub: "a7f0c9c4-3d0b-4c43-a4a1-6b6f6c0f3b11",
  appId: "f2b4a4f6-1e8f-4a39-9a7c-0b4b8f5b0c22",
  permissions: ["entries:read", "collections:read"],
};

describe("checking Lintel's session tokens", () => {
  it("accepts a token Lintel signed for this app", () => {
    const { token } = signSessionToken(clientSecret, subject);
    expect(verifySessionToken(token, { clientId, clientSecret })).toMatchObject({
      userId: subject.sub,
      adminOrigin: "http://localhost:5173",
      permissions: ["entries:read", "collections:read"],
    });
  });

  it("refuses one for another app, signed with another secret, expired or changed", () => {
    const { token } = signSessionToken(clientSecret, subject);
    const later = new Date(Date.now() + 10 * 60_000);
    const [header, payload, signature] = token.split(".");
    const widened = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload ?? "", "base64url").toString()),
        permissions: ["*"],
      }),
    ).toString("base64url");

    expect(verifySessionToken(token, { clientId: "app_other", clientSecret })).toBeUndefined();
    expect(
      verifySessionToken(token, { clientId, clientSecret: "lintelapp_wrong" }),
    ).toBeUndefined();
    expect(verifySessionToken(token, { clientId, clientSecret }, later)).toBeUndefined();
    expect(
      verifySessionToken(`${header}.${widened}.${signature}`, { clientId, clientSecret }),
    ).toBeUndefined();
  });
});

describe("checking Lintel's webhooks", () => {
  const body = JSON.stringify({
    event: "entry.published",
    data: { entry: { id: "e1", title: "Hello" } },
  });

  it("accepts a body Lintel signed, exactly as sent", () => {
    expect(verifyWebhook(body, signWebhookBody(clientSecret, body, new Date()), clientSecret)).toBe(
      true,
    );
    expect(
      verifyWebhook(`${body} `, signWebhookBody(clientSecret, body, new Date()), clientSecret),
    ).toBe(false);
  });

  it("refuses old signatures, other secrets and missing headers", () => {
    const old = signWebhookBody(clientSecret, body, new Date(Date.now() - 10 * 60_000));
    expect(verifyWebhook(body, old, clientSecret)).toBe(false);
    expect(
      verifyWebhook(body, signWebhookBody("lintelapp_other", body, new Date()), clientSecret),
    ).toBe(false);
    expect(verifyWebhook(body, undefined, clientSecret)).toBe(false);
  });
});

describe("the app's server", () => {
  let server: Server;
  let address: string;
  let config: AppConfig;

  beforeEach(async () => {
    config = {
      ...readConfig({}),
      // Nothing listens here, so calls to Lintel's API fail quickly and the app copes.
      lintelApiUrl: "http://127.0.0.1:9",
      clientId,
      clientSecret,
    };
    server = createAppServer(config);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  it("serves a manifest Lintel accepts", async () => {
    const manifest = await (await fetch(`${address}/lintel-app.json`)).json();
    const checked = appManifestSchema.safeParse(manifest);
    expect(checked.success, JSON.stringify(checked.error?.issues)).toBe(true);
  });

  it("lets only the Lintel admin frame its pages, and serves the bridge", async () => {
    const page = await fetch(`${address}/admin/log`);
    expect(page.headers.get("content-security-policy")).toContain(
      "frame-ancestors http://localhost:5173",
    );
    expect(await page.text()).toContain('src="/assets/page.js"');

    const bridge = await fetch(`${address}/assets/app-bridge/index.js`);
    expect(bridge.status).toBe(200);
    expect(await bridge.text()).toContain("createAppBridge");
    expect((await fetch(`${address}/assets/..%2Fpackage.json`)).status).toBe(404);
  });

  it("answers its own API only with a valid session token", async () => {
    expect((await fetch(`${address}/api/log`)).status).toBe(401);

    const { token } = signSessionToken(clientSecret, subject);
    const response = await fetch(`${address}/api/log`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      you: { userId: subject.sub, permissions: subject.permissions },
      events: [],
      collectionCount: null,
    });
  });

  it("records signed webhooks and refuses unsigned ones", async () => {
    const body = JSON.stringify({
      event: "entry.published",
      occurredAt: "2026-11-01T12:00:00.000Z",
      data: { entry: { id: "e1", title: "Opening hours" } },
    });
    const send = (signature: string) =>
      fetch(`${address}/webhooks`, {
        method: "POST",
        body,
        headers: { "lintel-signature": signature },
      });

    expect((await send("t=1,v1=00")).status).toBe(401);
    expect((await send(signWebhookBody(clientSecret, body, new Date()))).status).toBe(204);

    const { token } = signSessionToken(clientSecret, subject);
    const log = await fetch(`${address}/api/log?entryId=e1`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect((await log.json()).events).toEqual([
      {
        event: "entry.published",
        entryId: "e1",
        title: "Opening hours",
        at: "2026-11-01T12:00:00.000Z",
      },
    ]);
  });
});
