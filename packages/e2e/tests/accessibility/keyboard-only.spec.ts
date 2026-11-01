import { arrowTo, tabTo } from "../../src/accessibility/keyboard.js";
import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";
import { expectSaved } from "../../src/screens/entry-editor.js";
import { setupScreens } from "../../src/screens/setup-wizard.js";

/** These journeys never touch the mouse: only Tab, arrow keys, Enter, Space and typing. */

test.describe("first run", () => {
  test.use({ site: "fresh", signedInAs: null });

  test("setup can be finished with the keyboard alone", async ({ page }) => {
    const screens = setupScreens(page);
    await page.goto("/setup");
    await tabTo(page, screens.getStarted);
    await page.keyboard.press("Enter");

    await expect(screens.builtInDatabase).toBeChecked();
    await tabTo(page, screens.continue);
    await page.keyboard.press("Enter");

    // Each question's field has focus when it appears, and Enter moves on.
    await expect(screens.nameField).toBeFocused();
    await page.keyboard.type("Kim Keys");
    await page.keyboard.press("Enter");
    await expect(screens.emailField).toBeFocused();
    await page.keyboard.type("kim@example.com");
    await page.keyboard.press("Enter");
    await expect(screens.passwordField).toBeFocused();
    await page.keyboard.type("a long and memorable password");
    await page.keyboard.press("Enter");

    // Arrow keys move the choice without leaving the screen; Continue moves on.
    await expect(screens.siteTypeHeading).toBeVisible();
    await tabTo(page, screens.siteType("Business website"));
    await page.keyboard.press("ArrowRight");
    await expect(screens.siteType("Blog")).toBeChecked();
    await tabTo(page, screens.continue);
    await page.keyboard.press("Enter");

    await expect(screens.featuresHeading).toBeVisible();
    await tabTo(page, screens.finishSetup);
    await page.keyboard.press("Enter");
    await tabTo(page, screens.goToDashboard);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });
});

test("a post can be written and published with the keyboard alone", async ({ page }) => {
  const title = uniqueTitle("Keyboard bakes");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  // The first Tab offers a way past the sidebar.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  await tabTo(
    page,
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Content" }),
  );
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("link", { name: /^Blog posts/ }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("link", { name: "New entry" }));
  await page.keyboard.press("Enter");

  await tabTo(page, page.getByRole("textbox", { name: "Title", exact: true }));
  await page.keyboard.type(title);
  await tabTo(page, page.getByRole("textbox", { name: "Body" }));
  await page.keyboard.type("Typed without a mouse.");
  await expectSaved(page);

  await tabTo(page, page.getByRole("main").getByRole("button", { name: "Publish", exact: true }));
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Status" }).getByText(/Live on the site since/),
  ).toBeVisible();
});

test("dialogs keep focus inside and give it back when they close", async ({ page }) => {
  await page.goto("/media");
  // The library is a grid with one tab stop: Tab reaches it, the arrow keys move inside.
  const library = page.getByRole("list", { name: "Media files" });
  await tabTo(page, library.getByRole("button").first());
  await arrowTo(page, library.getByRole("button", { name: /harbour\.jpg/ }));
  await page.keyboard.press("Enter");
  const details = page.getByRole("dialog", { name: "harbour.jpg" });
  await expect(details).toBeVisible();

  for (let presses = 0; presses < 25; presses++) {
    await page.keyboard.press("Tab");
    expect(await details.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(page.getByRole("button", { name: /harbour\.jpg/ })).toBeFocused();
});
