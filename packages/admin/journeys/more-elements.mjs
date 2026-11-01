// The "more elements" journey, in a real Chromium: set up a new site with a blog and the
// shop, publish two posts, design a page with a slider, a collection list of the latest
// posts and a product grid, publish it, and check all three on the website. See README.md
// for how to run it against a fresh Lintel.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const adminUrl = process.env.ADMIN_URL ?? "http://localhost:5173";
const apiUrl = process.env.API_URL ?? "http://localhost:4000";
const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const screenshots = process.env.SCREENSHOTS ?? "";
const posts = ["Our new rye loaf", "Baking with children"];

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
}

/** The blog and the shop are switched on, and two posts published, through the API. */
async function addPostsAndTheShop(page) {
  const api = page.context().request;
  const headers = { origin: adminUrl };
  const current = await (await api.get(`${apiUrl}/plugins`, { headers })).json();
  const enabled = current.plugins.filter((plugin) => plugin.enabled).map((plugin) => plugin.id);
  const plugins = await api.put(`${apiUrl}/plugins`, {
    headers,
    data: { enabled: [...new Set([...enabled, "blog", "commerce"])] },
  });
  check(plugins.ok(), `Switching the plugins on answered ${plugins.status()}`);
  for (const [index, title] of posts.entries()) {
    const created = await api.post(`${apiUrl}/collections/posts/entries`, {
      headers,
      data: {
        data: { title, excerpt: `A short note about ${title.toLowerCase()}.` },
        slug: `post-${index + 1}`,
      },
    });
    check(created.ok(), `Making a post answered ${created.status()}: ${await created.text()}`);
    const { id } = await created.json();
    const published = await api.post(`${apiUrl}/entries/${id}/publish`, { headers });
    check(published.ok(), `Publishing a post answered ${published.status()}`);
  }
}

async function insertElement(page, search, name) {
  await page.getByRole("tab", { name: "Insert" }).click();
  await page.getByRole("radio", { name: "Elements" }).click();
  const box = page.getByRole("searchbox", { name: "Search sections and elements" });
  await box.fill(search);
  await page.getByRole("button", { name, exact: true }).first().click();
  await box.fill("");
}

async function designThePage(page) {
  await page.goto(`${adminUrl}/content/pages/new`);
  await page.getByRole("button", { name: "Start designing" }).waitFor();
  await page.getByRole("textbox", { name: "Title" }).fill("Highlights");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "This page is empty" }).waitFor();
  const tour = page.getByRole("dialog", { name: "Add sections and elements" });
  if (await tour.isVisible().catch(() => false)) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add elements" }).click();
  check(
    await page.getByRole("radio", { name: "Elements" }).isChecked(),
    "Add elements should open Insert on Elements",
  );
  await page.getByRole("heading", { name: "Collections" }).first().waitFor();
  await page.waitForTimeout(500);
  await shoot(page, "01-insert-elements");

  const canvas = page.frameLocator('iframe[title="Your page"]');
  await insertElement(page, "slider", "Slider");
  await canvas.locator('[aria-roledescription="carousel"]').waitFor();
  await shoot(page, "02-slider-added");

  await insertElement(page, "collection", "Collection list");
  await page.getByRole("tab", { name: "Content" }).click();
  await page.getByRole("combobox", { name: "Collection" }).selectOption({ label: "Blog posts" });
  await canvas.getByText(posts[1]).first().waitFor();
  await page.waitForTimeout(500);
  await shoot(page, "03-collection-list");

  // The item design's heading shows each post's title.
  await canvas.locator("h3", { hasText: posts[1] }).first().click();
  await page.getByRole("tab", { name: "Content" }).click();
  const shows = page.getByRole("combobox", { name: "Text: Shows" });
  check((await shows.inputValue()) === "title", "The list's heading should show each post's title");
  await shoot(page, "04-show-a-field");

  // Back to the page itself, so the grid goes after the list rather than inside it.
  await page
    .getByRole("navigation", { name: "Where the selected element is" })
    .getByRole("button", { name: "Page" })
    .click();
  await insertElement(page, "product grid", "Product grid");
  await canvas.locator(".lintel-product-grid").waitFor();
  await page.waitForTimeout(500);
  await shoot(page, "05-product-grid");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Saved").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function seeItOnTheWebsite(page) {
  const response = await page.goto(`${siteUrl}/highlights`);
  check(response?.ok(), `The website answered ${response?.status()}`);
  const html = await response.text();
  check(html.includes('aria-roledescription="carousel"'), "The slider isn't on the website");
  check(
    /<script src="\/_lintel\/elements-[0-9a-f]+\.js" defer/.test(html),
    "The elements script isn't loaded",
  );
  for (const title of posts) check(html.includes(title), `The post “${title}” isn't in the list`);
  check(html.indexOf(posts[1]) < html.indexOf(posts[0]), "The newest post should come first");
  check(
    html.includes("No products here yet."),
    "The product grid should say the shop has no products yet",
  );

  const slider = page.locator('[aria-roledescription="carousel"]');
  const dots = slider.getByRole("button", { name: /Slide \d of 3/ });
  check((await dots.count()) === 3, "The slider should have a dot for each slide");
  await slider.getByRole("button", { name: "Next slide" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.lintel-carousel__dot[aria-current="true"]')
        ?.getAttribute("aria-label") === "Slide 2 of 3",
    undefined,
    { timeout: 5000 },
  );
  await slider.locator(".lintel-carousel__track").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  await shoot(page, "06-website");

  const shop = await page.goto(`${siteUrl}/shop`);
  check(shop?.ok(), `The shop answered ${shop?.status()}`);
  await shoot(page, "07-shop-page");
  const cart = await page.goto(`${siteUrl}/cart`);
  check(cart?.ok(), `The basket answered ${cart?.status()}`);

  for (const [name, width] of [
    ["08-website-tablet", 820],
    ["09-website-phone", 390],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${siteUrl}/highlights`);
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(overflow <= 1, `The page is wider than a ${width}px screen by ${overflow}px`);
    await shoot(page, name);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await setUpSite(page);
  await addPostsAndTheShop(page);
  await designThePage(page);
  await seeItOnTheWebsite(page);
  process.stdout.write(
    "The journey worked: slider, collection list and product grid on the website.\n",
  );
} catch (error) {
  await shoot(page, "failed");
  throw error;
} finally {
  await browser.close();
}
