import { expect, test } from "../../src/fixtures/lintel-test.js";
import {
  chooseSiteAndFinish,
  createOwnerAccount,
  sampleOwner,
  setupScreens,
} from "../../src/screens/setup-wizard.js";

test.use({ site: "fresh", signedInAs: null });

test("a new owner sets up Lintel and lands on their dashboard", async ({ page }) => {
  await page.goto("/content");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(setupScreens(page).welcomeHeading).toBeVisible();

  await createOwnerAccount(page);
  await chooseSiteAndFinish(page, "Blog", { expectFeatures: ["Blog"] });

  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("complementary").getByText(sampleOwner.name)).toBeVisible();

  // The site that was built has the blog's content types, ready to write in.
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Content" })
    .click();
  await expect(page.getByRole("link", { name: /^Blog posts/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pages/ })).toBeVisible();
});

test("a mistake on a setup step is explained next to the field", async ({ page }) => {
  const screens = setupScreens(page);
  await page.goto("/setup");
  await screens.getStarted.click();
  await screens.continue.click();
  await screens.continue.click();

  await expect(screens.nameField).toHaveAttribute("aria-invalid", "true");
  await expect(screens.nameField).toHaveAccessibleDescription("Enter your name to continue.");
});

test("once set up, the setup screens can't be used again", async ({ page, lintel }) => {
  await createOwnerAccount(page);

  const response = await page.request.post(`${lintel.apiUrl}/setup`, {
    data: { email: "intruder@example.com", name: "Intruder", password: "another long password" },
  });
  expect(response.status()).toBe(409);
});
