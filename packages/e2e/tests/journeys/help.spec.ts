import { expect, test } from "../../src/fixtures/lintel-test.js";

test("help for the current screen opens beside the work and closes again", async ({ page }) => {
  await page.goto("/media");
  await page.getByRole("button", { name: "Help for this screen" }).click();

  const help = page.getByRole("complementary", { name: "Photos and files" });
  await expect(help.getByRole("heading", { level: 2, name: "Photos and files" })).toBeVisible();
  // The library stays usable with help open.
  await expect(page.getByRole("heading", { level: 1, name: "Media" })).toBeVisible();

  await help.getByRole("button", { name: "All help topics" }).click();
  await page.getByRole("button", { name: /^Publishing and scheduling/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Publishing and scheduling" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Close help" }).click();
  await expect(page.getByRole("button", { name: "Help for this screen" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("help can be opened from the entry editor", async ({ page, content }) => {
  await page.goto(`/content/posts/${content.posts.draft.id}`);
  await page.getByRole("button", { name: "Help for this screen" }).click();
  await expect(page.getByRole("button", { name: "Close help" })).toBeVisible();
});

test("the Help section lists every topic and opens one", async ({ page }) => {
  await page.goto("/help");
  const topics = page.getByRole("list", { name: "Help topics" });
  await expect(topics.getByRole("listitem")).toHaveCount(10);
  await topics.getByRole("button", { name: /^History and restoring/ }).click();
  await expect(page).toHaveURL(/topic=/);
  await expect(page.getByRole("heading", { name: "History and restoring" }).first()).toBeVisible();
});
