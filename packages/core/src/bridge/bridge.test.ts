import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildBridgeConfig, guardPrivateFile, unguardPrivateFile } from "./bridge-files.js";
import { hmacHex, signedRequestHeaders, signEnvelope } from "./bridge-signing.js";
import type { ShopCatalogue } from "./shop-catalogue.service.js";

/**
 * The PHP companion, run with PHP's own web server. Without PHP on this machine these
 * tests are skipped; the signing they rely on is also checked in bridge-signing.test.ts.
 */
const hasPhp = (() => {
  try {
    execFileSync("php", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const SECRET = "a".repeat(64);
const STRIPE_WEBHOOK_SECRET = "whsec_test";
const MARKET = "11111111-1111-4111-8111-111111111111";
const LOAF = "22222222-2222-4222-8222-222222222222";

function catalogue(stock: number): ShopCatalogue {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    markets: [
      {
        id: MARKET,
        name: "United Kingdom",
        currency: "GBP",
        countries: ["GB"],
        isPrimary: true,
        taxesIncluded: true,
        paymentProvider: "stripe",
      },
    ],
    variants: {
      [LOAF]: {
        productId: "33333333-3333-4333-8333-333333333333",
        productTitle: "Sourdough loaf",
        variantTitle: "Default",
        sku: "LOAF",
        imageId: null,
        weightGrams: 800,
        prices: { [MARKET]: 450 },
        stock,
      },
    },
    shipping: [
      {
        countries: ["GB"],
        rates: [
          {
            id: "rate-1",
            name: "Standard",
            deliveryEstimate: "2 days",
            kind: "flat",
            byMarket: { [MARKET]: { amount: 395, brackets: [], freeOver: 3000 } },
          },
        ],
      },
    ],
    taxes: { rates: { GB: 20 }, taxShipping: false },
    discounts: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        code: "BREAD10",
        title: "10% off",
        kind: "percentage",
        percentOff: 10,
        amounts: {},
        minimumSpend: {},
        scope: "order",
        productIds: [],
        startsAt: "2020-01-01T00:00:00.000Z",
        endsAt: null,
        usageLimit: null,
        usedCount: 0,
      },
    ],
  };
}

const CATALOGUE = "catalogue.php";

describe.skipIf(!hasPhp)("the PHP companion", { timeout: 60_000 }, () => {
  let folder = "";
  let php: ChildProcess;
  let payments: Server;
  let base = "";
  const sessions: Array<Record<string, string>> = [];

  function writePrivate(name: string, content: string) {
    const guarded = name === "config.php" ? content : guardPrivateFile(content);
    writeFileSync(join(folder, "lintel-private", name), guarded);
  }

  beforeAll(async () => {
    folder = mkdtempSync(join(tmpdir(), "lintel-bridge-"));
    mkdirSync(join(folder, "site"));
    mkdirSync(join(folder, "lintel-private"));
    copyFileSync(
      new URL("./lintel-bridge.php", import.meta.url),
      join(folder, "site", "lintel-bridge.php"),
    );

    payments = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk: Buffer) => (body += chunk.toString()));
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        if (request.url === "/v1/checkout/sessions") {
          sessions.push(Object.fromEntries(new URLSearchParams(body)));
          response.end(
            JSON.stringify({
              id: `cs_${sessions.length}`,
              url: `https://checkout.test/${sessions.length}`,
            }),
          );
          return;
        }
        if (request.url === "/v2/payments" && request.method === "POST") {
          response.end(
            JSON.stringify({
              id: "tr_new",
              _links: { checkout: { href: "https://mollie.test/pay" } },
            }),
          );
          return;
        }
        if (request.url?.startsWith("/v2/payments/tr_paid")) {
          response.end(
            JSON.stringify({
              id: "tr_paid",
              status: "paid",
              amount: { currency: "GBP", value: "8.45" },
              metadata: { lintel_hold: mollieHold },
            }),
          );
          return;
        }
        response.statusCode = 404;
        response.end("{}");
      });
    });
    await new Promise<void>((resolve) => payments.listen(0, "127.0.0.1", () => resolve()));
    const paymentsBase = `http://127.0.0.1:${(payments.address() as AddressInfo).port}`;

    writePrivate(
      "config.php",
      buildBridgeConfig({
        secret: SECRET,
        siteAddress: "https://www.example.com",
        stripeSecretKey: "sk_test_123",
        stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,
        mollieApiKey: "test_mollie",
        emailFromHost: false,
        emailFrom: "",
        stripeApiBase: paymentsBase,
        mollieApiBase: paymentsBase,
      }),
    );
    writePrivate(
      "forms.php",
      signEnvelope(SECRET, {
        forms: {
          contact: {
            name: "Contact",
            acceptingSubmissions: true,
            confirmation: { type: "message", message: "Thanks, we'll be in touch." },
            notify: [],
            fields: [
              { handle: "name", label: "Name", type: "shortText", required: true, choices: [] },
              { handle: "email", label: "Email", type: "email", required: true, choices: [] },
            ],
          },
        },
      }),
    );
    writePrivate(CATALOGUE, signEnvelope(SECRET, catalogue(3)));

    const port = 18_000 + Math.floor(Math.random() * 1_000);
    php = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", join(folder, "site")], {
      env: { ...process.env, PHP_CLI_SERVER_WORKERS: "6" },
      stdio: "ignore",
    });
    base = `http://127.0.0.1:${port}/lintel-bridge.php`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        await fetch(`${base}?action=nothing`);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error("PHP's web server didn't start.");
  });

  afterAll(async () => {
    php?.kill();
    await new Promise<void>((resolve) => payments.close(() => resolve()));
    rmSync(folder, { recursive: true, force: true });
  });

  let mollieHold = "";

  function signed(action: "status" | "pull" | "ack", body = "") {
    return fetch(`${base}?action=${action}`, {
      method: action === "ack" ? "POST" : "GET",
      headers: signedRequestHeaders(SECRET, action, body),
      ...(action === "ack" ? { body } : {}),
    });
  }

  function postJson(action: string, body: unknown) {
    return fetch(`${base}?action=${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const basket = (quantity = 1, extra: Record<string, unknown> = {}) => ({
    lines: [{ variantId: LOAF, quantity, price: 1 }],
    country: "GB",
    email: "sam@example.com",
    address: { name: "Sam Rivera", line1: "1 High Street", city: "Bath", postalCode: "BA1 1AA" },
    ...extra,
  });

  it("answers signed requests from Lintel once, and refuses forged, old or replayed ones", async () => {
    const headers = signedRequestHeaders(SECRET, "status", "");
    const first = await fetch(`${base}?action=status`, { headers });
    expect(first.status).toBe(200);
    expect(((await first.json()) as { bridgeVersion: number }).bridgeVersion).toBe(1);

    const replayed = await fetch(`${base}?action=status`, { headers });
    expect(replayed.status).toBe(401);
    expect(((await replayed.json()) as { error: string }).error).toContain("already used");

    const forged = await fetch(`${base}?action=status`, {
      headers: signedRequestHeaders("b".repeat(64), "status", ""),
    });
    expect(forged.status).toBe(401);

    const old = await fetch(`${base}?action=status`, {
      headers: signedRequestHeaders(SECRET, "status", "", new Date(Date.now() - 10 * 60_000)),
    });
    expect(old.status).toBe(401);

    // A signature for one action can't be used for another.
    const borrowed = await fetch(`${base}?action=pull`, {
      headers: signedRequestHeaders(SECRET, "status", ""),
    });
    expect(borrowed.status).toBe(401);
  });

  it("keeps a form's answers for Lintel, after the honeypot and the timer", async () => {
    const opened = String(Math.floor(Date.now() / 1000) - 30);
    const token = `${opened}.${hmacHex(SECRET, `form:contact.${opened}`)}`;
    const send = (fields: Record<string, string>) =>
      fetch(`${base}?action=form&form=contact`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: new URLSearchParams(fields).toString(),
      });

    const fresh = (await (await fetch(`${base}?action=token&form=contact`)).json()) as {
      token: string;
    };
    const tooFast = await send({ _token: fresh.token, name: "Bot", email: "bot@example.com" });
    expect(tooFast.status).toBe(201);
    const bot = await send({
      _token: token,
      _website: "spam.example",
      name: "Bot",
      email: "bot@example.com",
    });
    expect(bot.status).toBe(201);
    const missing = await send({ _token: token, name: "Sam" });
    expect(missing.status).toBe(422);
    expect(await missing.text()).toContain("Please fill in “Email”");
    const forged = await send({ _token: `${opened}.nope`, name: "Sam", email: "sam@example.com" });
    expect(forged.status).toBe(400);

    const kept = await send({ _token: token, name: "Sam Rivera", email: "sam@example.com" });
    expect(kept.status).toBe(201);

    const pulled = (await (await signed("pull")).json()) as {
      submissions: Array<{ id: string; values: Record<string, string> }>;
    };
    expect(pulled.submissions).toHaveLength(1);
    expect(pulled.submissions[0]?.values).toEqual({ name: "Sam Rivera", email: "sam@example.com" });

    const ack = JSON.stringify({ submissions: [pulled.submissions[0]?.id], orders: [] });
    expect((await signed("ack", ack)).status).toBe(200);
    const after = (await (await signed("pull")).json()) as { submissions: unknown[] };
    expect(after.submissions).toHaveLength(0);
  });

  it("works out totals from the signed catalogue, ignoring prices sent by the browser", async () => {
    const quote = (await (
      await postJson("quote", basket(2, { discountCode: "bread10" }))
    ).json()) as Record<string, number>;
    // 2 × £4.50 = £9.00, 10% off = £8.10, plus £3.95 delivery; VAT is included in UK prices.
    expect(quote.subtotalAmount).toBe(900);
    expect(quote.discountAmount).toBe(90);
    expect(quote.shippingAmount).toBe(395);
    expect(quote.totalAmount).toBe(1205);
    expect(quote.taxAmount).toBe(135);

    const unknownCode = await postJson("quote", basket(1, { discountCode: "FREEBREAD" }));
    expect(unknownCode.status).toBe(400);
    const unknownVariant = await postJson("quote", {
      ...basket(),
      lines: [{ variantId: "nope", quantity: 1 }],
    });
    expect(unknownVariant.status).toBe(400);
  });

  it("refuses a catalogue changed on the host without Lintel's signature", async () => {
    const tampered = JSON.parse(signEnvelope(SECRET, catalogue(3))) as {
      payload: string;
      signature: string;
    };
    tampered.payload = tampered.payload.replace(
      '"prices":{"' + MARKET + '":450}',
      '"prices":{"' + MARKET + '":1}',
    );
    writePrivate(CATALOGUE, JSON.stringify(tampered));
    try {
      const answer = await postJson("quote", basket());
      expect(answer.status).toBe(503);
      expect(((await answer.json()) as { error: string }).error).toContain(
        "don't match what Lintel published",
      );
    } finally {
      writePrivate(CATALOGUE, signEnvelope(SECRET, catalogue(3)));
    }
  });

  it("never sells more than is in stock, however many people pay at once", async () => {
    const answers = await Promise.all(
      Array.from({ length: 8 }, () => postJson("checkout", basket(1))),
    );
    const statuses = answers.map((answer) => answer.status).sort();
    expect(statuses.filter((status) => status === 200)).toHaveLength(3);
    expect(statuses.filter((status) => status === 409)).toHaveLength(5);
    const soldOut = answers.find((answer) => answer.status === 409);
    expect(((await soldOut?.json()) as { error: string }).error).toContain("Sourdough loaf");
    // The payment page was asked for the catalogue's total, not anything from the browser.
    expect(sessions.at(-1)?.["line_items[0][price_data][unit_amount]"]).toBe("845");
  });

  it("takes paid orders only from Stripe's signed messages, once each", async () => {
    writePrivate(CATALOGUE, signEnvelope(SECRET, catalogue(10)));
    const started = (await (await postJson("checkout", basket(1))).json()) as { holdId: string };
    const event = (id: string, amount: number) =>
      JSON.stringify({
        id,
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_1",
            payment_status: "paid",
            amount_total: amount,
            currency: "gbp",
            payment_intent: "pi_1",
            metadata: { lintel_hold: started.holdId },
          },
        },
      });
    const deliver = (
      payload: string,
      secret = STRIPE_WEBHOOK_SECRET,
      time = Math.floor(Date.now() / 1000),
    ) =>
      fetch(`${base}?action=stripe-webhook`, {
        method: "POST",
        headers: {
          "stripe-signature": `t=${time},v1=${hmacHex(secret, `${time}.${payload}`)}`,
          "content-type": "application/json",
        },
        body: payload,
      });

    expect((await deliver(event("evt_1", 845), "whsec_wrong")).status).toBe(400);
    expect(
      (
        await deliver(
          event("evt_1", 845),
          STRIPE_WEBHOOK_SECRET,
          Math.floor(Date.now() / 1000) - 3600,
        )
      ).status,
    ).toBe(400);
    const paid = await deliver(event("evt_1", 845));
    expect(paid.status).toBe(200);
    expect((await deliver(event("evt_1", 845))).status).toBe(200);

    const pulled = (await (await signed("pull")).json()) as {
      orders: Array<{ id: string; matches: boolean; totalAmount: number }>;
    };
    const orders = pulled.orders.filter((order) => order.id === started.holdId);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.matches).toBe(true);
    expect(orders[0]?.totalAmount).toBe(845);
  });

  it("records a payment that arrives days later, as bank debits do", async () => {
    writePrivate(CATALOGUE, signEnvelope(SECRET, catalogue(10)));
    const started = (await (await postJson("checkout", basket(1))).json()) as { holdId: string };
    const deliver = (id: string, type: string, status: string) => {
      const payload = JSON.stringify({
        id,
        type,
        data: {
          object: {
            id: "cs_delayed",
            payment_status: status,
            amount_total: 845,
            currency: "gbp",
            payment_intent: "pi_delayed",
            metadata: { lintel_hold: started.holdId },
          },
        },
      });
      const time = Math.floor(Date.now() / 1000);
      return fetch(`${base}?action=stripe-webhook`, {
        method: "POST",
        headers: {
          "stripe-signature": `t=${time},v1=${hmacHex(STRIPE_WEBHOOK_SECRET, `${time}.${payload}`)}`,
          "content-type": "application/json",
        },
        body: payload,
      });
    };
    const queue = () => readdirSync(join(folder, "lintel-private", "data", "queue", "orders"));

    await deliver("evt_delayed_1", "checkout.session.completed", "unpaid");
    expect(queue()).not.toContain(`${started.holdId}.php`);

    // Three days on, with another shopper's checkout having tidied the holds since.
    const holdsFile = join(folder, "lintel-private", "data", "holds.php");
    const holds = JSON.parse(unguardPrivateFile(readFileSync(holdsFile, "utf8"))) as Record<
      string,
      { expiresAt: number }
    >;
    const hold = holds[started.holdId];
    if (!hold) throw new Error("The hold wasn't kept.");
    hold.expiresAt = Math.floor(Date.now() / 1000) - 3 * 86_400;
    writeFileSync(holdsFile, guardPrivateFile(JSON.stringify(holds)));
    await postJson("checkout", basket(1));

    const paid = await deliver("evt_delayed_2", "checkout.session.async_payment_succeeded", "paid");
    expect(paid.status).toBe(200);
    expect(queue()).toContain(`${started.holdId}.php`);
  });

  it("says whether Stripe called a payment live, and says nothing when Stripe doesn't", async () => {
    writePrivate(CATALOGUE, signEnvelope(SECRET, catalogue(10)));
    const deliver = async (id: string, livemode: boolean | undefined) => {
      const started = (await (await postJson("checkout", basket(1))).json()) as { holdId: string };
      const payload = JSON.stringify({
        id,
        type: "checkout.session.completed",
        ...(livemode === undefined ? {} : { livemode }),
        data: {
          object: {
            id: `cs_${id}`,
            payment_status: "paid",
            amount_total: 845,
            currency: "gbp",
            payment_intent: `pi_${id}`,
            metadata: { lintel_hold: started.holdId },
          },
        },
      });
      const time = Math.floor(Date.now() / 1000);
      await fetch(`${base}?action=stripe-webhook`, {
        method: "POST",
        headers: {
          "stripe-signature": `t=${time},v1=${hmacHex(STRIPE_WEBHOOK_SECRET, `${time}.${payload}`)}`,
          "content-type": "application/json",
        },
        body: payload,
      });
      return started.holdId;
    };
    const test = await deliver("evt_test", false);
    const live = await deliver("evt_live", true);
    const unsaid = await deliver("evt_unsaid", undefined);

    const pulled = (await (await signed("pull")).json()) as {
      orders: Array<{ id: string; livemode?: boolean | null }>;
    };
    const said = new Map(pulled.orders.map((order) => [order.id, order.livemode]));
    expect(said.get(test)).toBe(false);
    expect(said.get(live)).toBe(true);
    expect(said.get(unsaid) ?? null).toBeNull();
  });

  it("reveals nothing to a direct download, even where .htaccess means nothing", async () => {
    writePrivate(CATALOGUE, signEnvelope(SECRET, catalogue(10)));
    const opened = String(Math.floor(Date.now() / 1000) - 30);
    const sent = await fetch(`${base}?action=form&form=contact`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        _token: `${opened}.${hmacHex(SECRET, `form:contact.${opened}`)}`,
        name: '<?php echo "ran"; ?> Ann Visitor',
        email: "ann.visitor@example.com",
      }).toString(),
    });
    expect(sent.status).toBe(201);
    expect((await postJson("checkout", basket(1))).status).toBe(200);

    // PHP's own server ignores .htaccess and web.config, as Nginx does.
    const port = 18_000 + Math.floor(Math.random() * 1_000);
    const exposed = spawn(
      "php",
      ["-S", `127.0.0.1:${port}`, "-t", join(folder, "lintel-private")],
      {
        stdio: "ignore",
      },
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const files = readdirSync(join(folder, "lintel-private"), { recursive: true })
        .map((file) => String(file).replaceAll("\\", "/"))
        .filter((file) => /\.[a-z]+$/.test(file));
      expect(files.length).toBeGreaterThan(3);
      for (const file of files) {
        const body = await (await fetch(`http://127.0.0.1:${port}/${file}`)).text();
        for (const secret of ["sam@example.com", "Ann Visitor", "ran", "Sourdough", SECRET]) {
          expect(body, file).not.toContain(secret);
        }
      }
    } finally {
      exposed.kill();
    }
  });

  it("moves what an older companion kept into files that reveal nothing", async () => {
    const data = join(folder, "lintel-private", "data");
    const order = { id: "abcabcabc0", email: "old@example.com" };
    mkdirSync(join(data, "queue", "orders"), { recursive: true });
    writeFileSync(join(data, "queue", "orders", `${order.id}.json`), JSON.stringify(order));

    const pulled = (await (await signed("pull")).json()) as { orders: Array<{ id: string }> };

    expect(pulled.orders.map((item) => item.id)).toContain(order.id);
    const left = readdirSync(data, { recursive: true }).map(String);
    expect(left.filter((file) => file.endsWith(".json"))).toEqual([]);
  });

  it("finds, hands over and erases one person's details, and nobody else's", async () => {
    writePrivate(CATALOGUE, signEnvelope(SECRET, catalogue(100)));
    const asked = async (action: "privacy-find" | "privacy-erase", body: object) => {
      const text = JSON.stringify(body);
      const response = await fetch(`${base}?action=${action}`, {
        method: "POST",
        headers: signedRequestHeaders(SECRET, action, text),
        body: text,
      });
      expect(response.status, await response.clone().text()).toBe(200);
      return (await response.json()) as {
        records: Array<{ id: string; email: string; summary: string; data: object }>;
        erased: number;
      };
    };
    const shopper = (email: string, name: string) =>
      basket(1, {
        email,
        address: { name, line1: "2 Low Road", city: "Bath", postalCode: "BA1 1AA" },
      });
    const hers = (await (
      await postJson("checkout", shopper("erin@example.com", "Erin Holt"))
    ).json()) as { holdId: string };
    const his = (await (
      await postJson("checkout", shopper("omar@example.com", "Omar Reed"))
    ).json()) as { holdId: string };

    const found = await asked("privacy-find", { email: "Erin@Example.com", name: null });
    expect(found.records.map((record) => record.id)).toEqual([`hold:${hers.holdId}`]);
    expect(JSON.stringify(found.records[0]?.data)).toContain("2 Low Road");
    const byName = await asked("privacy-find", { email: null, name: "erin holt" });
    expect(byName.records.map((record) => record.id)).toEqual([`hold:${hers.holdId}`]);

    const erased = await asked("privacy-erase", { ids: [`hold:${hers.holdId}`] });
    expect(erased.erased).toBe(1);

    const holdsFile = join(folder, "lintel-private", "data", "holds.php");
    const kept = readFileSync(holdsFile, "utf8");
    expect(kept).not.toContain("erin@example.com");
    expect(kept).not.toContain("Erin Holt");
    expect(kept).toContain("omar@example.com");
    expect(kept).toContain(his.holdId);
    expect(kept).toContain(hers.holdId);
    expect(
      (await asked("privacy-find", { email: "erin@example.com", name: null })).records,
    ).toEqual([]);
  });

  it("checks Mollie's message by asking Mollie about the payment", async () => {
    const catalogueWithMollie = catalogue(100);
    const market = catalogueWithMollie.markets[0];
    if (market) market.paymentProvider = "mollie";
    writePrivate(CATALOGUE, signEnvelope(SECRET, catalogueWithMollie));
    const response = await postJson("checkout", basket(1));
    expect(response.status, await response.clone().text()).toBe(200);
    mollieHold = ((await response.json()) as { holdId: string }).holdId;

    const ignored = await fetch(`${base}?action=mollie-webhook`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "id=tr_unknown",
    });
    expect(ignored.status).toBe(200);
    const paid = await fetch(`${base}?action=mollie-webhook`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "id=tr_paid",
    });
    expect(paid.status).toBe(200);
    const queue = readdirSync(join(folder, "lintel-private", "data", "queue", "orders"));
    expect(queue).toContain(`${mollieHold}.php`);
  });
});
