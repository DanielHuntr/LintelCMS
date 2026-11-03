import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyticsEventsTable } from "../analytics/analytics.table.js";
import { forgetRecentVisitors } from "../analytics/collection.service.js";
import { forgetAnalyticsTags } from "../analytics/page-tag.js";
import { forgetFreshness } from "../analytics/stats.service.js";
import { forgetKnownSalts } from "../analytics/visitor-hash.js";
import { ensureCollection } from "../collections/collections.service.js";
import { pagesWithSimpleSectionsCollection } from "../collections/default-collections.js";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";

/**
 * Visitors, A/B tests and the cookie notice working together (docs/decisions/0051): tests
 * tag Visitors' page views with the version shown and can use Visitors' goals, and each
 * plugin's "only after they accept" setting puts it in the cookie notice.
 */

const firefox = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

function bakeryDesign(): PageDocument {
  const page = createEmptyPage();
  const section = createNode(
    {
      type: "section",
      children: [
        { type: "heading", props: { text: "Fresh bread daily" } },
        { type: "button", props: { text: "Get in touch", href: "/contact" } },
      ],
    },
    standardCatalogue,
    createCountingNodeIds("n"),
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

/** What a page tells a script in `<script type="application/json" id="…">`, or null. */
function pageSettings(html: string, id: string): Record<string, unknown> | null {
  const json = new RegExp(`<script type="application/json" id="${id}">(.*?)</script>`, "s").exec(
    html,
  )?.[1];
  return json ? (JSON.parse(json) as Record<string, unknown>) : null;
}

describe("Visitors, A/B tests and the cookie notice", { timeout: 30000 }, () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let admin: SendRequest;
  let pageId: string;

  beforeEach(async () => {
    forgetAnalyticsTags();
    forgetRecentVisitors();
    forgetKnownSalts();
    forgetFreshness();
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    site = buildSiteServer({ api });
    await site.ready();
    await ensureCollection(testDatabase.database, pagesWithSimpleSectionsCollection);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    admin = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    await createHomePage(admin);
    const created = await admin("POST", "/collections/pages/entries", {
      data: { title: "Bakery", design: bakeryDesign() },
      slug: "bakery",
    });
    expect(created.statusCode, created.body).toBe(201);
    pageId = created.json().id;
    await admin("POST", `/entries/${pageId}/publish`);
  }, 30000);

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  const visit = (url = "/bakery", address = "203.0.113.7") =>
    site.inject({ method: "GET", url, remoteAddress: address, headers: { "user-agent": firefox } });

  async function enable(...plugins: string[]) {
    const saved = await admin("PUT", "/plugins", { enabled: plugins });
    expect(saved.statusCode, saved.body).toBe(200);
    forgetAnalyticsTags();
  }

  async function startTest(goal: Record<string, unknown>) {
    const created = await admin("POST", "/experiments", { entryId: pageId });
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().id as string;
    const patched = await admin("PATCH", `/experiments/${id}`, { goal });
    expect(patched.statusCode, patched.body).toBe(200);
    const started = await admin("POST", `/experiments/${id}/start`);
    expect(started.statusCode, started.body).toBe(200);
    return id;
  }

  describe("Visitors counts", () => {
    it("are in the cookie notice only while they wait for visitors to accept", async () => {
      await enable("analytics");
      expect(pageSettings((await visit()).body, "lintel-cookie-notice")).toBeNull();
      expect((await admin("GET", "/website/cookie-notice")).json().services).toEqual([]);

      const saved = await admin("PUT", "/plugins/analytics/settings", {
        retentionDays: 30,
        countOnlyAfterConsent: true,
      });
      expect(saved.statusCode, saved.body).toBe(200);
      forgetAnalyticsTags();
      const page = (await visit()).body;
      expect(page).toContain('data-consent="required"');
      expect(pageSettings(page, "lintel-cookie-notice")).toMatchObject({
        services: [{ id: "plugin:analytics", name: "Visitor counts" }],
      });
      expect((await admin("GET", "/website/cookie-notice")).json()).toMatchObject({
        services: [{ id: "plugin:analytics", name: "Visitor counts" }],
        shown: true,
      });

      // Switched off, the plugin's setting asks nobody anything.
      await enable();
      expect(pageSettings((await visit()).body, "lintel-cookie-notice")).toBeNull();
    });
  });

  describe("A/B test counts", () => {
    it("wait for consent only when the site asks, and are then in the cookie notice", async () => {
      await enable("experiments");
      await startTest({ kind: "click", target: "/contact" });
      const before = (await visit()).body;
      expect(pageSettings(before, "lintel-tests")).not.toHaveProperty("consent");
      expect(pageSettings(before, "lintel-cookie-notice")).toBeNull();

      const saved = await admin("PUT", "/plugins/experiments/settings", {
        countOnlyAfterConsent: true,
      });
      expect(saved.statusCode, saved.body).toBe(200);
      const after = (await visit()).body;
      expect(pageSettings(after, "lintel-tests")).toMatchObject({ consent: "required" });
      expect(pageSettings(after, "lintel-cookie-notice")).toMatchObject({
        services: [{ id: "plugin:experiments", name: "A/B test counts" }],
      });
      // The version is still chosen on the server, for everyone taking part.
      expect(after).toContain("data-lintel-test=");
    });

    it("list both services when both plugins ask first", async () => {
      await enable("analytics", "experiments");
      await admin("PUT", "/plugins/analytics/settings", {
        retentionDays: 30,
        countOnlyAfterConsent: true,
      });
      await admin("PUT", "/plugins/experiments/settings", { countOnlyAfterConsent: true });
      const described = (await admin("GET", "/website/cookie-notice")).json();
      expect(described.services).toEqual([
        { id: "plugin:experiments", name: "A/B test counts", countsWithoutCookies: true },
        { id: "plugin:analytics", name: "Visitor counts", countsWithoutCookies: true },
      ]);
      // Counting sets no cookies, so the notice doesn't say it may.
      expect(pageSettings((await visit()).body, "lintel-cookie-notice")).toMatchObject({
        message: "This site counts visits without cookies. Nothing is counted until you say so.",
      });
    });
  });

  describe("tests and Visitors", () => {
    it("use a goal Visitors counts, which the page's script is told about", async () => {
      await enable("analytics", "experiments");
      const created = await admin("POST", "/experiments", { entryId: pageId });
      const wrong = await admin("PATCH", `/experiments/${created.json().id}`, {
        goal: { kind: "analytics", name: "<script>" },
      });
      expect(wrong.statusCode).toBe(400);
      await admin("DELETE", `/experiments/${created.json().id}`);

      await startTest({ kind: "analytics", name: "form:contact" });
      const settings = pageSettings((await visit()).body, "lintel-tests");
      expect(settings).toMatchObject({
        tests: [{ goal: { kind: "analytics", name: "form:contact" } }],
      });
    });

    it("tag page views with the version shown, as a breakdown on the Visitors screen", async () => {
      await enable("analytics", "experiments");
      const id = await startTest({ kind: "analytics", name: "signup" });
      const collect = (address: string, version: string, extra: Record<string, unknown> = {}) =>
        site.inject({
          method: "POST",
          url: "/_lintel/api/analytics/collect?site=default",
          remoteAddress: address,
          headers: { "content-type": "text/plain;charset=UTF-8", "user-agent": firefox },
          payload: JSON.stringify({
            kind: "view",
            path: "/bakery",
            experiment: id,
            version,
            ...extra,
          }),
        });
      expect((await collect("203.0.113.1", "b")).statusCode).toBe(204);
      expect((await collect("203.0.113.2", "b")).statusCode).toBe(204);
      expect((await collect("203.0.113.3", "original")).statusCode).toBe(204);
      // Not a version a test can have: refused, and nothing is kept.
      expect((await collect("203.0.113.4", "z")).statusCode).toBe(400);

      const rows = await testDatabase.database.select().from(analyticsEventsTable);
      expect(rows.map((row) => row.properties)).toContainEqual({ experiment: id, variant: "b" });

      forgetFreshness();
      const stats = (await admin("GET", "/analytics/stats?range=7d")).json();
      expect(stats.versions).toEqual([
        expect.objectContaining({ key: `${id}:b`, visitors: 2, views: 2 }),
        expect.objectContaining({ key: `${id}:original`, visitors: 1, views: 1 }),
      ]);
      // A/B keeps its own counts, untouched by Visitors' page views.
      const results = (await admin("GET", `/experiments/${id}/results`)).json();
      expect(results.versions.map((version: { visitors: number }) => version.visitors)).toEqual([
        0, 0,
      ]);
    });

    it("tag nothing for people who ask not to be tracked", async () => {
      await enable("analytics", "experiments");
      const id = await startTest({ kind: "form" });
      await site.inject({
        method: "POST",
        url: "/_lintel/api/analytics/collect?site=default",
        remoteAddress: "203.0.113.9",
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          "user-agent": firefox,
          "sec-gpc": "1",
        },
        payload: JSON.stringify({ kind: "view", path: "/bakery", experiment: id, version: "b" }),
      });
      expect(await testDatabase.database.select().from(analyticsEventsTable)).toEqual([]);
    });
  });
});
