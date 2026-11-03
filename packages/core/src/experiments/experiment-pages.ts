import { type PageDocument, readPageLinkId } from "@lintel/builder-model";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { readPluginSettings } from "../plugins/plugin-settings.service.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import type { SiteResponse } from "../website/rendered-pages-cache.js";
import { entityTag } from "../website/site-documents.js";
import { readDesign, versionAsPage } from "./experiment-designs.js";
import { experimentsPlugin } from "./experiments.plugin.js";
import { experimentsSettingsSchema } from "./experiments-settings.schema.js";
import { listRunningExperimentRows, listVersionRows } from "./experiments.repository.js";
import type { ExperimentGoal, ExperimentScope, VersionKey } from "./experiments.schema.js";
import { TESTS_ENDPOINT, testsScript } from "./tests-script.js";
import { chooseVersion, takesPartInTests, type Visitor } from "./visitor-assignment.js";

/**
 * The website's side of A/B tests: which tests are running, which version of a tested page a
 * visitor gets, and the marker and script that count them. The version is chosen on the
 * server, before the page is drawn, so nobody sees one version turn into another.
 */

export const EXPERIMENTS_PLUGIN_ID = "experiments";

/** What a page's script needs to know about a goal. */
export type BrowserGoal =
  | { kind: "form" }
  | { kind: "order" }
  | { kind: "click"; target: string }
  | { kind: "page"; path: string | null }
  | { kind: "analytics"; name: string };

export interface RunningTest {
  id: string;
  entryId: string;
  scope: ExperimentScope;
  sectionId: string | null;
  secret: string;
  split: number[];
  /** "original" first, then each version with a design. */
  keys: VersionKey[];
  designs: Map<VersionKey, PageDocument>;
  goal: BrowserGoal | null;
}

/** What every page of the site needs to know about A/B tests. */
export interface RunningTests {
  tests: RunningTest[];
  /** Count nobody until the cookie notice allows "plugin:experiments" (the plugin's setting). */
  countOnlyAfterConsent: boolean;
}

/** The running tests, or none while the A/B testing plugin is off. */
export async function loadRunningTests(database: DatabaseOrTransaction): Promise<RunningTests> {
  if (!(await isPluginEnabled(database, EXPERIMENTS_PLUGIN_ID))) {
    return { tests: [], countOnlyAfterConsent: false };
  }
  const [tests, settings] = await Promise.all([
    readRunningTests(database),
    readPluginSettings(database, experimentsPlugin),
  ]);
  const parsed = experimentsSettingsSchema.safeParse(settings);
  return {
    tests,
    countOnlyAfterConsent: parsed.success && parsed.data.countOnlyAfterConsent,
  };
}

async function readRunningTests(database: DatabaseOrTransaction): Promise<RunningTest[]> {
  const rows = await listRunningExperimentRows(database, DEFAULT_TENANT_ID);
  const versions = await listVersionRows(
    database,
    DEFAULT_TENANT_ID,
    rows.map((row) => row.id),
  );
  const tests: RunningTest[] = [];
  for (const row of rows) {
    const designs = new Map<VersionKey, PageDocument>();
    for (const version of versions.filter((candidate) => candidate.experimentId === row.id)) {
      const design = readDesign(version.design);
      if (design) designs.set(version.key, design);
    }
    const keys: VersionKey[] = ["original", ...designs.keys()];
    // A split that no longer matches (a version that can't be read) falls back to even shares.
    const split = row.split.length === keys.length ? row.split : keys.map(() => 100 / keys.length);
    tests.push({
      id: row.id,
      entryId: row.entryId,
      scope: row.scope,
      sectionId: row.sectionId,
      secret: row.secret,
      split,
      keys,
      designs,
      goal: row.goal ? await browserGoal(database, row.goal) : null,
    });
  }
  return tests;
}

async function browserGoal(
  database: DatabaseOrTransaction,
  goal: ExperimentGoal,
): Promise<BrowserGoal> {
  switch (goal.kind) {
    case "form":
    case "order":
      return { kind: goal.kind };
    case "analytics":
      return { kind: "analytics", name: goal.name };
    case "click": {
      // A link to one of the site's pages is stored as the page; the page shows its address.
      const linkedPage = readPageLinkId(goal.target);
      if (!linkedPage) return { kind: "click", target: goal.target };
      return { kind: "click", target: (await pathOfPage(database, linkedPage)) ?? goal.target };
    }
    case "page":
      return { kind: "page", path: await pathOfPage(database, goal.entryId) };
  }
}

/** Where a page answers on the site now, or null when it has gone. */
async function pathOfPage(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<string | null> {
  const url = await describeEntryForEvent(database, entryId)
    .then((entry) => entry.url)
    .catch(() => null);
  return url ? new URL(url, "http://site.invalid").pathname : null;
}

/** One visit's versions of the running tests. */
export interface ExperimentVisit {
  tests: RunningTest[];
  /** The counting script waits for the cookie notice to allow "plugin:experiments". */
  countOnlyAfterConsent: boolean;
  /** Counted visitors get the markers and the script; others only ever the original. */
  takesPart: boolean;
  versions: Map<string, VersionKey>;
  /** Added to the rendered pages cache's key, so each version is kept apart. */
  cacheKey: string;
}

export function visitTests(running: RunningTests, visitor: Visitor): ExperimentVisit {
  const { tests, countOnlyAfterConsent } = running;
  const takesPart = tests.length > 0 && takesPartInTests(visitor);
  const versions = new Map<string, VersionKey>();
  for (const test of tests) {
    versions.set(test.id, takesPart ? chooseVersion(visitor, test) : "original");
  }
  const cacheKey =
    tests.length === 0
      ? ""
      : takesPart
        ? `#tests:${tests.map((test) => `${test.id}=${versions.get(test.id)}`).join(",")}`
        : "#tests:none";
  return { tests, countOnlyAfterConsent, takesPart, versions, cacheKey };
}

/**
 * The design a visitor sees for a page, and the marker that counts the visit (empty for
 * visitors who aren't counted, and pages with no running test).
 */
export function designForVisit(
  visit: ExperimentVisit | undefined,
  entryId: string,
  own: PageDocument,
): { design: PageDocument; marker: string } {
  const test = visit?.tests.find((candidate) => candidate.entryId === entryId);
  if (!visit || !test) return { design: own, marker: "" };
  const chosen = visit.versions.get(test.id) ?? "original";
  const versionDesign = chosen === "original" ? undefined : test.designs.get(chosen);
  const asPage = versionDesign ? versionAsPage(test, own, versionDesign) : undefined;
  // A section that has gone from the page can't be swapped: everyone sees the page as it is.
  const shown: VersionKey = asPage ? chosen : "original";
  return {
    design: asPage ?? own,
    marker: visit.takesPart
      ? `<template data-lintel-test="${test.id}" data-lintel-version="${shown}"></template>`
      : "",
  };
}

/**
 * Adds the counting script to a page while tests run, for visitors who take part. Their pages
 * differ from other visitors', so they are marked private: no shared cache may keep them.
 */
export function withTestsScript(
  response: SiteResponse,
  visit: ExperimentVisit | undefined,
): SiteResponse {
  if (!visit?.takesPart || response.statusCode !== 200) return response;
  if (!response.headers["content-type"]?.startsWith("text/html")) return response;
  const settings = JSON.stringify({
    endpoint: TESTS_ENDPOINT,
    ...(visit.countOnlyAfterConsent ? { consent: "required" } : {}),
    tests: visit.tests.map((test) => ({ id: test.id, goal: test.goal })),
  }).replaceAll("<", "\\u003c");
  const snippet = `<script type="application/json" id="lintel-tests">${settings}</script><script src="${testsScript.path}" defer></script>`;
  const at = response.body.lastIndexOf("</body>");
  const body =
    at === -1
      ? `${response.body}${snippet}`
      : `${response.body.slice(0, at)}${snippet}${response.body.slice(at)}`;
  return {
    ...response,
    headers: {
      ...response.headers,
      "cache-control": "private, max-age=0, must-revalidate",
      etag: entityTag(body),
    },
    body,
  };
}
