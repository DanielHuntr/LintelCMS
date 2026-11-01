// End-to-end check of the site's own blocks, run against a fresh Lintel in a real browser:
//
//   API_URL=http://localhost:4627 ADMIN_URL=http://localhost:5627 SITE_URL=http://localhost:3627 \
//     SCREENSHOTS=/tmp/block-shots node packages/admin/e2e/custom-blocks.e2e.mjs
//
// It designs a team card on the About page, makes it into a "Team card" block with Name,
// Photo, Role and a "Show LinkedIn" toggle, uses the block on a second page from Insert,
// changes the block's design and checks both pages on the website change, then offers the
// block in a content type's blocks field and fills one in with its live preview.
// The API and admin must be running (see README.md).
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

// Playwright is installed with the browser tests (packages/motion), or globally.
const { chromium } = createRequire(import.meta.url)("playwright");

const apiUrl = process.env.API_URL ?? "http://localhost:4627";
const adminUrl = process.env.ADMIN_URL ?? "http://localhost:5627";
const siteUrl = process.env.SITE_URL ?? "http://localhost:3627";
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
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

async function signIn() {
  const status = await api("GET", "/setup/status");
  if (status.json.needsSetup) {
    const finished = await api("POST", "/setup/finish", {
      account: owner,
      site: { siteName: "Blocks test", siteType: "business" },
    });
    assert.ok(finished.status < 300, `setup: ${JSON.stringify(finished.json)}`);
  }
  const signedIn = await api("POST", "/auth/sign-in", {
    email: owner.email,
    password: owner.password,
  });
  return signedIn.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}

/** A page with a designed team card: a box with a photo, a name, a role and a LinkedIn button. */
function aboutDesign() {
  const node = (id, type, name, props = {}, children = [], styles = { base: {} }) => ({
    id,
    type,
    name,
    props,
    styles,
    children,
    hidden: false,
    locked: false,
  });
  const card = node(
    "card",
    "box",
    "Team card",
    {},
    [
      node("photo", "image", "Photo", { src: "/_lintel/illustrations/team.svg", alt: "A person" }),
      node("name", "heading", "Name", { text: "Your name", level: 3 }),
      node("role", "text", "Role", { text: "What you do" }),
      node("linkedin", "button", "LinkedIn", {
        label: "LinkedIn",
        href: "https://www.linkedin.com",
      }),
    ],
    { base: { backgroundColor: "#ffffff", paddingTop: "24px" } },
  );
  return { version: 1, root: node("page", "page", "", {}, [card]) };
}

async function createPage(cookie, title, design) {
  const created = await api(
    "POST",
    "/collections/pages/entries",
    { data: { title, design } },
    cookie,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  return created.json;
}

/** The entry's saved values, once `isReady` says the autosave has caught up. */
async function savedData(cookie, entryId, isReady) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const entry = await api("GET", `/entries/${entryId}`, undefined, cookie);
    if (entry.status === 200 && isReady(entry.json.data)) return entry.json.data;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Entry ${entryId} never saved the expected values.`);
}

async function shoot(page, name) {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
}

const cookie = await signIn();
if (shots) await mkdir(shots, { recursive: true });
const about = await createPage(cookie, "About us", aboutDesign());
const team = await createPage(cookie, "Our team", null);

const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
// The tour would cover the panels; it has been seen.
await context.addInitScript(() => {
  localStorage.setItem("lintel.builder.tourSeen", "yes");
});
let page = await context.newPage();
page.setDefaultTimeout(60_000);

/** A fresh tab for the next step, so the builder's frames from the last one are let go. */
async function freshPage() {
  await page.close();
  page = await context.newPage();
  page.setDefaultTimeout(60_000);
  return page;
}

try {
  await page.goto(`${adminUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("sign-in"));

  // 1. Make into a block, choosing what editors can change.
  await page.goto(`${adminUrl}/content/pages/${about.id}/design/design`, {
    waitUntil: "domcontentloaded",
  });
  const closeTour = page.getByRole("button", { name: /Skip|Close tour|Not now/ });
  if (
    await closeTour
      .first()
      .isVisible()
      .catch(() => false)
  )
    await closeTour.first().click();
  await page
    .getByRole("tree", { name: "Layers" })
    .getByRole("treeitem", { name: "Team card" })
    .click();
  await page.getByRole("button", { name: "Make into a block" }).click();
  const dialog = page.getByRole("dialog", { name: "Make “Team card” into a block" });
  await dialog.getByLabel("Name", { exact: true }).fill("Team card");
  await dialog.getByLabel("users").check();
  await dialog.getByLabel("Group in Insert").fill("Team");
  await shoot(page, "1-make-into-block");
  const part = (id) => dialog.locator(`[data-candidate="${id}"]`);
  await part("name:text").getByRole("checkbox").check();
  await part("photo:src").getByRole("checkbox").check();
  await part("role:text").getByRole("checkbox").check();
  await part("linkedin:visible").getByRole("checkbox").check();
  await part("linkedin:visible").getByLabel("What editors see it called").fill("Show LinkedIn");
  await part("linkedin:visible").scrollIntoViewIfNeeded();
  await shoot(page, "2-property-mapping");
  await dialog.getByRole("button", { name: "Make block" }).click();
  await dialog.waitFor({ state: "detached" });

  // 2. The property form: the same field editors as content.
  const panel = page.getByRole("complementary", { name: "Selected element" });
  await panel.getByRole("heading", { name: "Team card block" }).waitFor();
  await panel.getByRole("textbox", { name: /^Name/ }).fill("Ada Lovelace");
  await panel.getByRole("textbox", { name: /^Role/ }).fill("Analyst");
  await shoot(page, "3-property-form");
  const aboutData = await savedData(cookie, about.id, (data) => {
    const instance = data.design?.root?.children?.[0];
    return instance?.type === "customBlock" && instance.props.values?.role === "Analyst";
  });
  assert.equal(aboutData.design.root.children[0].props.block, "team_card");
  const block = await api("GET", "/blocks/team_card", undefined, cookie);
  assert.deepEqual(
    block.json.properties.map((property) => `${property.handle}:${property.type}`),
    ["photo:image", "name:text", "role:text", "show_linkedin:toggle"],
  );

  // 3. The block from Insert on a second page.
  await freshPage();
  await page.goto(`${adminUrl}/content/pages/${team.id}/design/design`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "Start with an empty page" }).click();
  await page.getByRole("radio", { name: "Elements" }).click();
  await page.getByRole("searchbox").fill("team");
  await shoot(page, "4-insert-panel");
  await page.getByRole("button", { name: "Team card", exact: true }).first().click();
  await page
    .getByRole("complementary", { name: "Selected element" })
    .getByRole("textbox", { name: /^Name/ })
    .fill("Grace Hopper");
  await savedData(
    cookie,
    team.id,
    (data) => data.design?.root?.children?.[0]?.props?.values?.name === "Grace Hopper",
  );

  // 4. Changing the block's design changes both pages on the website.
  assert.equal((await api("POST", `/entries/${about.id}/publish`, {}, cookie)).status, 200);
  assert.equal((await api("POST", `/entries/${team.id}/publish`, {}, cookie)).status, 200);
  const current = block.json;
  const changed = await api(
    "PUT",
    "/blocks/team_card",
    {
      name: current.name,
      icon: current.icon,
      category: current.category,
      description: current.description,
      properties: current.properties,
      design: {
        ...current.design,
        styles: { base: { ...current.design.styles.base, backgroundColor: "#fde68a" } },
      },
    },
    cookie,
  );
  assert.equal(changed.status, 200, JSON.stringify(changed.json));
  for (const [entry, name] of [
    [about, "Ada Lovelace"],
    [team, "Grace Hopper"],
  ]) {
    const html = await (await fetch(`${siteUrl}/${entry.slug}`)).text();
    assert.ok(html.includes(name), `${entry.slug} shows ${name}`);
    assert.ok(html.includes("#fde68a"), `${entry.slug} has the new design`);
  }
  await freshPage();
  await page.goto(`${siteUrl}/${team.slug}`, { waitUntil: "domcontentloaded" });
  await shoot(page, "5-website-after-change");

  // 5. The block in a content type's blocks field, with a live preview.
  await api(
    "POST",
    "/blueprints",
    {
      handle: "landing",
      name: "Landing page",
      fields: [
        { handle: "title", label: "Title", type: "text", required: true },
        {
          handle: "sections",
          label: "Sections",
          type: "blocks",
          options: { blockTypes: [{ handle: "team_card", name: "Team card", block: "team_card" }] },
        },
      ],
    },
    cookie,
  );
  await api(
    "POST",
    "/collections",
    { handle: "landings", name: "Landing pages", blueprintHandle: "landing", structure: "flat" },
    cookie,
  );
  const landing = await api(
    "POST",
    "/collections/landings/entries",
    { data: { title: "Meet us" } },
    cookie,
  );
  await page.goto(`${adminUrl}/content/landings/${landing.json.id}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: /Add a block|Add block/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /Team card/ })
    .last()
    .click();
  const blockForm = page.locator("[data-block-preview]").locator("..");
  await page.getByRole("textbox", { name: /^Name/ }).last().fill("Katherine Johnson");
  await page.locator("[data-block-preview] iframe").waitFor();
  await page.waitForTimeout(800);
  const preview = page.frameLocator("[data-block-preview] iframe");
  await preview.getByText("Katherine Johnson").waitFor();
  await blockForm.scrollIntoViewIfNeeded();
  await shoot(page, "6-blocks-field-editor");
  await savedData(
    cookie,
    landing.json.id,
    (data) => data.sections?.[0]?.data?.name === "Katherine Johnson",
  );

  // 6. Where it's used.
  await page.goto(`${adminUrl}/design/blocks/team_card`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-block-uses]").waitFor();
  const uses = await page.locator("[data-block-uses] li").allTextContents();
  assert.deepEqual([...uses].sort(), ["About us", "Meet us", "Our team"]);
  await shoot(page, "7-block-settings");
  process.stdout.write("Custom blocks journey passed.\n");
} finally {
  await browser.close();
}
