import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";

test("an owner creates a content type and editors can write in it straight away", async ({
  page,
}) => {
  const name = uniqueTitle("Recipes");
  await page.goto("/settings/content-types");
  await page.getByRole("link", { name: "New content type" }).click();

  await page.getByRole("textbox", { name: "Name" }).fill(name);
  // The choices are cards with the radio button drawn inside, so pick one as people do.
  await page.getByText("A simple list").click();
  await expect(page.getByRole("radio", { name: /A simple list/ })).toBeChecked();
  await page.getByRole("button", { name: "Create and add fields" }).click();

  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("button", { name: "Add field" }).click();
  const addField = page.getByRole("dialog", { name: "Add a field" });
  await addField.getByRole("button", { name: /^Number/ }).click();

  const settings = page.getByRole("dialog").last();
  await settings.getByRole("textbox", { name: "Label" }).fill("Serves");
  await expect(settings.getByRole("textbox", { name: "Handle" })).toHaveValue("serves");
  await settings
    .getByRole("button", { name: /Done|Close/ })
    .first()
    .click();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Content" })
    .click();
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await page.getByRole("link", { name: "New entry" }).first().click();
  await expect(page.getByRole("spinbutton", { name: "Serves" })).toBeVisible();
});

test("a content type can't be created without a name", async ({ page }) => {
  await page.goto("/settings/content-types/new");
  await page.getByRole("button", { name: "Create and add fields" }).click();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
});
