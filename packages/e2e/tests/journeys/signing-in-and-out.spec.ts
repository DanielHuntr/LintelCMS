import { accounts, expect, test } from "../../src/fixtures/lintel-test.js";

// Signing out ends the session, so this uses a site of its own rather than the shared one.
test.use({ site: "private", signedInAs: null });

test("someone signs in, is taken where they were going, and signs out", async ({ page }) => {
  await page.goto("/content/posts");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Lintel" })).toBeVisible();

  await page.getByRole("textbox", { name: "Email address" }).fill(accounts.editor.email);
  await page.getByRole("textbox", { name: "Password" }).fill(accounts.editor.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/content\/posts$/);
  await expect(page.getByRole("heading", { level: 1, name: "Blog posts" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  // The session is really over: going back doesn't show the admin.
  await page.goto("/content/posts");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Lintel" })).toBeVisible();
});

test("a wrong password is explained without saying which part was wrong", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: "Email address" }).fill(accounts.owner.email);
  await page.getByRole("textbox", { name: "Password" }).fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});
