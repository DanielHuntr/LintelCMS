import { expect, test } from "../../src/fixtures/lintel-test.js";

test("the search palette finds a post and opens it with the keyboard", async ({
  page,
  content,
}) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Search Lintel" });
  await expect(palette).toBeVisible();

  await palette.getByRole("combobox").fill("sourdough");
  await expect(
    palette.getByRole("option", { name: new RegExp(content.posts.published.title) }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`/content/posts/${content.posts.published.id}`));
  await expect(
    page.getByRole("heading", { level: 1, name: content.posts.published.title }),
  ).toBeVisible();
});

test("the search palette finds screens and media too", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  const palette = page.getByRole("dialog", { name: "Search Lintel" });

  await palette.getByRole("combobox").fill("webhooks");
  await expect(palette.getByRole("option", { name: /Webhooks/ }).first()).toBeVisible();

  await palette.getByRole("combobox").fill("harbour");
  await expect(palette.getByRole("option", { name: /harbour\.jpg/ })).toBeVisible();
  await palette.getByRole("option", { name: /harbour\.jpg/ }).click();
  await expect(page.getByRole("dialog", { name: "harbour.jpg" })).toBeVisible();
});

test("the search palette says when nothing matches and closes with Escape", async ({ page }) => {
  await page.goto("/content");
  await page.getByRole("button", { name: "Search" }).click();
  const palette = page.getByRole("dialog", { name: "Search Lintel" });
  await palette.getByRole("combobox").fill("zzqx nothing like this");
  await expect(palette.getByText("Nothing matches “zzqx nothing like this”.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeFocused();
});
