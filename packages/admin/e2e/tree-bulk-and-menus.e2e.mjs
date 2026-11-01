// End-to-end check of picking many pages at once and of putting pages in menus, run against
// a fresh Lintel in a real browser:
//
//   API_URL=http://localhost:4620 ADMIN_URL=http://localhost:5620 SITE_URL=http://localhost:3620 \
//     SCREENSHOTS=/tmp/tree-shots node packages/admin/e2e/tree-bulk-and-menus.e2e.mjs
//
// It sets the site up through the API, then in the admin: creates About under Home with
// "In the main menu" on, publishes it and finds it in the website's header; picks pages in
// the tree, deletes them and brings them back with Undo; shows Pages as a list; asks what to
// do with existing pages when a template is chosen; edits the menu (Add pages, a button, the
// preview) and edits it again from a Header in the page builder. The API (with the built-in
// website) and the admin must be running (see README.md).
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  standardCatalogue,
} from "@lintel/builder-model";

// Playwright is installed with the browser tests (packages/motion), or globally.
const { chromium } = createRequire(import.meta.url)("playwright");

const apiUrl = process.env.API_URL ?? "http://localhost:4620";
const adminUrl = process.env.ADMIN_URL ?? "http://localhost:5620";
const siteUrl = process.env.SITE_URL ?? "http://localhost:3620";
const shots = process.env.SCREENSHOTS;
const owner = {
  email: "owner@example.com",
  name: "Sam Owner",
  password: "a long and sturdy passphrase 42",
};

async function api(method, path, body, cookie) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: new URL(adminUrl).origin,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

async function signIn() {
  const status = await api("GET", "/setup/status");
  if (status.json.needsSetup) {
    const finished = await api("POST", "/setup/finish", {
      account: owner,
      site: { siteName: "Brightside Bakery", siteType: "business" },
    });
    assert.ok(finished.status < 300, `setup: ${JSON.stringify(finished.json)}`);
  }
  const response = await fetch(`${apiUrl}/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(adminUrl).origin },
    body: JSON.stringify({ email: owner.email, password: owner.password }),
  });
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}

/** A page whose design starts with a Header showing the site's main menu. */
function pageWithHeader() {
  const page = createEmptyPage();
  const ids = createCountingNodeIds("e2e");
  const header = createNode({ type: "siteHeader" }, standardCatalogue, ids);
  const heading = createNode(
    { type: "heading", props: { text: "Fresh bread every morning" } },
    standardCatalogue,
    ids,
  );
  return { ...page, root: { ...page.root, children: [header, heading] } };
}

async function shoot(page, name) {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
}

const cookie = await signIn();
if (shots) await mkdir(shots, { recursive: true });

// Setup may have made a home page already; it gets a design with a Header either way.
const top = await api("GET", "/content-tree/children?collection=pages", undefined, cookie);
const existingHome = top.json.items.find((item) => item.isSiteStart);
const home = existingHome
  ? await api(
      "PATCH",
      `/entries/${existingHome.id}`,
      { data: { title: "Home", design: pageWithHeader() } },
      cookie,
    )
  : await api(
      "POST",
      "/collections/pages/entries",
      { data: { title: "Home", design: pageWithHeader() }, slug: "home" },
      cookie,
    );
assert.ok(home.status < 300, JSON.stringify(home.json));
const homeId = home.json.id;
await api("POST", `/entries/${homeId}/publish`, {}, cookie);
for (const title of ["Our bread", "Cakes", "Visit us", "Old offers", "Summer menu"]) {
  const created = await api(
    "POST",
    "/collections/pages/entries",
    { data: { title }, parentId: homeId },
    cookie,
  );
  await api("POST", `/entries/${created.json.id}/publish`, {}, cookie);
}

const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const tree = page.getByRole("navigation", { name: "Content tree" });
const row = (name) => tree.getByRole("treeitem", { name: new RegExp(`^${name}`) });

try {
  await page.goto(`${adminUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("sign-in"));

  // 1. Create About under Home with "In the main menu" on, publish it, and view it.
  await page.goto(`${adminUrl}/content`, { waitUntil: "domcontentloaded" });
  await row("Pages").click();
  await row("Pages").press("ArrowRight");
  await row("Home").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Create…" }).click();
  const create = page.getByRole("dialog", { name: "Create in Home" });
  await create.getByRole("textbox", { name: "Name" }).fill("About");
  const inMenu = create.getByRole("switch", { name: "In the main menu" });
  assert.equal(await inMenu.isChecked(), true, "on for a page right under Home");
  await shoot(page, "01-create-in-main-menu");
  await create.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/content\/pages\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.getByText("Published", { exact: false }).first().waitFor();

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "In the main menu" }).waitFor();
  assert.equal(await page.getByRole("switch", { name: "In the main menu" }).isChecked(), true);
  await shoot(page, "02-page-settings-main-menu");

  const visitor = await context.newPage();
  await visitor.goto(`${siteUrl}/about`, { waitUntil: "domcontentloaded" });
  const headerLink = visitor.locator("header").getByRole("link", { name: "About" });
  await headerLink.waitFor();
  await shoot(visitor, "03-website-header-shows-about");
  await visitor.setViewportSize({ width: 390, height: 780 });
  await shoot(visitor, "04-website-header-on-a-phone");
  await visitor.close();

  // 2. Pick pages in the tree, delete them after one question, and bring them back.
  await page.goto(`${adminUrl}/content`, { waitUntil: "domcontentloaded" });
  await row("Cakes").waitFor();
  await row("Old offers").click({ modifiers: ["ControlOrMeta"] });
  await page.getByText("1 selected").waitFor();
  await row("Summer menu").click({ modifiers: ["ControlOrMeta"] });
  await row("Cakes").click({ modifiers: ["ControlOrMeta"] });
  const bar = page.getByRole("toolbar", { name: /Actions for the 3 selected/ });
  await bar.waitFor();
  await shoot(page, "05-tree-three-selected");
  await bar.getByRole("button", { name: "Delete…" }).click();
  const ask = page.getByRole("alertdialog", { name: "Delete 3 pages?" });
  await ask.getByText(/pages in all/).waitFor();
  await shoot(page, "06-bulk-delete-question");
  await ask.getByRole("button", { name: "Move to recycle bin" }).click();
  await page.getByText("Moved 3 pages to the recycle bin.").waitFor();
  await shoot(page, "07-deleted-with-undo");
  assert.equal(await row("Cakes").count(), 0);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByText("Brought 3 pages back.").waitFor();
  await row("Cakes").waitFor();

  // Shift-click picks a run; Escape clears.
  await row("Our bread").click({ modifiers: ["ControlOrMeta"] });
  await row("Visit us").click({ modifiers: ["Shift"] });
  const anyBar = page.getByRole("toolbar", { name: /Actions for the \d+ selected/ });
  await anyBar.waitFor();
  await row("Visit us").press("Escape");
  await anyBar.waitFor({ state: "detached" });

  // 3. Pages as a list: every level, with addresses, to act on many at once.
  await page.goto(`${adminUrl}/content/pages`, { waitUntil: "domcontentloaded" });
  await page.getByRole("radio", { name: "List" }).click();
  await page.getByRole("columnheader", { name: "Address" }).waitFor();
  await page.getByRole("checkbox", { name: "Select Cakes" }).check();
  await page.getByRole("checkbox", { name: "Select Old offers" }).check();
  await shoot(page, "08-pages-as-a-list");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("columnheader", { name: "Address" }).waitFor();

  // 4. A template on a site with pages asks first, and Cancel changes nothing.
  await page.goto(`${adminUrl}/design`, { waitUntil: "domcontentloaded" });
  const bakery = page.getByRole("article", { name: "Bakery and café" });
  await bakery.getByRole("button", { name: /Use this template/ }).click();
  const templateDialog = page.getByRole("dialog", { name: "Start from Bakery and café?" });
  await templateDialog.getByText("Your site already has pages").waitFor();
  await shoot(page, "09-template-asks-about-existing-pages");
  await templateDialog.getByRole("button", { name: "Cancel" }).click();
  const tree0 = await api("GET", "/content-tree", undefined, cookie);
  assert.equal(tree0.json.siteStartCount, 1, "still one home page");

  // 5. The menu editor: Add pages from the tree, a button, and the preview.
  await page.goto(`${adminUrl}/content/navigation/main`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add pages" }).click();
  const picker = page.getByRole("dialog", { name: "Add pages to Main menu" });
  await picker.getByRole("checkbox", { name: /Our bread/ }).check();
  await picker.getByRole("checkbox", { name: /Cakes/ }).check();
  await shoot(page, "10-add-pages-picker");
  await picker.getByRole("button", { name: "Add 2 pages" }).click();
  await page.getByRole("button", { name: "Add link" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a link" });
  await sheet.getByRole("radio", { name: "A web address" }).click();
  await sheet.getByRole("textbox", { name: "A web address" }).fill("/visit-us");
  await sheet.getByRole("textbox", { name: "Label" }).fill("Book a table");
  await sheet.getByRole("switch", { name: "Show as a button" }).click();
  await sheet.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save" }).and(page.locator("[disabled]")).waitFor();
  await shoot(page, "11-menu-editor-with-preview");

  await page.emulateMedia({ colorScheme: "dark" });
  await shoot(page, "12-menu-editor-dark");
  await page.emulateMedia({ colorScheme: "light" });

  // 6. The builder: the Header shows the real menu, and Edit menu edits it in place.
  await page.goto(`${adminUrl}/content/pages/${homeId}/design/design`, {
    waitUntil: "domcontentloaded",
  });
  const canvas = page.frameLocator("iframe[title]");
  await canvas.locator(".lintel-site-header").first().waitFor();
  const skipTour = page.getByRole("button", { name: "Skip the tour" }).last();
  if (await skipTour.isVisible()) await skipTour.click();
  await canvas.locator(".lintel-site-header__brand").first().click();
  await page.getByRole("tab", { name: "Content" }).click();
  await page.getByRole("button", { name: "Edit menu" }).click();
  await page.getByRole("region", { name: "Editing Main menu" }).waitFor();
  await shoot(page, "13-builder-edit-menu-inline");
  await page.getByRole("button", { name: "Move “Cakes” up" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Edit menu" }).waitFor();
  const saved = await api("GET", "/navigation/main", undefined, cookie);
  const titles = saved.json.items.map(
    (item) => item.label || saved.json.linkedEntries[item.entryId]?.title,
  );
  assert.deepEqual(titles.slice(0, 3), ["About", "Cakes", "Our bread"], JSON.stringify(titles));

  // An empty menu shows "Add pages to your menu" on the canvas.
  await api("POST", "/navigation", { handle: "footer", name: "Footer links", maxDepth: 1 }, cookie);
  await page.reload({ waitUntil: "domcontentloaded" });
  await canvas.locator(".lintel-site-header__brand").first().click();
  await page.getByRole("tab", { name: "Content" }).click();
  await page.getByLabel("Which menu").selectOption("footer");
  await canvas.getByRole("button", { name: "Add pages to your menu" }).waitFor();
  await shoot(page, "14-builder-empty-menu-button");
  await canvas.getByRole("button", { name: "Add pages to your menu" }).click();
  await page.getByRole("region", { name: "Editing Footer links" }).waitFor();
  await shoot(page, "15-builder-empty-menu-editor");

  console.warn("Tree selection, list view, templates and menus work end to end.");
} catch (error) {
  await shoot(page, "failure").catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
