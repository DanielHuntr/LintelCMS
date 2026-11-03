import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { readConfig } from "../src/config.js";
import { createAppServer } from "../src/server.js";
import { verifySessionToken } from "../src/session-tokens.js";
import { verifyWebhook } from "../src/webhook-signatures.js";

// Tokens and signatures made here the way Lintel makes them (see the docs page "Building an
// app"), so the app's checks are tested against what Lintel sends.

const clientId = "app_0123456789abcdef0123";
const clientSecret = "lintelapp_a-secret-for-these-tests-only-0123456789";

function sessionToken(changes = {}, secret = clientSecret) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: "http://localhost:4000",
    dest: "http://localhost:5173",
    aud: clientId,
    sub: randomUUID(),
    appId: randomUUID(),
    permissions: ["entries:read"],
    iat: now,
    nbf: now,
    exp: now + 300,
    jti: randomUUID(),
    ...changes,
  });
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

function webhookSignature(body, secret = clientSecret, at = new Date()) {
  const timestamp = Math.floor(at.getTime() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("session tokens", () => {
  it("accepts one Lintel signed for this app", () => {
    const session = verifySessionToken(sessionToken(), { clientId, clientSecret });
    assert.deepEqual(session?.permissions, ["entries:read"]);
  });

  it("refuses one for another app, with another secret, or out of date", () => {
    const app = { clientId, clientSecret };
    assert.equal(verifySessionToken(sessionToken({ aud: "app_other" }), app), undefined);
    assert.equal(verifySessionToken(sessionToken({}, "lintelapp_wrong"), app), undefined);
    assert.equal(verifySessionToken(sessionToken({ exp: 1 }), app), undefined);
    assert.equal(verifySessionToken("not.a.token", app), undefined);
  });
});

describe("webhooks", () => {
  const body = JSON.stringify({ event: "entry.published", data: { entry: { title: "Hi" } } });

  it("accepts a body Lintel signed", () => {
    assert.equal(verifyWebhook(body, webhookSignature(body), clientSecret), true);
  });

  it("refuses a changed body, another secret or an old signature", () => {
    const old = new Date(Date.now() - 10 * 60_000);
    assert.equal(verifyWebhook(`${body} `, webhookSignature(body), clientSecret), false);
    assert.equal(
      verifyWebhook(body, webhookSignature(body, "lintelapp_wrong"), clientSecret),
      false,
    );
    assert.equal(
      verifyWebhook(body, webhookSignature(body, clientSecret, old), clientSecret),
      false,
    );
    assert.equal(verifyWebhook(body, undefined, clientSecret), false);
  });
});

describe("the app's server", () => {
  let server;
  let address;

  before(async () => {
    const config = readConfig({
      PORT: "0",
      APP_URL: "http://localhost:3200",
      LINTEL_API_URL: "http://127.0.0.1:9",
      LINTEL_CLIENT_ID: clientId,
      LINTEL_CLIENT_SECRET: clientSecret,
    });
    server = createAppServer(config);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    address = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  it("serves its manifest, on its own address", async () => {
    const manifest = await (await fetch(`${address}/lintel-app.json`)).json();
    assert.equal(manifest.handle, "__APP_HANDLE__");
    assert.equal(manifest.admin.page.url, "http://localhost:3200/admin/page");
  });

  it("lets only the Lintel admin show its page", async () => {
    const page = await fetch(`${address}/admin/page`);
    assert.match(
      page.headers.get("content-security-policy"),
      /frame-ancestors http:\/\/localhost:5173/,
    );
  });

  it("answers its page only with a valid session token", async () => {
    const without = await fetch(`${address}/api/hello`);
    assert.equal(without.status, 401);
    const withToken = await fetch(`${address}/api/hello`, {
      headers: { authorization: `Bearer ${sessionToken()}` },
    });
    assert.equal(withToken.status, 200);
  });

  it("takes webhooks only with Lintel's signature", async () => {
    const body = JSON.stringify({ event: "entry.published", data: { entry: { title: "Hi" } } });
    const send = (signature) =>
      fetch(`${address}/webhooks`, {
        method: "POST",
        headers: { "content-type": "application/json", "lintel-signature": signature },
        body,
      });
    assert.equal((await send("t=1,v1=00")).status, 401);
    assert.equal((await send(webhookSignature(body))).status, 204);
  });
});
