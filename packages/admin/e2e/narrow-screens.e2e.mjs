// End-to-end check of the admin on a phone (390px wide), run against Lintel in a real browser:
//
//   API_URL=http://localhost:4630 ADMIN_URL=http://localhost:5630 \
//     SCREENSHOTS=/tmp/phone-shots node packages/admin/e2e/narrow-screens.e2e.mjs
//
// It sets the site up through the API if it needs it, signs in, and checks that the main
// screens never scroll sideways, that the sidebar opens from the menu button and closes
// again, and that the content tree opens a page (the site needs one). OWNER_EMAIL and OWNER_PASSWORD sign in to a
// site that is already set up. The API and admin must be running (see README.md).
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

// Playwright is installed with the browser tests (packages/motion), or globally.
const { chromium } = createRequire(import.meta.url)("playwright");

const apiUrl = process.env.API_URL ?? "http://localhost:4630";
const adminUrl = process.env.ADMIN_URL ?? "http://localhost:5630";
const shots = process.env.SCREENSHOTS;
const owner = {
  email: process.env.OWNER_EMAIL ?? "owner@example.com",
  name: "Sam Owner",
  password: process.env.OWNER_PASSWORD ?? "a long and sturdy passphrase 42",
};
const screens = [
  "/",
  "/content",
  "/media",
  "/design",
  "/users",
  "/settings",
  "/settings/updates",
  "/content-types",
  "/build/api/reference",
];

const status = await (await fetch(`${apiUrl}/setup/status`)).json();
if (status.needsSetup) {
  const finished = await fetch(`${apiUrl}/setup/finish`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(adminUrl).origin },
    body: JSON.stringify({
      account: owner,
      site: { siteName: "Brightside Bakery", siteType: "business" },
    }),
  });
  assert.ok(finished.status < 300, `setup answered ${finished.status}`);
}
if (shots) await mkdir(shots, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
let page = await context.newPage();
page.setDefaultTimeout(60_000);
const scrollWidth = () => page.evaluate(() => document.documentElement.scrollWidth);
// A fresh tab for each screen keeps the development build's memory in check.
async function openFresh(path) {
  await page.close();
  page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(`${adminUrl}${path}`, { waitUntil: "networkidle" });
}

try {
  await page.goto(`${adminUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("sign-in"));

  // 1. No screen scrolls sideways.
  for (const path of screens) {
    await openFresh(path);
    assert.equal(await scrollWidth(), 390, `${path} scrolls sideways`);
  }

  // 2. The sidebar is behind the menu button, opens over the page and closes again.
  await openFresh("/content");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const menu = page.getByRole("button", { name: "Open the menu" });
  assert.equal(await navigation.isVisible(), false, "the sidebar starts folded away");
  await menu.click();
  await navigation.waitFor();
  if (shots) await page.screenshot({ path: join(shots, "01-menu-open.png") });
  await page.keyboard.press("Escape");
  assert.equal(await navigation.isVisible(), false, "Escape closes the menu");
  await menu.click();
  await navigation.getByRole("link", { name: "Media" }).click();
  await page.waitForURL(/\/media$/);
  assert.equal(await navigation.isVisible(), false, "going somewhere closes the menu");

  // 3. The content tree, above the workspace, opens a page that fits too.
  await openFresh("/content");
  // On a phone the tree starts folded away behind this button.
  await page.getByRole("button", { name: "Show pages" }).click();
  const tree = page.getByRole("navigation", { name: "Content tree" });
  const pages = tree.getByRole("treeitem", { name: /^Pages/ });
  await pages.click();
  await pages.press("ArrowRight");
  // A page under Pages, once its rows have loaded.
  const first = tree.locator('[role="treeitem"][aria-level="2"]').first();
  await first.waitFor();
  await first.click();
  await page.waitForURL(/\/content\/pages\/[0-9a-f-]+$/);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  assert.equal(await scrollWidth(), 390, "a page's workspace scrolls sideways");
  if (shots) await page.screenshot({ path: join(shots, "02-page-workspace.png") });
  console.warn("The admin fits a phone.");
} finally {
  await browser.close();
}
