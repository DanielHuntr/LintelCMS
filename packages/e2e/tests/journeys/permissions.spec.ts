import { expect, test } from "../../src/fixtures/lintel-test.js";

test.use({ signedInAs: "editor" });

test("an editor sees only the sections they work in", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link", { name: "Content" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Media" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Users" })).toHaveCount(0);
});

for (const path of [
  "/settings/api",
  "/settings/webhooks",
  "/settings/seo",
  "/settings/languages",
]) {
  test(`an editor who opens ${path} directly is told it isn't for them`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "You don’t have access to this" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the dashboard" })).toBeVisible();
  });
}

test("the API refuses settings changes from an editor", async ({ editorApi }) => {
  await expect(editorApi.post("/api-tokens", { name: "Sneaky", access: "read" })).rejects.toThrow(
    /403/,
  );
  await expect(editorApi.get("/webhooks")).rejects.toThrow(/403/);
});

test("an editor can still write and publish", async ({ page, content }) => {
  await page.goto(`/content/posts/${content.posts.published.id}`);
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toBeEditable();
  await expect(
    page.getByRole("region", { name: "Status" }).getByRole("button", { name: "Unpublish" }),
  ).toBeVisible();
});
