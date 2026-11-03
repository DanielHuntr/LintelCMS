import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { countPageVisitors, identifyVisitor, recordGoal } from "./analytics-api.js";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { builtInRoles } from "../roles/built-in-roles.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";
import {
  analyticsDailyTable,
  analyticsEventsTable,
  analyticsSaltsTable,
} from "./analytics.table.js";
import { forgetRecentVisitors, recordVisitorEvent } from "./collection.service.js";
import { forgetAnalyticsTags } from "./page-tag.js";
import { applyRetention, rollUpEveryKeptDay } from "./rollups.service.js";
import { forgetFreshness } from "./stats.service.js";
import { forgetKnownSalts } from "./visitor-hash.js";

const firefox =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0";
const safariPhone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("the Visitors plugin", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let owner: SendRequest;

  beforeEach(async () => {
    forgetRecentVisitors();
    forgetKnownSalts();
    forgetFreshness();
    forgetAnalyticsTags();
    server = await startTestServer(testDatabase.activeDatabase, {
      website: { builtInSiteUrl: "http://localhost:3999" },
    });
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    owner = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
    await owner("PUT", "/plugins", { enabled: ["analytics"] });
  });

  afterEach(() => server.close());

  function collect(
    report: Record<string, unknown>,
    visitor: { ip?: string; userAgent?: string; headers?: Record<string, string> } = {},
  ): Promise<LightMyRequestResponse> {
    return server.inject({
      method: "POST",
      url: "/delivery/analytics/collect",
      remoteAddress: visitor.ip ?? "203.0.113.10",
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "user-agent": visitor.userAgent ?? firefox,
        "accept-language": "en-GB,en;q=0.8",
        ...visitor.headers,
      },
      payload: JSON.stringify({ host: "bakery.test", ...report }),
    });
  }

  async function stats(query = "range=7d", as: SendRequest = owner) {
    forgetFreshness();
    const response = await as("GET", `/analytics/stats?${query}`);
    expect(response.statusCode, response.body).toBe(200);
    return response.json();
  }

  it("answers nothing while it is switched off", async () => {
    await owner("PUT", "/plugins", { enabled: [] });
    for (const response of [
      await collect({ kind: "view", path: "/" }),
      await owner("GET", "/analytics/stats"),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("PLUGIN_NOT_ENABLED");
    }
  });

  it("serves the beacon script", async () => {
    const response = await server.inject({ method: "GET", url: "/delivery/analytics/script.js" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("javascript");
    expect(response.body).toContain("sendBeacon");
    expect(response.body).not.toMatch(/document\.cookie|localStorage|sessionStorage/);
  });

  it("counts visitors, views, sources, devices, countries and time on page", async () => {
    expect(
      (await collect({ kind: "view", path: "/", referrer: "https://www.google.com/" })).statusCode,
    ).toBe(204);
    await collect({ kind: "view", path: "/about?email=sam@example.com", width: 1440 });
    await collect({ kind: "leave", path: "/about", durationMs: 40_000 });
    await collect(
      { kind: "view", path: "/", width: 390, source: "Newsletter", campaign: "Autumn" },
      { ip: "198.51.100.7", userAgent: safariPhone, headers: { "accept-language": "fr-FR" } },
    );
    await collect({ kind: "outbound", path: "/", name: "https://instagram.com/bakery" });
    await collect({ kind: "outbound", path: "/", name: "https://bakery.test/elsewhere" });
    await collect({ kind: "custom", path: "/", name: "signup" });

    const result = await stats();
    expect(result.totals).toMatchObject({ visitors: 2, views: 3, averageSeconds: 40 });
    expect(result.pages).toEqual([
      expect.objectContaining({ key: "/", visitors: 2, views: 2 }),
      expect.objectContaining({ key: "/about", visitors: 1, views: 1, averageSeconds: 40 }),
    ]);
    expect(result.sources.map((row: { key: string }) => row.key).sort()).toEqual([
      "",
      "google.com",
      "newsletter",
    ]);
    expect(result.campaigns).toEqual([expect.objectContaining({ key: "autumn", visitors: 1 })]);
    expect(result.devices.map((row: { key: string }) => row.key).sort()).toEqual([
      "desktop",
      "phone",
    ]);
    expect(result.countries.map((row: { key: string }) => row.key).sort()).toEqual(["FR", "GB"]);
    expect(result.outbound).toEqual([expect.objectContaining({ key: "instagram.com", views: 1 })]);
    expect(result.events).toEqual([expect.objectContaining({ key: "signup", views: 1 })]);
    expect(result.days).toHaveLength(7);
  });

  it("keeps nothing that identifies a visitor: no address, no browser, no query", async () => {
    await collect({
      kind: "view",
      path: "/thanks?email=sam@example.com",
      referrer: "https://mail.example/inbox?id=42",
    });
    const rows = await testDatabase.database.select().from(analyticsEventsTable);
    expect(rows).toHaveLength(1);
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain("203.0.113.10");
    expect(stored).not.toContain("Firefox");
    expect(stored).not.toContain("sam@example.com");
    expect(stored).not.toContain("inbox");
    expect(rows[0]).toMatchObject({ path: "/thanks", source: "mail.example", country: "GB" });
  });

  it("doesn't count people who ask not to be tracked, or robots", async () => {
    await collect({ kind: "view", path: "/" }, { headers: { dnt: "1" } });
    await collect({ kind: "view", path: "/" }, { headers: { "sec-gpc": "1" } });
    await collect(
      { kind: "view", path: "/" },
      { userAgent: "Mozilla/5.0 (compatible; bingbot/2.0)" },
    );
    await collect({ kind: "view", path: "/" }, { userAgent: "curl/8.4.0" });
    expect(await testDatabase.database.select().from(analyticsEventsTable)).toHaveLength(0);
  });

  it("can't link a visitor from one day to the next, and forgets old salts", async () => {
    const site = await findOrCreateDefaultSite(testDatabase.database);
    const visitor = { ipAddress: "203.0.113.10", headers: { "user-agent": firefox } };
    const monday = new Date("2026-11-02T10:00:00Z");
    const tuesday = new Date("2026-11-03T10:00:00Z");
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor,
      { kind: "view", path: "/" },
      monday,
    );
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor,
      { kind: "view", path: "/a" },
      monday,
    );
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor,
      { kind: "view", path: "/" },
      tuesday,
    );

    const rows = await testDatabase.database.select().from(analyticsEventsTable);
    const hashes = rows.map((row) => `${row.day} ${row.visitorHash}`);
    expect(new Set(hashes).size).toBe(2);
    const salts = await testDatabase.database.select().from(analyticsSaltsTable);
    expect(salts.map((salt) => salt.day)).toEqual(["2026-11-03"]);
  });

  it("counts form and order goals from what happened, with a conversion rate", async () => {
    await collect({ kind: "view", path: "/contact" });
    await collect({ kind: "view", path: "/" }, { ip: "198.51.100.7" });
    await server.events.publish(
      "form.submitted",
      {
        form: { id: "00000000-0000-4000-8000-000000000003", handle: "contact", name: "Contact" },
        submission: { id: "00000000-0000-4000-8000-000000000004", fields: {} },
      },
      { actor: null },
    );
    await server.events.publish(
      "order.paid",
      {
        order: {
          id: "o1",
          name: "#1001",
          number: 1001,
          email: "sam@example.com",
          currency: "GBP",
          subtotal: 2000,
          discount: 0,
          discounts: [],
          shipping: 500,
          tax: 0,
          total: 2500,
          refunded: 0,
          paymentStatus: "paid",
          fulfilmentStatus: "unfulfilled",
          paymentProvider: "stripe",
        },
      },
      { actor: null },
    );

    const result = await stats("range=today");
    expect(result.totals).toMatchObject({
      visitors: 2,
      conversions: 2,
      conversionRate: 100,
      value: 2500,
    });
    expect(result.goals.map((row: { key: string }) => row.key).sort()).toEqual([
      "form:contact",
      "order",
    ]);
    const goals = await testDatabase.database.select().from(analyticsEventsTable);
    expect(JSON.stringify(goals)).not.toContain("sam@example.com");
  });

  it("records no goals while the plugin is off", async () => {
    await owner("PUT", "/plugins", { enabled: [] });
    await server.events.publish(
      "form.submitted",
      {
        form: { id: "00000000-0000-4000-8000-000000000003", handle: "contact", name: "Contact" },
        submission: { id: "00000000-0000-4000-8000-000000000004", fields: {} },
      },
      { actor: null },
    );
    expect(await testDatabase.database.select().from(analyticsEventsTable)).toHaveLength(0);
  });

  it("compares with the period before", async () => {
    const site = await findOrCreateDefaultSite(testDatabase.database);
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const visitor = (ip: string) => ({ ipAddress: ip, headers: { "user-agent": firefox } });
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor("1.1.1.1"),
      { kind: "view", path: "/" },
      tenDaysAgo,
    );
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor("1.1.1.2"),
      { kind: "view", path: "/" },
      tenDaysAgo,
    );
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor("1.1.1.3"),
      { kind: "view", path: "/" },
      now,
    );
    await rollUpEveryKeptDay(testDatabase.database);

    const result = await stats("range=7d");
    expect(result.totals.visitors).toBe(1);
    expect(result.previousTotals.visitors).toBe(2);
    const custom = await stats(
      `range=custom&from=${result.previousPeriod.from}&to=${result.period.to}`,
    );
    expect(custom.totals.visitors).toBe(3);
    expect(
      (await owner("GET", "/analytics/stats?range=custom&from=2026-02-01&to=2026-01-01"))
        .statusCode,
    ).toBe(400);
    expect(
      (await owner("GET", "/analytics/stats?range=custom&from=2020-01-01&to=2026-01-01"))
        .statusCode,
    ).toBe(400);
  });

  it("deletes single visits after the retention but keeps the daily figures", async () => {
    const site = await findOrCreateDefaultSite(testDatabase.database);
    const now = new Date("2026-11-03T12:00:00Z");
    const old = new Date("2026-09-20T12:00:00Z");
    const visitor = { ipAddress: "203.0.113.10", headers: { "user-agent": firefox } };
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor,
      { kind: "view", path: "/" },
      old,
    );
    await recordVisitorEvent(
      testDatabase.database,
      site,
      visitor,
      { kind: "view", path: "/" },
      now,
    );

    expect(await applyRetention(testDatabase.database, 30, now)).toBe(1);
    const events = await testDatabase.database.select().from(analyticsEventsTable);
    expect(events.map((event) => event.day)).toEqual(["2026-11-03"]);
    const daily = await testDatabase.database.select().from(analyticsDailyTable);
    expect(daily.some((row) => row.day === "2026-09-20" && row.dimension === "total")).toBe(true);
  });

  it("lets owners, admins and editors see visitors, but not authors", async () => {
    const permissionsOf = (handle: string) =>
      builtInRoles.find((role) => role.handle === handle)?.permissions ?? [];
    await createTestUser(testDatabase.database, "editor@example.com", [permissionsOf("editor")]);
    await createTestUser(testDatabase.database, "author@example.com", [permissionsOf("author")]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
    const author = requestsAs(server, await signInAndGetCookies(server, "author@example.com"));
    expect((await editor("GET", "/analytics/stats")).statusCode).toBe(200);
    expect((await author("GET", "/analytics/stats")).statusCode).toBe(403);
    expect((await author("GET", "/analytics/export")).statusCode).toBe(403);
  });

  it("exports the figures as a spreadsheet", async () => {
    await collect({ kind: "view", path: "/=SUM(A1)" });
    const response = await owner("GET", "/analytics/export?range=today");
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("visitors-");
    expect(response.body).toContain("Day,What,Which,Visitors,Page views");
    expect(response.body).toContain("Whole site");
    // Nothing a spreadsheet would run as a formula.
    expect(response.body).not.toMatch(/,=SUM/);
  });

  it("shows one page's visitors in its editor", async () => {
    await createHomePage(owner);
    const created = await owner("POST", "/collections/pages/entries", {
      data: { title: "About us" },
    });
    await owner("POST", `/entries/${created.json().id}/publish`);
    await collect({ kind: "view", path: "/about-us" });
    await collect({ kind: "view", path: "/" });
    forgetFreshness();

    const response = await owner("GET", `/analytics/entries/${created.json().id}?range=7d`);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ path: "/about-us", totals: { visitors: 1, views: 1 } });
  });
});

describe("the beacon on published pages", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let website: FastifyInstance;
  let owner: SendRequest;

  beforeEach(async () => {
    forgetAnalyticsTags();
    forgetRecentVisitors();
    api = await startTestServer(testDatabase.activeDatabase, {
      website: { builtInSiteUrl: "http://localhost:3999" },
    });
    website = buildSiteServer({ api });
    await website.ready();
    await ensurePagesCollection(testDatabase.database);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    const home = await createHomePage(owner);
    await owner("POST", `/entries/${home}/publish`);
  });

  afterEach(async () => {
    await website.close();
    await api.close();
  });

  const visitHome = () => website.inject({ method: "GET", url: "/" });

  it("is on public pages only while the plugin is on, waiting for consent when asked", async () => {
    expect((await visitHome()).body).not.toContain("analytics/script.js");

    await owner("PUT", "/plugins", { enabled: ["analytics"] });
    forgetAnalyticsTags();
    const page = await visitHome();
    expect(page.body).toContain(
      '<script defer src="/_lintel/api/analytics/script.js" data-site="default"></script></head>',
    );

    await owner("PUT", "/plugins/analytics/settings", {
      retentionDays: 30,
      countOnlyAfterConsent: true,
    });
    forgetAnalyticsTags();
    const strict = await visitHome();
    expect(strict.body).toContain('data-consent="required"');
    expect(strict.headers.etag).not.toBe(page.headers.etag);

    const missing = await website.inject({ method: "GET", url: "/no-such-page" });
    expect(missing.body).not.toContain("analytics/script.js");
  });

  it("counts a visit sent to the website's own address, by the visitor's address", async () => {
    await owner("PUT", "/plugins", { enabled: ["analytics"] });
    const send = (ip: string) =>
      website.inject({
        method: "POST",
        url: "/_lintel/api/analytics/collect?site=default",
        remoteAddress: ip,
        headers: { "content-type": "text/plain;charset=UTF-8", "user-agent": firefox },
        payload: JSON.stringify({ kind: "view", path: "/" }),
      });
    expect((await send("203.0.113.1")).statusCode).toBe(204);
    expect((await send("203.0.113.2")).statusCode).toBe(204);
    const rows = await testDatabase.database.select().from(analyticsEventsTable);
    expect(new Set(rows.map((row) => row.visitorHash)).size).toBe(2);

    const script = await website.inject({ method: "GET", url: "/_lintel/api/analytics/script.js" });
    expect(script.statusCode).toBe(200);
    expect(script.headers["cache-control"]).toBe("public, max-age=3600");
  });
});

describe("what other features use", () => {
  const testDatabase = useTestDatabase();

  it("records goals and counts a page's visitors", async () => {
    forgetKnownSalts();
    const site = await findOrCreateDefaultSite(testDatabase.database);
    const now = new Date("2026-11-03T10:00:00Z");
    const visitor = { siteId: site.id, ipAddress: "203.0.113.10", userAgent: firefox };
    const hash = await identifyVisitor(testDatabase.database, visitor, now);
    expect(hash).toBe(await identifyVisitor(testDatabase.database, visitor, now));
    await recordVisitorEvent(
      testDatabase.database,
      site,
      { ipAddress: visitor.ipAddress, headers: { "user-agent": firefox } },
      { kind: "view", path: "/offer" },
      now,
    );
    await recordGoal(testDatabase.database, {
      siteId: site.id,
      name: "signup",
      visitorHash: hash,
      path: "/offer",
      properties: { experiment: "hero", variant: "b" },
      now,
    });
    const counted = await countPageVisitors(
      testDatabase.database,
      { siteId: site.id, path: "/offer", from: "2026-11-01", to: "2026-11-03" },
      now,
    );
    expect(counted).toEqual({ visitors: 1, views: 1, conversions: 1 });
    const [goal] = await testDatabase.database
      .select()
      .from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.kind, "goal"));
    expect(goal).toMatchObject({
      visitorHash: hash,
      properties: { experiment: "hero", variant: "b" },
    });
  });
});
