import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";
import { startEntry } from "../../src/screens/entry-editor.js";

test("a page's search result is previewed while its SEO title is written", async ({
  page,
  api,
}) => {
  await startEntry(page, "posts", uniqueTitle("Gluten-free loaves"));
  const seo = page.getByRole("region", { name: "Search engines" });

  await seo
    .getByRole("textbox", { name: "Title in search results" })
    .fill("Gluten-free bread in Harbour Town");
  await seo.getByRole("textbox", { name: "Description" }).fill("Baked fresh every Friday.");
  await expect(seo.getByRole("figure", { name: "Search result preview" })).toContainText(
    "Gluten-free bread in Harbour Town",
  );
  await expect(seo.getByRole("status").filter({ hasText: /Saved/ })).toBeVisible({
    timeout: 15_000,
  });

  const entryId = page.url().split("/").pop() ?? "";
  const saved = await api.get<Record<string, unknown>>(`/seo/entries/${entryId}`);
  expect(JSON.stringify(saved)).toContain("Baked fresh every Friday.");
});

test.describe("site-wide search settings", () => {
  // The website address is used across the site, so this changes a site of its own.
  test.use({ site: "private" });

  test("published posts are listed in the sitemap, and drafts aren't", async ({
    page,
    lintel,
    content,
  }) => {
    await page.goto("/settings/seo");
    await page.getByRole("textbox", { name: "Website address" }).fill("https://harbourbakery.test");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Saved/ }).first()).toBeVisible();

    const sitemap = await (await fetch(`${lintel.apiUrl}/sitemap.xml`)).text();
    expect(sitemap).toContain(`https://harbourbakery.test/blog/${content.posts.published.slug}`);
    expect(sitemap).not.toContain(content.posts.draft.slug);

    const robots = await (await fetch(`${lintel.apiUrl}/robots.txt`)).text();
    expect(robots).toContain("Sitemap: https://harbourbakery.test/sitemap.xml");
  });
});

test("a redirect is added for a page that moved", async ({ page }) => {
  const from = `/old-${uniqueTitle("menu").split(" ")[1]}`;
  await page.goto("/settings/seo/redirects");
  await page.getByRole("button", { name: "Add redirect" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a redirect" });
  await sheet.getByRole("textbox", { name: "Old address" }).fill(from);
  await sheet.getByRole("textbox", { name: "New address" }).fill("/menu");
  await expect(sheet.getByRole("radio", { name: "For good (301)" })).toBeChecked();
  await sheet.getByRole("button", { name: "Add redirect" }).click();
  await expect(page.getByRole("main").getByText(from)).toBeVisible();
});
