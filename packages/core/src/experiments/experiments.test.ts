import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  type PageNode,
  standardCatalogue,
  updateNode,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import { testsScript } from "./tests-script.js";

const firefox = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";
const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function section(createId: () => string, heading: string): PageNode {
  return createNode(
    {
      type: "section",
      children: [
        { type: "heading", props: { text: heading } },
        { type: "button", props: { text: "Get in touch", href: "/contact" } },
      ],
    },
    standardCatalogue,
    createId,
  );
}

function bakeryDesign(): PageDocument {
  const createId = createCountingNodeIds("n");
  const page = createEmptyPage();
  return {
    ...page,
    root: {
      ...page.root,
      children: [section(createId, "Fresh bread daily"), section(createId, "Opening hours")],
    },
  };
}

/** The design with the first heading's words changed. */
function withHeading(design: PageDocument, text: string): PageDocument {
  const heading = design.root.children[0]?.children[0];
  if (!heading) throw new Error("The test design has no heading.");
  return {
    ...design,
    root: updateNode(design.root, heading.id, (node) => ({
      ...node,
      props: { ...node.props, text },
    })),
  };
}

// Each test publishes a page and renders it through two servers.
describe("A/B testing", { timeout: 30000 }, () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let admin: SendRequest;
  let pageId: string;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    site = buildSiteServer({ api });
    await site.ready();
    await ensureCollection(testDatabase.database, pagesWithSimpleSectionsCollection);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    admin = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    await createHomePage(admin);
    await admin("PUT", "/plugins", { enabled: ["experiments"] });
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

  const visit = (address: string, headers: Record<string, string> = {}) =>
    site.inject({
      method: "GET",
      url: "/bakery",
      remoteAddress: address,
      headers: { "user-agent": firefox, ...headers },
    });

  const report = (
    address: string,
    body: { experiment: string; version: string; event: string },
    headers: Record<string, string> = {},
  ) =>
    site.inject({
      method: "POST",
      url: "/_lintel/tests",
      remoteAddress: address,
      headers: { "user-agent": firefox, "content-type": "text/plain", ...headers },
      payload: JSON.stringify(body),
    });

  /** A running test whose Version B says "Bread baked at dawn". */
  async function startPageTest(sectionId?: string) {
    const created = await admin("POST", "/experiments", { entryId: pageId, sectionId });
    expect(created.statusCode, created.body).toBe(201);
    const experiment = created.json();
    const versionB = withHeading(experiment.versions[0].design, "Bread baked at dawn");
    const saved = await admin("PUT", `/experiments/${experiment.id}/versions/b`, {
      design: versionB,
    });
    expect(saved.statusCode, saved.body).toBe(200);
    await admin("PATCH", `/experiments/${experiment.id}`, {
      goal: { kind: "click", target: "/contact" },
    });
    const started = await admin("POST", `/experiments/${experiment.id}/start`);
    expect(started.statusCode, started.body).toBe(200);
    return experiment.id as string;
  }

  /** Addresses that get the original and Version B, found by visiting. */
  async function findVisitors() {
    const found: Record<string, string> = {};
    for (let index = 1; index < 60 && Object.keys(found).length < 2; index += 1) {
      const address = `203.0.113.${index}`;
      const body = (await visit(address)).body;
      const version = body.includes("Bread baked at dawn") ? "b" : "original";
      found[version] ??= address;
    }
    if (!found.original || !found.b) throw new Error("Didn't find visitors for both versions.");
    return { original: found.original, b: found.b };
  }

  it("makes Version B a copy of the page, one test per page", async () => {
    const created = await admin("POST", "/experiments", { entryId: pageId });
    expect(created.json()).toMatchObject({
      scope: "page",
      status: "draft",
      split: [50, 50],
      goal: null,
      versions: [{ key: "b" }],
    });
    expect(JSON.stringify(created.json().versions[0].design)).toContain("Fresh bread daily");
    const again = await admin("POST", "/experiments", { entryId: pageId });
    expect(again.statusCode).toBe(409);

    const withC = await admin("POST", `/experiments/${created.json().id}/versions`, {});
    expect(withC.json().versions.map((version: { key: string }) => version.key)).toEqual([
      "b",
      "c",
    ]);
    expect(withC.json().split).toEqual([34, 33, 33]);
    const fourth = await admin("POST", `/experiments/${created.json().id}/versions`, {});
    expect(fourth.statusCode).toBe(409);

    const forPage = await admin("GET", `/experiments/for-page/${pageId}`);
    expect(forPage.json().experiment.id).toBe(created.json().id);
  });

  it("won't save a version over someone else's newer save", async () => {
    const created = await admin("POST", "/experiments", { entryId: pageId });
    const experiment = created.json();
    const versionB = experiment.versions.find((each: { key: string }) => each.key === "b");
    const save = (text: string) =>
      admin("PUT", `/experiments/${experiment.id}/versions/b`, {
        design: withHeading(versionB.design, text),
        baseUpdatedAt: versionB.updatedAt,
      });
    expect((await save("First")).statusCode).toBe(200);
    const second = await save("Second");
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ code: "VERSION_CHANGED" });
  });

  it("won't start without a goal", async () => {
    const created = await admin("POST", "/experiments", { entryId: pageId });
    const started = await admin("POST", `/experiments/${created.json().id}/start`);
    expect(started.statusCode).toBe(400);
    expect(started.json().message).toMatch(/what counts as success/);
  });

  it("chooses the version on the server, the same one on every visit", async () => {
    const experimentId = await startPageTest();
    const visitors = await findVisitors();

    const b = await visit(visitors.b);
    expect(b.body).toContain("Bread baked at dawn");
    expect(b.body).not.toContain("Fresh bread daily");
    expect(b.body).toContain(`data-lintel-test="${experimentId}" data-lintel-version="b"`);
    expect(b.body).toContain(testsScript.path);
    expect(b.headers["cache-control"]).toBe("private, max-age=0, must-revalidate");

    const original = await visit(visitors.original);
    expect(original.body).toContain("Fresh bread daily");
    expect(original.body).toContain('data-lintel-version="original"');

    for (let again = 0; again < 3; again += 1) {
      expect((await visit(visitors.b)).body).toContain("Bread baked at dawn");
      expect((await visit(visitors.original)).body).toContain("Fresh bread daily");
    }
    const script = await site.inject({ method: "GET", url: testsScript.path });
    expect(script.statusCode).toBe(200);
    expect(script.body).toContain("lintel-tests");
  });

  it("shows search engines and people who opt out the original, without the script", async () => {
    await startPageTest();
    const { b } = await findVisitors();
    const optOuts: Record<string, string>[] = [
      { "user-agent": googlebot },
      { dnt: "1" },
      { "sec-gpc": "1" },
    ];
    for (const headers of optOuts) {
      const page = await visit(b, headers);
      expect(page.body).toContain("Fresh bread daily");
      expect(page.body).not.toContain("data-lintel-test");
      expect(page.body).not.toContain(testsScript.path);
    }
  });

  it("counts visits and goals the script reports, but never from opted-out browsers", async () => {
    const experimentId = await startPageTest();
    const visitor = "203.0.113.200";
    const send = (version: string, event: string, headers: Record<string, string> = {}) =>
      report(visitor, { experiment: experimentId, version, event }, headers);
    expect((await send("b", "visit")).statusCode).toBe(204);
    await send("b", "conversion");
    await send("original", "visit");
    await send("original", "visit", { dnt: "1" });
    await send("b", "conversion", { "sec-gpc": "1" });
    await send("b", "visit", { "user-agent": googlebot });
    await send("c", "visit");
    expect(
      (await report(visitor, { experiment: "nonsense", version: "b", event: "visit" })).statusCode,
    ).toBe(204);

    const results = (await admin("GET", `/experiments/${experimentId}/results`)).json();
    expect(results.enoughData).toBe(false);
    expect(results.versions).toMatchObject([
      { key: "original", visitors: 1, conversions: 0, share: 50 },
      { key: "b", visitors: 1, conversions: 1, rate: 1, comparison: { verdict: "aheadTooEarly" } },
    ]);
  });

  it("stops counting and shows the original once paused", async () => {
    const experimentId = await startPageTest();
    const { b } = await findVisitors();
    await admin("POST", `/experiments/${experimentId}/stop`);
    expect((await visit(b)).body).toContain("Fresh bread daily");
    await report(b, { experiment: experimentId, version: "b", event: "visit" });
    const results = (await admin("GET", `/experiments/${experimentId}/results`)).json();
    expect(results.versions[1].visitors).toBe(0);
  });

  it("tries another version of one section, leaving the rest of the page as it is", async () => {
    const page = (await admin("GET", `/entries/${pageId}`)).json();
    const sectionId = page.data.design.root.children[0].id;
    await startPageTest(sectionId);
    // The page changes after the test began: Version B keeps following it.
    const changed = withHeading(page.data.design, "Fresh bread daily");
    const second = changed.root.children[1]?.children[0];
    if (!second) throw new Error("The test design has no second heading.");
    changed.root = updateNode(changed.root, second.id, (node) => ({
      ...node,
      props: { ...node.props, text: "Open every day" },
    }));
    await admin("PATCH", `/entries/${pageId}`, { data: { design: changed } });
    await admin("POST", `/entries/${pageId}/publish`);

    const { b } = await findVisitors();
    const body = (await visit(b)).body;
    expect(body).toContain("Bread baked at dawn");
    expect(body).toContain("Open every day");
  });

  it("makes B the page: publishes it and ends the test", async () => {
    const experimentId = await startPageTest();
    const ended = await admin("POST", `/experiments/${experimentId}/end`, { version: "b" });
    expect(ended.statusCode, ended.body).toBe(200);
    expect(ended.json()).toMatchObject({ status: "ended", winner: "b" });

    for (const address of ["203.0.113.1", "203.0.113.2", "203.0.113.3"]) {
      const body = (await visit(address)).body;
      expect(body).toContain("Bread baked at dawn");
      expect(body).not.toContain("data-lintel-test");
    }
    const entry = (await admin("GET", `/entries/${pageId}`)).json();
    expect(JSON.stringify(entry.data.design)).toContain("Bread baked at dawn");
    expect((await admin("GET", `/experiments/for-page/${pageId}`)).json().experiment).toBeNull();
    // A new test can start on the page now.
    expect((await admin("POST", "/experiments", { entryId: pageId })).statusCode).toBe(201);
  });

  it("refuses to publish a winner for someone who can't publish", async () => {
    const experimentId = await startPageTest();
    await createTestUser(testDatabase.database, "tester@example.com", [
      ["experiments:manage", "entries:read", "entries:update"],
    ]);
    const tester = requestsAs(api, await signInAndGetCookies(api, "tester@example.com"));
    const ended = await tester("POST", `/experiments/${experimentId}/end`, { version: "b" });
    expect(ended.statusCode).toBe(403);
    const kept = await tester("POST", `/experiments/${experimentId}/end`, { version: "original" });
    expect(kept.json()).toMatchObject({ status: "ended", winner: "original" });
    expect((await visit("203.0.113.9")).body).toContain("Fresh bread daily");
  });

  it("needs the experiments permission", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:read"]]);
    const editor = requestsAs(api, await signInAndGetCookies(api, "editor@example.com"));
    expect((await editor("GET", "/experiments")).statusCode).toBe(403);
  });

  it("ships nothing while the plugin is off", async () => {
    const experimentId = await startPageTest();
    await admin("PUT", "/plugins", { enabled: [] });
    expect((await admin("GET", "/experiments")).statusCode).toBe(404);
    for (let index = 1; index < 20; index += 1) {
      const body = (await visit(`203.0.113.${index}`)).body;
      expect(body).toContain("Fresh bread daily");
      expect(body).not.toContain("data-lintel-test");
      expect(body).not.toContain("lintel-tests");
    }
    await report("203.0.113.5", { experiment: experimentId, version: "b", event: "visit" });
    await admin("PUT", "/plugins", { enabled: ["experiments"] });
    const results = (await admin("GET", `/experiments/${experimentId}/results`)).json();
    expect(results.versions[1].visitors).toBe(0);
  });
});
