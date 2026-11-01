import type { EntryResponse } from "@lintel/core";
import { expect, test } from "../../src/fixtures/lintel-test.js";
import { expectSaved } from "../../src/screens/entry-editor.js";

// Adding a language changes every entry's Language panel, so this uses a site of its own.
test.use({ site: "private" });

test("a language is added and a page translated into it", async ({ page, content, api }) => {
  await page.goto("/settings/languages");
  await page.getByRole("button", { name: "Add language" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a language" });
  await sheet
    .getByRole("combobox", { name: "Language" })
    .selectOption({ label: "German (Germany)" });
  await sheet.getByRole("button", { name: "Add language" }).click();
  await expect(
    page
      .getByRole("main")
      .getByText(/German/)
      .first(),
  ).toBeVisible();

  await page.goto(`/content/pages/${content.pages.about.id}`);
  const language = page.getByRole("region", { name: "Language" });
  await language.getByRole("button", { name: "Translate into German (Germany)" }).click();

  await expect(
    page.getByRole("region", { name: "Language" }).getByText("Written in German (Germany)"),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Über uns");
  await expectSaved(page);

  const translationId = page.url().split("/").pop() ?? "";
  const translation = await api.get<EntryResponse>(`/entries/${translationId}`);
  expect(translation.locale).toBe("de-DE");
  expect(translation.title).toBe("Über uns");

  // The original links to both of its translations.
  await page.goto(`/content/pages/${content.pages.about.id}`);
  await expect(language.getByRole("link", { name: /German/ })).toBeVisible();
  await expect(language.getByRole("link", { name: /French/ })).toBeVisible();
});

test("the entries list switches language", async ({ page, content }) => {
  await page.goto("/content/pages");
  await page.getByRole("combobox", { name: "Language" }).selectOption({ label: "French (France)" });
  await expect(
    page.getByRole("link", { name: new RegExp(content.pages.aboutInFrench.title) }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(content.pages.home.title) })).toHaveCount(
    0,
  );
});

test("a language with entries written in it can't be removed", async ({ page }) => {
  await page.goto("/settings/languages");
  await page.getByRole("button", { name: "Remove French (France)" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(
    page.getByRole("alert").or(page.getByRole("alertdialog").getByRole("alert")),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText("French (France)").first()).toBeVisible();
});
