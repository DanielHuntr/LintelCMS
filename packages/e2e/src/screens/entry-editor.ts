import { expect, type Page } from "@playwright/test";

/**
 * Small steps shared by the journeys that use the entry editor. They find things the way
 * a person does, by their visible names, so they keep working when the markup changes.
 */

/**
 * Waits until every change has been saved: the toolbar no longer says "Edited" or
 * "Saving…", and "Saved" has been announced to screen readers.
 */
export async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByRole("main").getByText(/^(Edited|Saving…)$/)).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(
    page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /^Saved$/ })
      .first(),
  ).toBeAttached({ timeout: 15_000 });
}

/** Opens a new entry in a collection and gives it a title, which saves it as a draft. */
export async function startEntry(page: Page, collection: string, title: string): Promise<void> {
  await page.goto(`/content/${collection}/new`);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await expectSaved(page);
  await expect(page).not.toHaveURL(/\/new$/);
}

/** The panel beside the editor with Status, Language, Search engines and History. */
export function detailsPanel(page: Page) {
  return page.getByRole("main").getByRole("complementary").first();
}

export function statusSection(page: Page) {
  return page.getByRole("region", { name: "Status" });
}

export function historySection(page: Page) {
  return page.getByRole("region", { name: "History" });
}
