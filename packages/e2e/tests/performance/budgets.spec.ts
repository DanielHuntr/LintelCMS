import { randomUUID } from "node:crypto";
import { adminBuildFolder } from "../../src/site/admin-build.js";
import { budgets, enforceTimingBudgets } from "../../src/performance/budgets.js";
import {
  initialAssets,
  largestContentfulPaint,
  percentile,
  timeRequests,
} from "../../src/performance/measure.js";
import type { TestInfo } from "@playwright/test";
import { expect, test } from "../../src/fixtures/lintel-test.js";
import type { ApiClient } from "../../src/site/api-client.js";

test("the admin's initial JavaScript and CSS stay within budget", async ({}, testInfo) => {
  const assets = await initialAssets(adminBuildFolder);
  const kilobytes = (extension: string) =>
    assets
      .filter((asset) => asset.path.endsWith(extension))
      .reduce((total, asset) => total + asset.gzippedBytes, 0) / 1024;

  const javaScript = kilobytes(".js");
  const css = kilobytes(".css");
  await testInfo.attach("initial assets", {
    body: JSON.stringify({ javaScriptKilobytes: javaScript, cssKilobytes: css, assets }, null, 2),
    contentType: "application/json",
  });
  expect(javaScript, "Initial JavaScript (gzipped kB)").toBeLessThanOrEqual(
    budgets.adminInitialJavaScriptKilobytes,
  );
  expect(css, "Initial CSS (gzipped kB)").toBeLessThanOrEqual(budgets.adminInitialCssKilobytes);
});

test("the dashboard paints its main content quickly", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const paint = await largestContentfulPaint(page);
  expectWithinTimingBudget(
    testInfo,
    "Largest Contentful Paint",
    paint,
    budgets.dashboardLargestContentfulPaintMilliseconds,
  );
});

test("the entry editor paints its main content quickly", async ({ page, content }, testInfo) => {
  await page.goto(`/content/pages/${content.pages.home.id}`);
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toBeVisible();
  const paint = await largestContentfulPaint(page);
  expectWithinTimingBudget(
    testInfo,
    "Largest Contentful Paint",
    paint,
    budgets.entryEditorLargestContentfulPaintMilliseconds,
  );
});

test.describe("with 1,000 entries", () => {
  // Adds 1,000 posts, so it gets a site of its own.
  test.use({ site: "private" });
  test.setTimeout(240_000);

  test("list endpoints answer within budget at the 95th percentile", async ({
    api,
    lintel,
    content,
  }, testInfo) => {
    await addPosts(api, 1000);

    const headers = { cookie: `lintel_session=${content.sessions.owner}` };
    const endpoints = {
      "entries, first page": "/collections/posts/entries",
      "entries, page 20": "/collections/posts/entries?page=20",
      "entries, 100 per page": "/collections/posts/entries?perPage=100",
      "entries, search": "/collections/posts/entries?search=batch",
      "entries, published only": "/collections/posts/entries?status=published",
      "delivery list": "/delivery/posts",
      search: "/search?q=batch",
      media: "/media",
    };

    const results: Record<string, number> = {};
    for (const [name, path] of Object.entries(endpoints)) {
      await timeRequests(`${lintel.apiUrl}${path}`, 3, headers);
      results[name] = Math.round(
        percentile(await timeRequests(`${lintel.apiUrl}${path}`, 40, headers), 0.95),
      );
    }
    await testInfo.attach("p95 in milliseconds", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });

    for (const [name, p95] of Object.entries(results)) {
      expectWithinTimingBudget(testInfo, `${name} p95`, p95, budgets.listEndpointP95Milliseconds);
    }
  });
});

/** Reports a timing on the test, and fails over budget only where timings are enforced. */
function expectWithinTimingBudget(
  testInfo: TestInfo,
  name: string,
  milliseconds: number,
  budget: number,
): void {
  testInfo.annotations.push({
    type: name,
    description: `${Math.round(milliseconds)} ms (budget ${budget} ms)`,
  });
  if (enforceTimingBudgets) {
    expect.soft(milliseconds, `${name} (ms)`).toBeLessThanOrEqual(budget);
  } else if (milliseconds > budget) {
    console.warn(
      `${name}: ${Math.round(milliseconds)} ms is over the ${budget} ms budget (not enforced here).`,
    );
  }
}

/** Adds posts eight at a time; every tenth is published so delivery lists have plenty. */
async function addPosts(api: ApiClient, count: number): Promise<void> {
  const numbers = Array.from({ length: count }, (_, index) => index + 1);
  for (let start = 0; start < count; start += 8) {
    await Promise.all(
      numbers.slice(start, start + 8).map(async (number) => {
        const post = await api.post<{ id: string }>("/collections/posts/entries", {
          data: { title: `Batch post ${number}`, excerpt: `Number ${number} of ${count}` },
          slug: `batch-post-${number}-${randomUUID().slice(0, 4)}`,
        });
        if (number % 10 === 0) {
          await api.post(`/entries/${post.id}/publish`);
        }
      }),
    );
  }
}
