import type { EntryResponse } from "@lintel/core";
import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";
import {
  expectSaved,
  historySection,
  startEntry,
  statusSection,
} from "../../src/screens/entry-editor.js";

test("a new post saves itself as a draft while being written", async ({ page, api }) => {
  const title = uniqueTitle("Spring opening times");
  await startEntry(page, "posts", title);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(statusSection(page).getByText("A draft, only visible here.")).toBeVisible();

  await page.getByRole("textbox", { name: "Excerpt" }).fill("Longer days, longer hours.");
  const body = page.getByRole("textbox", { name: "Body" });
  await body.click();
  await page.keyboard.type("We open at seven from March.");
  await expectSaved(page);

  // A reload shows what was saved, with nothing lost.
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Excerpt" })).toHaveValue(
    "Longer days, longer hours.",
  );
  await expect(page.getByRole("textbox", { name: "Body" })).toContainText(
    "We open at seven from March.",
  );

  const entryId = page.url().split("/").pop() ?? "";
  const saved = await api.get<EntryResponse>(`/entries/${entryId}`);
  expect(saved.status).toBe("draft");
  expect(saved.slug).toBe(title.toLowerCase().replaceAll(" ", "-"));
});

test("a draft is published and shows up in the published list", async ({ page }) => {
  const title = uniqueTitle("Now baking croissants");
  await startEntry(page, "posts", title);

  await page.getByRole("main").getByRole("button", { name: "Publish", exact: true }).click();
  await expect(statusSection(page).getByText(/Live on the site since/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Published" })).toBeDisabled();
  await expect(historySection(page).getByText("Published").first()).toBeVisible();

  await page.getByRole("link", { name: "Blog posts" }).click();
  // The filter is a segmented control; it follows the address, so wait for it to switch.
  await page.getByRole("radio", { name: "Published" }).click();
  await expect(page.getByRole("radio", { name: "Published" })).toBeChecked();
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
});

test("a post is scheduled to go live later", async ({ page, api }) => {
  const title = uniqueTitle("Christmas orders open");
  await startEntry(page, "posts", title);

  await statusSection(page).getByRole("button", { name: "Schedule…" }).click();
  await statusSection(page).getByRole("textbox", { name: "Publish on" }).fill("2031-12-01T09:30");
  await statusSection(page).getByRole("button", { name: "Schedule", exact: true }).click();

  await expect(statusSection(page).getByText(/Goes live on Dec 1, 2031/)).toBeVisible();
  const entryId = page.url().split("/").pop() ?? "";
  const scheduled = await api.get<EntryResponse>(`/entries/${entryId}`);
  expect(scheduled.status).toBe("scheduled");
  expect(scheduled.scheduledFor).toBe("2031-12-01T09:30:00.000Z");

  await statusSection(page).getByRole("button", { name: "Cancel schedule" }).click();
  await expect(statusSection(page).getByText("A draft, only visible here.")).toBeVisible();
});

test("a time in the past can't be chosen for scheduling", async ({ page }) => {
  await startEntry(page, "posts", uniqueTitle("Yesterday’s news"));
  await statusSection(page).getByRole("button", { name: "Schedule…" }).click();
  await statusSection(page).getByRole("textbox", { name: "Publish on" }).fill("2020-01-01T09:00");
  await statusSection(page).getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(statusSection(page).getByText("Choose a time in the future.")).toBeVisible();
});

test("an earlier version is restored from the history", async ({ page }) => {
  const title = uniqueTitle("Recipe for rye");
  await startEntry(page, "posts", title);
  await page.getByRole("main").getByRole("button", { name: "Publish", exact: true }).click();
  await expect(statusSection(page).getByText(/Live on the site since/)).toBeVisible();

  await page.getByRole("textbox", { name: "Title", exact: true }).fill(`${title}, revised`);
  await expectSaved(page);
  await expect(statusSection(page).getByText("Unpublished changes.")).toBeVisible();

  const history = historySection(page);
  await history
    .getByRole("button", { name: /Restore the version from/ })
    .first()
    .click();
  const confirm = page.getByRole("alertdialog", { name: "Restore this version?" });
  await confirm.getByRole("button", { name: "Restore" }).click();

  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(title);
  await expect(history.getByText("Restored").first()).toBeVisible();
});

test("a post is deleted after confirming", async ({ page }) => {
  const title = uniqueTitle("Typo post");
  await startEntry(page, "posts", title);

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog", { name: `Delete “${title}”?` })
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(page).toHaveURL(/\/content\/posts$/);
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
});
