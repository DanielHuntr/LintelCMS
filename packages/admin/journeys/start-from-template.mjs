// The "start from a template" journey, in a real Chromium: set up a new site, start from the
// Bakery template, change the home page's heading, animate it, publish, design a new page
// from its title, and see it all on the website. See README.md for how to run it against a
// fresh Lintel.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const adminUrl = process.env.ADMIN_URL ?? "http://localhost:5173";
const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const screenshots = process.env.SCREENSHOTS ?? "";
const heading = "Sourdough, still warm at seven";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function shoot(page, name) {
  if (!screenshots) return;
  mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: `${screenshots}/${name}.png` });
}

async function setUpSite(page) {
  await page.goto(adminUrl);
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("radio", { name: /Built-in/ }).click();
  await page.getByLabel("Your name").fill("Robin Baker");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Email address").fill("robin@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill("a long and memorable password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("radio", { name: /Business/ }).click();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.getByRole("heading", { name: /You’re all set/ }).waitFor();
  await shoot(page, "01-setup-done");
  await page.getByRole("button", { name: "Start from a template" }).click();
}

async function startFromBakery(page) {
  await page.getByRole("heading", { level: 1, name: "Templates" }).waitFor();
  await shoot(page, "02-template-library");
  const bakery = page.getByRole("article", { name: "Bakery and café" });
  await bakery.getByRole("button", { name: "Use this template" }).click();
  const dialog = page.getByRole("dialog", { name: "Start from Bakery and café?" });
  await shoot(page, "03-use-template");
  await dialog.getByRole("button", { name: "Add the pages" }).click();
  await page.getByRole("heading", { name: "Your Bakery and café pages are ready" }).waitFor();
  await page.getByRole("link", { name: "Edit Home" }).click();
}

async function editAndAnimate(page) {
  const tour = page.getByRole("dialog", { name: "Welcome to your page builder" });
  await tour.waitFor();
  await shoot(page, "04-builder-tour");
  await page.getByRole("button", { name: "Next" }).click();
  await shoot(page, "05-tour-select");
  await page.keyboard.press("Escape");

  const canvas = page.frameLocator('iframe[title="Your page"]');
  const title = canvas.locator("h1", { hasText: "Bread worth getting up for" });
  await title.waitFor();
  await title.dblclick();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(heading);
  await page.keyboard.press("Enter");
  await canvas.locator("h1", { hasText: heading }).waitFor();

  await page.getByRole("tab", { name: "Animate" }).click();
  await page.getByRole("button", { name: /^Pop in/ }).click();
  await page.getByRole("heading", { name: "Pop in" }).waitFor();
  await page.waitForTimeout(400);
  await shoot(page, "06-animate-panel");

  await page.getByRole("button", { name: "Tools: Beginner" }).click();
  await page.getByRole("radio", { name: /Designer/ }).click();
  await page.getByRole("radio", { name: "Advanced" }).first().click();
  await page.waitForTimeout(300);
  await shoot(page, "07-designer-timeline");

  await page.getByRole("tab", { name: "Insert" }).click();
  check(
    await page.getByRole("radio", { name: "Sections" }).isChecked(),
    "Insert should open on Sections",
  );
  await page.getByRole("button", { name: "Hero with picture", exact: true }).hover();
  await page.waitForTimeout(700);
  await shoot(page, "08-section-library");
  await page.getByRole("radio", { name: "Elements" }).click();
  await page.getByRole("searchbox", { name: "Search sections and elements" }).fill("quote");
  await page
    .getByRole("region", { name: "Elements" })
    .getByRole("button", { name: "Quote", exact: true })
    .waitFor();
  await shoot(page, "08b-insert-search");
  await page.getByRole("searchbox", { name: "Search sections and elements" }).fill("");
  await page.getByRole("tab", { name: "Layers" }).click();

  const canvasTitle = canvas.locator("h1", { hasText: heading });
  await canvasTitle.click();
  await page.getByRole("tab", { name: "Style" }).click();
  await page.getByRole("radio", { name: "Advanced" }).click();
  const spacing = page.getByRole("button", { name: /^Spacing/ });
  check(
    (await spacing.getAttribute("aria-expanded")) === "false",
    "Advanced styles should start with their groups closed",
  );
  await page.getByRole("combobox", { name: "Style for" }).selectOption({ label: "Pointer over" });
  await page.getByRole("button", { name: /^Text/ }).click();
  await shoot(page, "08c-style-groups");
  await page.getByRole("combobox", { name: "Style for" }).selectOption({ label: "Always" });

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Saved").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await shoot(page, "09-published");
}

async function designANewPage(page) {
  await page.getByRole("link", { name: "Back to Home" }).click();
  const homeDesign = page.getByRole("region", { name: "Design" });
  await homeDesign.getByRole("link", { name: "Edit design" }).waitFor();
  check(
    (await page.getByText("Simple sections (no design)").count()) === 0,
    "A designed page shouldn't offer simple sections",
  );
  await page.waitForTimeout(800);
  await shoot(page, "10-home-design-card");

  await page.goto(`${adminUrl}/content/pages/new`);
  await page.getByRole("button", { name: "Start designing" }).waitFor();
  await shoot(page, "11-new-page");
  await page.getByRole("textbox", { name: "Title" }).fill("Opening hours");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Start your page" }).waitFor();
  await shoot(page, "12-new-page-start");
  await page
    .getByRole("button", { name: /^Call to action/ })
    .first()
    .click();
  await page.getByText("Saved").first().waitFor({ timeout: 15000 });
  await page.getByRole("link", { name: "Back to Opening hours" }).click();
  await page.getByText("1 section on this page").waitFor();
  await shoot(page, "13-new-page-designed");
}

async function seeItOnTheWebsite(page) {
  const response = await page.goto(siteUrl);
  check(response?.ok(), `The website answered ${response?.status()}`);
  const html = await response.text();
  check(html.includes(heading), "The new heading isn't on the website");
  check(
    /<script src="\/_lintel\/motion-[0-9a-f]+\.js"/.test(html),
    "The motion runtime isn't loaded",
  );
  check(html.includes('"presetId"') === false, "The page lists more than it needs");
  check(html.includes('"nodeId"'), "The page's animations aren't listed");
  await page.getByRole("heading", { level: 1, name: heading }).waitFor();
  await page.waitForTimeout(1200);
  const opacity = await page
    .getByRole("heading", { level: 1, name: heading })
    .evaluate((element) => getComputedStyle(element).opacity);
  check(
    opacity === "1",
    `The heading should have finished animating in, but its opacity is ${opacity}`,
  );
  await shoot(page, "14-website-home");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await shoot(page, "15-website-phone");
}

async function reducedMotion(browser) {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(siteUrl);
  const title = page.getByRole("heading", { level: 1, name: heading });
  await title.waitFor();
  const transform = await title.evaluate((element) => getComputedStyle(element).transform);
  check(transform === "none", `With reduced motion the heading shouldn't move (${transform})`);
  await context.close();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await setUpSite(page);
  await startFromBakery(page);
  await editAndAnimate(page);
  await designANewPage(page);
  await seeItOnTheWebsite(page);
  await reducedMotion(browser);
  process.stdout.write(
    "The journey worked: template, edit, animate, publish, a new page, website.\n",
  );
} catch (error) {
  await shoot(page, "failed");
  throw error;
} finally {
  await browser.close();
}
