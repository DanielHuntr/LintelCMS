// End-to-end check of the field builder, run against a fresh Lintel in a real browser:
//
//   API_URL=http://localhost:4610 ADMIN_URL=http://localhost:5610 \
//     SCREENSHOTS=/tmp/field-shots node packages/admin/e2e/field-conditions.e2e.mjs
//
// It sets the site up through the API, then in the admin: adds a Select and a Text field at
// 50% with "show when Format is Online", fills in an entry, watches the field appear and
// disappear, and checks what was saved. The API and admin must be running (see README.md).
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

// Playwright is installed with the browser tests (packages/motion), or globally.
const { chromium } = createRequire(import.meta.url)("playwright");

const apiUrl = process.env.API_URL ?? "http://localhost:4610";
const adminUrl = process.env.ADMIN_URL ?? "http://localhost:5610";
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
      // Browsers send just the scheme, host and port, never the admin's path.
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

async function setUpSite() {
  const status = await api("GET", "/setup/status");
  if (status.json.needsSetup) {
    const finished = await api("POST", "/setup/finish", {
      account: owner,
      site: { siteName: "Field test", siteType: "blog" },
    });
    assert.ok(finished.status < 300, `setup: ${JSON.stringify(finished.json)}`);
  }
  const signedIn = await api("POST", "/auth/sign-in", {
    email: owner.email,
    password: owner.password,
  });
  const cookie = signedIn.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  await api(
    "POST",
    "/blueprints",
    { handle: "event", name: "Event", fields: [{ handle: "title", label: "Title", type: "text" }] },
    cookie,
  );
  await api(
    "POST",
    "/collections",
    { handle: "events", name: "Events", blueprintHandle: "event", structure: "flat" },
    cookie,
  );
  return cookie;
}

/** The entry's saved values, once `isReady` says the autosave has caught up (10 seconds at most). */
async function savedData(entryId, isReady) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const entry = await api("GET", `/entries/${entryId}`, undefined, cookie);
    if (entry.status === 200 && isReady(entry.json.data)) return entry.json.data;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Entry ${entryId} never saved the expected values.`);
}

async function shoot(page, name) {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
}

const cookie = await setUpSite();
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(60_000);

try {
  await page.goto(`${adminUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("sign-in"));

  // The Select: found by another word for it, added with Return.
  await page.goto(`${adminUrl}/settings/content-types/event`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add field" }).click();
  const search = page.getByRole("combobox", { name: /Search fields/ });
  await assert.doesNotReject(() => search.waitFor());
  assert.equal(await search.evaluate((input) => input === document.activeElement), true);
  await page.getByRole("button", { name: /Numbers & choices/ }).click();
  await shoot(page, "1-add-field-picker");
  await search.fill("dropdown");
  await shoot(page, "2-add-field-search");
  await search.press("Enter");

  const settings = page.getByRole("dialog").last();
  await settings.getByRole("textbox", { name: "Label" }).fill("Format");
  await settings.getByRole("tab", { name: "Options" }).click();
  for (const [index, label] of ["Online", "At a venue"].entries()) {
    await settings.getByRole("button", { name: "Add choice" }).click();
    await settings.getByLabel(`Label for choice ${index + 1}`).fill(label);
  }
  await settings.getByRole("tab", { name: "Appearance" }).click();
  await settings.getByRole("radio", { name: "50% of the row" }).click();
  await shoot(page, "3-settings-appearance");
  await settings.getByRole("button", { name: "Done" }).click();

  // The Text field, at 50%, shown when Format is Online.
  await page.getByRole("button", { name: "Add field" }).click();
  await search.fill("text");
  await page.getByRole("option", { name: /^Text/ }).first().click();
  const textSettings = page.getByRole("dialog").last();
  await textSettings.getByRole("textbox", { name: "Label" }).fill("Stream address");
  await textSettings.getByRole("textbox", { name: "Placeholder" }).fill("https://");
  await shoot(page, "4-settings-basics");
  await textSettings.getByRole("tab", { name: "Appearance" }).click();
  await textSettings.getByRole("radio", { name: "50% of the row" }).click();
  await textSettings.getByRole("tab", { name: "Conditions" }).click();
  await textSettings.getByRole("switch", { name: "Only show this field sometimes" }).click();
  await textSettings.getByLabel("Field for rule 1").selectOption("format");
  await textSettings.getByLabel("Value for rule 1").selectOption("online");
  await textSettings.getByText("Shown when Format is Online.").waitFor();
  await shoot(page, "5-settings-conditions");
  await textSettings.getByRole("tab", { name: "Validation" }).click();
  await textSettings.getByRole("switch", { name: "Required" }).click();
  await shoot(page, "6-settings-validation");
  await textSettings.getByRole("button", { name: "Done" }).click();
  await shoot(page, "7-builder-canvas");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Save", exact: true })
    .and(page.locator("[disabled]"))
    .waitFor();

  const blueprint = await api("GET", "/blueprints/event", undefined, cookie);
  const [, format, stream] = blueprint.json.fields;
  assert.equal(format.width, 50);
  assert.deepEqual(stream.conditions.rules, [{ field: "format", operator: "is", value: "online" }]);

  // The entry: the field follows the Select, and is saved only while shown.
  await page.goto(`${adminUrl}/content/events/new`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Title").fill("Summer talk");
  const streamField = page.getByLabel(/Stream address/);
  assert.equal(await streamField.count(), 0, "hidden until Format is Online");
  await page.getByLabel("Format").selectOption("online");
  await streamField.waitFor();
  await streamField.fill("https://example.com/live");
  await shoot(page, "8-entry-editor-widths");
  await page.getByLabel("Format").selectOption({ label: "At a venue" });
  await streamField.waitFor({ state: "detached" });
  // The editor saves on its own; wait for the entry to exist, then for what was saved.
  await page.waitForURL((url) => !url.pathname.endsWith("/new"));
  const entryId = new URL(page.url()).pathname.split("/").at(-1);
  await savedData(entryId, (data) => data.format === "at_a_venue");
  const hidden = await savedData(entryId, (data) => (data.stream_address ?? null) === null);
  assert.equal(hidden.stream_address ?? null, null, "a hidden field is cleared on save");

  await page.getByLabel("Format").selectOption({ label: "Online" });
  await streamField.fill("https://example.com/live");
  const shown = await savedData(
    entryId,
    (data) => data.stream_address === "https://example.com/live",
  );
  assert.equal(shown.format, "online");
  console.warn("Field conditions work end to end.");
} finally {
  await browser.close();
}
