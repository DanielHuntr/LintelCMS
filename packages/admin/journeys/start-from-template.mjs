// The "start from a template" journey, in a real Chromium: set up a new site, start from the
// Bakery template, change the home page's heading, animate it, publish, and see both on the
// website. See README.md for how to run it against a fresh Lintel.
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
  await page.getByRole("heading", { name: "Ready-made sections" }).waitFor();
  await shoot(page, "08-section-library");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Saved").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await shoot(page, "09-published");
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
  await shoot(page, "10-website-home");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await shoot(page, "11-website-phone");
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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await setUpSite(page);
  await startFromBakery(page);
  await editAndAnimate(page);
  await seeItOnTheWebsite(page);
  await reducedMotion(browser);
  process.stdout.write("The journey worked: template, edit, animate, publish, website.\n");
} finally {
  await browser.close();
}
