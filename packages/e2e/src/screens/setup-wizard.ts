import { expect, type Page } from "@playwright/test";

/**
 * Everything the tests know about the setup wizard's screens lives here: their headings,
 * buttons and fields, and the steps through them. When the wizard changes, this is the one
 * file to update; the journeys, the keyboard test and the accessibility checks all go
 * through it.
 *
 * The wizard asks one question per screen: welcome, database, name, email, password, then
 * what the site is for and its features, then a "you're all set" screen.
 */

export interface NewOwner {
  name: string;
  email: string;
  password: string;
}

export type SiteType =
  "Business website" | "Blog" | "Online shop" | "Portfolio" | "Start from scratch";

export const sampleOwner: NewOwner = {
  name: "Sam Baker",
  email: "sam@example.com",
  password: "a long and memorable password",
};

/** The wizard's screens and controls, found the way people find them. */
export function setupScreens(page: Page) {
  return {
    welcomeHeading: page.getByRole("heading", { level: 1, name: "Welcome to Lintel" }),
    getStarted: page.getByRole("button", { name: "Get started" }),
    databaseChoice: page.getByRole("radiogroup"),
    builtInDatabase: page.getByRole("radio", { name: /Built-in/ }),
    continue: page.getByRole("button", { name: "Continue" }),
    nameField: page.getByRole("textbox", { name: "Your name" }),
    emailField: page.getByRole("textbox", { name: "Email address" }),
    passwordField: page.getByRole("textbox", { name: "Password" }),
    passwordHint: (email: string) => page.getByText(`You’ll use it with ${email} to sign in.`),
    createAccount: page.getByRole("button", { name: "Create account" }),
    siteTypeHeading: page.getByRole("heading", { level: 1, name: "What are you building?" }),
    siteType: (name: SiteType) => page.getByRole("radio", { name: new RegExp(`^${name}`) }),
    featuresHeading: page.getByRole("heading", { level: 1, name: "Choose your features" }),
    feature: (name: string) => page.getByRole("switch", { name }),
    finishSetup: page.getByRole("button", { name: "Finish setup" }),
    doneHeading: (firstName: string) =>
      page.getByRole("heading", { level: 1, name: `You’re all set, ${firstName}` }),
    goToDashboard: page.getByRole("button", { name: "Go to your dashboard" }),
  };
}

/** From the welcome screen to "What are you building?": database, name, email, password. */
export async function createOwnerAccount(page: Page, owner: NewOwner = sampleOwner): Promise<void> {
  const screens = setupScreens(page);
  await page.goto("/setup");
  await screens.getStarted.click();

  await expect(screens.builtInDatabase).toBeChecked();
  await screens.continue.click();

  await screens.nameField.fill(owner.name);
  await screens.continue.click();
  await screens.emailField.fill(owner.email);
  await screens.continue.click();

  await expect(screens.passwordHint(owner.email)).toBeVisible();
  await screens.passwordField.fill(owner.password);
  await screens.createAccount.click();

  await expect(screens.siteTypeHeading).toBeVisible();
}

/**
 * Picks what the site is for (picking a tile moves straight on), checks the features it
 * switched on, then finishes setup and goes to the dashboard.
 */
export async function chooseSiteAndFinish(
  page: Page,
  siteType: SiteType,
  options: { expectFeatures?: string[]; owner?: NewOwner } = {},
): Promise<void> {
  const screens = setupScreens(page);
  const owner = options.owner ?? sampleOwner;
  await screens.siteType(siteType).click();
  await expect(screens.featuresHeading).toBeVisible();
  for (const feature of options.expectFeatures ?? []) {
    await expect(screens.feature(feature)).toBeChecked();
  }
  await screens.finishSetup.click();

  await expect(screens.doneHeading(owner.name.split(" ")[0] ?? owner.name)).toBeVisible();
  await screens.goToDashboard.click();
}
