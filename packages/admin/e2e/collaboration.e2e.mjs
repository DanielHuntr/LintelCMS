// End-to-end check of people working on one page at once, in real browsers, against a running
// Lintel:
//
//   API_URL=http://localhost:4791 ADMIN_URL=http://localhost:5791 \
//     SCREENSHOTS=docs/qa/screenshots/collaboration node packages/admin/e2e/collaboration.e2e.mjs
//
// It sets the site up if it needs it, invites an editor and a client, and makes a page of its
// own, so it can run again on the same site. The whole run has a time limit. Each step says
// PASS or FAIL, and the run fails if any did.
/* eslint-disable no-console -- a script: what it prints is its result */
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

// Playwright is installed with the browser tests (packages/motion), or globally.
const { chromium } = createRequire(import.meta.url)("playwright");

const apiUrl = process.env.API_URL ?? "http://localhost:4791";
const adminUrl = process.env.ADMIN_URL ?? "http://localhost:5791";
const shots = process.env.SCREENSHOTS;
const only = process.env.ONLY?.split(",");
const password = process.env.OWNER_PASSWORD ?? "correct horse battery staple 77";
const people = {
  sam: { email: process.env.OWNER_EMAIL ?? "sam@example.com", name: "Sam Lee" },
  ada: { email: "ada@example.com", name: "Ada King", role: "editor" },
  cleo: { email: "cleo@example.com", name: "Cleo Client", role: "client-content-only" },
};
const TIME_LIMIT_SECONDS = Number(process.env.TIME_LIMIT ?? 420);
setTimeout(() => {
  console.log("FAIL  the run went over its time limit");
  process.exit(2);
}, TIME_LIMIT_SECONDS * 1000).unref();

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function until(test, milliseconds = 8000) {
  const end = Date.now() + milliseconds;
  for (;;) {
    try {
      if (await test()) return true;
    } catch {
      // The canvas may be drawing the page again.
    }
    if (Date.now() > end) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function call(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      origin: new URL(adminUrl).origin,
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function prepareSite() {
  const status = await call("/setup/status");
  if (status.json.needsSetup) {
    await call("/setup/finish", {
      method: "POST",
      body: {
        account: { email: people.sam.email, name: people.sam.name, password },
        site: { siteName: "Brightside Bakery", siteType: "business" },
      },
    });
  }
  const signIn = await call("/auth/sign-in", {
    method: "POST",
    body: { email: people.sam.email, password },
  });
  const cookie = signIn.cookie;
  const roles = (await call("/roles", { cookie })).json.roles;
  for (const person of [people.ada, people.cleo]) {
    const canSignIn = await call("/auth/sign-in", {
      method: "POST",
      body: { email: person.email, password },
    });
    if (canSignIn.status === 200) continue;
    const roleId = roles.find((role) => role.handle === person.role)?.id;
    const sent = await call("/invitations", {
      method: "POST",
      cookie,
      body: { email: person.email, roleId },
    });
    const token = sent.json.invitationUrl.split("#token=")[1];
    await call("/invitations/accept", {
      method: "POST",
      body: { token, name: person.name, password },
    });
  }
  return cookie;
}

const element = (id, type, props, children = []) => ({
  id,
  type,
  name: "",
  props,
  styles: { base: {} },
  children,
  hidden: false,
  locked: false,
});

async function makePage(cookie, title) {
  const design = {
    version: 2,
    root: element("page", "page", {}, [
      {
        ...element("hero", "section", {}, [
          element("hero-heading", "heading", { text: "Fresh bread every morning", level: 1 }),
          element("hero-text", "text", { text: "Baked by hand in the old town since 1921." }),
        ]),
        styles: { base: { paddingTop: "48px", paddingBottom: "48px" } },
      },
    ]),
  };
  const created = await call("/collections/pages/entries", {
    method: "POST",
    cookie,
    body: { data: { title, design } },
  });
  const { id } = created.json;
  return {
    id,
    content: `${adminUrl}/content/pages/${id}`,
    design: `${adminUrl}/content/pages/${id}/design/design`,
  };
}

// Each person signs in once, as sign-in has a rate limit; later browsers reuse the session.
const sessions = new Map();

async function signIn(browser, person, { liveBlocked = false, ...options } = {}) {
  const storageState = sessions.get(person.email);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    ...(storageState ? { storageState } : {}),
    ...options,
  });
  await context.addInitScript(() => {
    // The canvas frame runs this too, and has no storage of its own.
    if (window.self !== window.top) return;
    localStorage.setItem("lintel.builder.tourSeen", "yes");
    localStorage.setItem("lintel.builder.clientTourSeen", "yes");
  });
  if (liveBlocked) await blockLiveConnection(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => console.log(`  [${person.name}] ${error.message}`));
  if (!storageState) {
    await page.goto(`${adminUrl}/sign-in`);
    await page.getByLabel("Email").fill(person.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("sign-in"));
    sessions.set(person.email, await context.storageState());
  }
  return { context, page, name: person.name };
}

/** As on shared hosting that doesn't pass WebSockets on. */
const blockLiveConnection = (context) =>
  context.routeWebSocket(/\/live$/, (socket) => socket.close());

/** A connection that can be cut, and stays cut until it's mended. */
async function severableConnection(context) {
  const open = new Set();
  let isCut = false;
  let changesSent = 0;
  await context.routeWebSocket(/\/live$/, (socket) => {
    if (isCut) {
      socket.close();
      return;
    }
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      if (String(message).includes('"type":"changes"')) changesSent += 1;
      server.send(message);
    });
    server.onMessage((message) => socket.send(message));
    open.add(socket);
  });
  return {
    changesSent: () => changesSent,
    cut() {
      isCut = true;
      for (const socket of open) void socket.close();
      open.clear();
    },
    mend() {
      isCut = false;
    },
  };
}

const canvas = (page) => page.frameLocator("iframe").first();
const node = (page, id) => canvas(page).locator(`[data-lintel-node="${id}"]`).first();
const wordsOf = (page, id) => node(page, id).innerText();

async function typeInto(page, id, words) {
  await node(page, id).dblclick({ force: true, position: { x: 20, y: 8 } });
  await page.waitForTimeout(150);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(words);
  await page.waitForTimeout(100);
  await node(page, "hero").click({ force: true, position: { x: 700, y: 6 } });
}

async function openDesigner(person, url) {
  await person.page.goto(url);
  await node(person.page, "hero-heading").waitFor();
  await person.page.waitForTimeout(600);
}

const shot = async (person, name) => {
  if (!shots) return;
  // Long enough for a dialog to finish appearing.
  await person.page.waitForTimeout(500);
  await person.page.screenshot({ path: join(shots, `${name}.png`) });
};

const storedDesign = async (cookie, id) => {
  const entry = (await call(`/entries/${id}`, { cookie })).json;
  const find = (from, wanted) =>
    from.id === wanted ? from : from.children.map((each) => find(each, wanted)).find(Boolean);
  return { entry, text: (wanted) => find(entry.data.design.root, wanted)?.props.text };
};

const steps = {
  async presence(browser, cookie) {
    const pageToEdit = await makePage(cookie, "Who is here");
    const sam = await signIn(browser, people.sam);
    const ada = await signIn(browser, people.ada);
    await sam.page.goto(pageToEdit.content);
    await ada.page.goto(pageToEdit.content);
    const adaButton = sam.page.getByRole("button", { name: "Ada King is also on this page" });
    check("the top bar shows who else is on the page", await until(() => adaButton.isVisible()));
    check(
      "the tree shows who is on which page",
      await until(async () => (await sam.page.locator("[data-people-on-row]").count()) === 1),
    );
    await adaButton.click();
    check(
      "pressing it says where they are",
      await sam.page.getByText("Editing content").isVisible(),
    );
    await shot(sam, "presence-desktop-light");
    await sam.context.close();
    await ada.context.close();

    for (const [name, options] of [
      ["presence-desktop-dark", { colorScheme: "dark" }],
      ["presence-phone-light", { viewport: { width: 390, height: 844 } }],
      ["presence-phone-dark", { viewport: { width: 390, height: 844 }, colorScheme: "dark" }],
    ]) {
      const first = await signIn(browser, people.sam, options);
      const second = await signIn(browser, people.ada);
      await first.page.goto(pageToEdit.content);
      await second.page.goto(pageToEdit.content);
      const seen = await until(() =>
        first.page.getByRole("button", { name: "Ada King is also on this page" }).isVisible(),
      );
      const fits = await first.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      check(`avatars show and nothing spills sideways: ${name}`, seen && fits);
      await shot(first, name);
      await first.context.close();
      await second.context.close();
    }
  },

  async oneConnection(browser, cookie) {
    const pageToEdit = await makePage(cookie, "Two tabs");
    const sam = await signIn(browser, people.sam);
    let sockets = 0;
    sam.context.on("page", (page) => {
      page.on("websocket", (socket) => {
        if (socket.url().endsWith("/live")) sockets += 1;
      });
    });
    sam.page.on("websocket", (socket) => {
      if (socket.url().endsWith("/live")) sockets += 1;
    });
    await sam.page.goto(pageToEdit.content);
    await sam.page.waitForTimeout(1200);
    const before = sockets;
    const second = await sam.context.newPage();
    await second.goto(pageToEdit.content);
    await second.waitForTimeout(1500);
    check("a second tab shares the browser's connection", sockets === before, `${sockets} opened`);
    const ada = await signIn(browser, people.ada);
    await ada.page.goto(pageToEdit.content);
    const samHere = ada.page.getByRole("button", { name: "Sam Lee is also on this page" });
    check("the other person sees one Sam", await until(() => samHere.isVisible()));
    await sam.page.close();
    await second.waitForTimeout(1500);
    check(
      "closing the tab holding the connection leaves the other tab connected",
      await until(() => samHere.isVisible()),
      `${sockets} opened`,
    );
    await sam.context.close();
    await ada.context.close();
  },

  async live(browser, cookie) {
    const pageToEdit = await makePage(cookie, "Live together");
    const sam = await signIn(browser, people.sam);
    const ada = await signIn(browser, people.ada);
    const connection = await severableConnection(ada.context);
    await openDesigner(sam, pageToEdit.design);
    await openDesigner(ada, pageToEdit.design);

    await node(sam.page, "hero-text").click({ force: true, position: { x: 20, y: 8 } });
    check(
      "Ada sees what Sam has selected, with his name",
      await until(async () => {
        const box = canvas(ada.page).locator(".lintel-peer-box:not([hidden])");
        return (await box.count()) === 1 && (await box.textContent()) === "Sam Lee";
      }),
    );
    await node(sam.page, "hero-heading").hover({ force: true, position: { x: 200, y: 10 } });
    check(
      "Ada sees Sam's pointer",
      await until(
        async () =>
          (await canvas(ada.page).locator(".lintel-peer-pointer:not([hidden])").count()) === 1,
      ),
    );
    await shot(ada, "live-cursor-and-selection-desktop-light");

    await typeInto(sam.page, "hero-heading", "Warm bread every morning");
    await until(async () => (await wordsOf(ada.page, "hero-heading")).includes("Warm bread"));
    await ada.page.waitForTimeout(800);
    check(
      "someone else's change isn't sent back by the screen it arrives on",
      connection.changesSent() === 0,
      `${connection.changesSent()} sent`,
    );
    await typeInto(ada.page, "hero-text", "Baked by hand since 1921.");
    const everyoneHas = async (id, words) =>
      (await wordsOf(sam.page, id)).includes(words) &&
      (await wordsOf(ada.page, id)).includes(words);
    check(
      "both people's changes reach both screens",
      await until(
        async () =>
          (await everyoneHas("hero-heading", "Warm bread")) &&
          (await everyoneHas("hero-text", "since 1921.")),
      ),
    );
    check(
      "the site's navigation and footer stay on the page",
      (await canvas(ada.page).locator('[data-lintel-node="site-navigation"]').count()) === 1,
    );

    await sam.page.getByRole("button", { name: /^Undo/ }).first().click();
    check(
      "Sam's undo takes away his change and leaves Ada's",
      await until(
        async () =>
          (await everyoneHas("hero-heading", "Fresh bread")) &&
          (await everyoneHas("hero-text", "since 1921.")),
      ),
    );
    await sam.page.getByRole("button", { name: /^Redo/ }).first().click();
    await until(() => everyoneHas("hero-heading", "Warm bread"));

    connection.cut();
    await until(async () => (await ada.page.getByText("Reconnecting…").count()) === 1);
    await typeInto(ada.page, "hero-text", "Typed with no connection.");
    await typeInto(sam.page, "hero-heading", "Sam kept working");
    check(
      "Ada is told calmly that she is reconnecting",
      await ada.page.getByText("Reconnecting…").isVisible(),
    );
    await shot(ada, "connection-lost-desktop-light");
    check(
      "Ada's words stay on her screen",
      (await wordsOf(ada.page, "hero-text")).includes("Typed with no connection"),
    );
    connection.mend();
    check(
      "when it comes back, both have both changes",
      await until(
        async () =>
          (await everyoneHas("hero-text", "Typed with no connection")) &&
          (await everyoneHas("hero-heading", "Sam kept working")),
        25_000,
      ),
    );

    await sam.page.getByRole("button", { name: /^Publish/ }).click();
    await until(
      async () => (await storedDesign(cookie, pageToEdit.id)).entry.status === "published",
    );
    const live = (await call(`/entries/${pageToEdit.id}/live`, { cookie })).json;
    check(
      "publishing puts everyone's changes live",
      JSON.stringify(live.data.design).includes("Typed with no connection") &&
        JSON.stringify(live.data.design).includes("Sam kept working"),
    );
    check(
      "Ada's screen hears it was published",
      await until(() => ada.page.getByText("Live", { exact: false }).first().isVisible()),
    );
    await typeInto(ada.page, "hero-text", "After publishing.");
    await until(async () =>
      (await storedDesign(cookie, pageToEdit.id)).text("hero-text")?.includes("After"),
    );
    const stillLive = (await call(`/entries/${pageToEdit.id}/live`, { cookie })).json;
    check(
      "a later change stays off the website until published",
      !JSON.stringify(stillLive.data.design).includes("After publishing"),
    );
    await sam.context.close();
    await ada.context.close();

    const dark = await signIn(browser, people.sam, { colorScheme: "dark" });
    const other = await signIn(browser, people.ada);
    await openDesigner(dark, pageToEdit.design);
    await openDesigner(other, pageToEdit.design);
    await node(other.page, "hero-text").click({ force: true, position: { x: 20, y: 8 } });
    await node(other.page, "hero-heading").hover({ force: true, position: { x: 240, y: 12 } });
    await until(
      async () => (await canvas(dark.page).locator(".lintel-peer-box:not([hidden])").count()) === 1,
    );
    await shot(dark, "live-cursor-and-selection-desktop-dark");
    await dark.context.close();
    await other.context.close();
  },

  async comingBack(browser, cookie) {
    const pageToEdit = await makePage(cookie, "Coming back");
    const sam = await signIn(browser, people.sam);
    const ada = await signIn(browser, people.ada);
    await openDesigner(sam, pageToEdit.design);
    await openDesigner(ada, pageToEdit.design);
    await typeInto(ada.page, "hero-text", "Before going away.");
    await until(async () => (await wordsOf(sam.page, "hero-text")).includes("Before going"));
    // Within the app, so the tab and its connection stay the same.
    await ada.page.getByRole("radio", { name: "Content" }).click();
    await ada.page.getByRole("textbox", { name: "Title" }).waitFor();
    await ada.page.getByRole("radio", { name: "Design" }).click();
    await node(ada.page, "hero-heading").waitFor();
    await ada.page.waitForTimeout(800);
    await typeInto(ada.page, "hero-text", "After coming back.");
    check(
      "edits still reach others after going to Content and back",
      await until(async () => (await wordsOf(sam.page, "hero-text")).includes("After coming back")),
    );
    await sam.context.close();
    await ada.context.close();
  },

  async contentView(browser, cookie) {
    const pageToEdit = await makePage(cookie, "Content together");
    const sam = await signIn(browser, people.sam);
    const ada = await signIn(browser, people.ada);
    await sam.page.goto(pageToEdit.content);
    await ada.page.goto(pageToEdit.content);
    const summary = (person) => person.page.getByLabel("Summary");
    await summary(sam).click();
    check(
      "a field says who is typing in it",
      await until(() => ada.page.getByText("Sam Lee is editing this").isVisible()),
    );
    await shot(ada, "field-being-edited-desktop-light");
    await summary(sam).fill("Bread, baked daily.");
    check(
      "their words arrive without a reload",
      await until(async () => (await summary(ada).inputValue()) === "Bread, baked daily.", 10_000),
    );
    await sam.context.close();
    await ada.context.close();
  },

  async client(browser, cookie) {
    const pageToEdit = await makePage(cookie, "With the client");
    const sam = await signIn(browser, people.sam);
    const cleo = await signIn(browser, people.cleo);
    await openDesigner(sam, pageToEdit.design);
    await openDesigner(cleo, pageToEdit.design);
    check(
      "the client sees the designer on the page",
      await until(() =>
        cleo.page.getByRole("button", { name: "Sam Lee is also on this page" }).isVisible(),
      ),
    );
    await typeInto(cleo.page, "hero-text", "Words from the client.");
    check(
      "the client's words reach the designer",
      await until(async () => (await wordsOf(sam.page, "hero-text")).includes("from the client")),
    );
    await shot(cleo, "client-with-designer-desktop-light");
    await sam.context.close();
    await cleo.context.close();
  },

  async versions(browser, cookie) {
    const plugins = (await call("/plugins", { cookie })).json.plugins;
    const enabled = plugins.filter((each) => each.enabled).map((each) => each.id);
    await call("/plugins", {
      method: "PUT",
      cookie,
      body: { enabled: [...new Set([...enabled, "experiments"])] },
    });
    const pageToEdit = await makePage(cookie, "Trying a version");
    const made = await call("/experiments", {
      method: "POST",
      cookie,
      body: { entryId: pageToEdit.id },
    });
    const sam = await signIn(browser, people.sam);
    const ada = await signIn(browser, people.ada);
    await openDesigner(sam, pageToEdit.design);
    await openDesigner(ada, pageToEdit.design);
    await sam.page.getByRole("radio", { name: "B", exact: true }).click();
    await sam.page.waitForTimeout(1200);
    await node(sam.page, "hero-heading").waitFor();
    await typeInto(sam.page, "hero-heading", "Only in version B");
    await typeInto(ada.page, "hero-text", "Only on the original");
    await sam.page.waitForTimeout(2500);
    check(
      "changes to a version don't reach someone on the original",
      !(await wordsOf(ada.page, "hero-heading")).includes("Only in version B"),
    );
    await sam.page.getByRole("radio", { name: "Original" }).click();
    await sam.page.waitForTimeout(1200);
    check(
      "coming back to the original shows what was done to it meanwhile",
      await until(async () =>
        (await wordsOf(sam.page, "hero-text")).includes("Only on the original"),
      ),
    );
    check(
      "and not what was done to the version",
      !(await wordsOf(sam.page, "hero-heading")).includes("Only in version B"),
    );
    const test = (await call(`/experiments/${made.json.id}`, { cookie })).json;
    const versionB = test.versions.find((each) => each.key === "b");
    check(
      "the version kept its own change",
      JSON.stringify(versionB.design).includes("Only in version B"),
    );
    await sam.page.waitForTimeout(1500);
    const stored = await storedDesign(cookie, pageToEdit.id);
    check(
      "the page kept its own change",
      stored.text("hero-text") === "Only on the original" &&
        !JSON.stringify(stored.entry.data.design).includes("Only in version B"),
    );
    await sam.context.close();
    await ada.context.close();
  },

  async blocked(browser, cookie) {
    const pageToEdit = await makePage(cookie, "No live connection");
    const options = { liveBlocked: true };
    const sam = await signIn(browser, people.sam, options);
    const ada = await signIn(browser, people.ada, options);
    await sam.page.goto(pageToEdit.content);
    await ada.page.goto(pageToEdit.content);
    const title = (person) => person.page.getByRole("textbox", { name: "Title" });
    await title(ada).fill("Ada's title");
    await sam.page.waitForTimeout(300);
    await title(sam).fill("Sam's title");
    await sam.page.waitForTimeout(2500);
    await ada.page.waitForTimeout(500);
    const asked = await until(
      async () =>
        (await sam.page
          .getByRole("heading", { name: /changed this while you were working/ })
          .count()) +
          (await ada.page
            .getByRole("heading", { name: /changed this while you were working/ })
            .count()) ===
        1,
      8000,
    );
    check("with the connection blocked, a clash is caught and asked about", asked);
    const asker = (await sam.page.getByRole("button", { name: "Keep mine" }).count()) ? sam : ada;
    await shot(asker, "conflict-desktop-light");
    await asker.page.getByRole("button", { name: "Keep mine" }).click();
    await asker.page.waitForTimeout(2500);
    const entry = (await storedDesign(cookie, pageToEdit.id)).entry;
    check(
      "the choice is saved",
      entry.data.title === `${asker.name.split(" ")[0]}'s title`,
      String(entry.data.title),
    );
    const history = (await call(`/entries/${pageToEdit.id}/revisions`, { cookie })).json.revisions;
    check("the other version stays in History", history.length >= 2, `${history.length} versions`);

    await openDesigner(sam, pageToEdit.design);
    await openDesigner(ada, pageToEdit.design);
    await typeInto(sam.page, "hero-heading", "Sam's heading");
    await sam.page.waitForTimeout(2500);
    await typeInto(ada.page, "hero-text", "Ada's paragraph.");
    await ada.page.waitForTimeout(3000);
    const both = await storedDesign(cookie, pageToEdit.id);
    check(
      "different elements merge without asking",
      both.text("hero-heading") === "Sam's heading" &&
        both.text("hero-text") === "Ada's paragraph.",
      `${both.text("hero-heading")} / ${both.text("hero-text")}`,
    );
    // Sam hasn't seen Ada's paragraph, so his change to it is the one that clashes.
    await typeInto(sam.page, "hero-text", "Sam's own words here");
    check(
      "the same element changed twice is asked about",
      await until(() => sam.page.getByRole("button", { name: "Keep mine" }).isVisible()),
    );
    await shot(sam, "design-conflict-desktop-light");
    await sam.page.getByRole("button", { name: "Use Ada King’s" }).click();
    await sam.page.waitForTimeout(2500);
    const settled = await storedDesign(cookie, pageToEdit.id);
    check("their choice stands", settled.text("hero-text") === "Ada's paragraph.");
    check(
      "the screen shows what was chosen",
      (await wordsOf(sam.page, "hero-text")).includes("Ada's paragraph"),
    );
    const versions = (await call(`/entries/${pageToEdit.id}/revisions`, { cookie })).json.revisions;
    check(
      "what wasn't chosen is kept",
      versions.some((each) => each.kind === "kept"),
    );
    await sam.context.close();
    await ada.context.close();

    for (const [name, opts] of [
      ["conflict-desktop-dark", { colorScheme: "dark" }],
      ["conflict-phone-light", { viewport: { width: 390, height: 844 } }],
      ["conflict-phone-dark", { viewport: { width: 390, height: 844 }, colorScheme: "dark" }],
    ]) {
      const clash = await makePage(cookie, `Clash ${name}`);
      const first = await signIn(browser, people.sam, { ...opts, ...options });
      await first.page.goto(clash.content);
      await first.page.getByRole("textbox", { name: "Title" }).waitFor();
      await call(`/entries/${clash.id}`, {
        method: "PATCH",
        cookie: (
          await call("/auth/sign-in", {
            method: "POST",
            body: { email: people.ada.email, password },
          })
        ).cookie,
        body: { data: { title: "Ada got there first" } },
      });
      await first.page.getByRole("textbox", { name: "Title" }).fill("Sam's take");
      const shown = await until(() =>
        first.page.getByRole("button", { name: "Keep mine" }).isVisible(),
      );
      check(`the question fits: ${name}`, shown);
      await shot(first, name);
      await first.context.close();
    }
  },
};

const cookie = await prepareSite();
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
for (const [name, run] of Object.entries(steps)) {
  if (only && !only.includes(name)) continue;
  console.log(`\n${name}`);
  try {
    await run(browser, cookie);
  } catch (error) {
    check(`${name} finished`, false, error instanceof Error ? error.message.slice(0, 300) : "");
  }
}
await browser.close();
const passed = results.filter((each) => each.passed).length;
console.log(`\n${passed} of ${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
