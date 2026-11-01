import type { EntryResponse } from "@lintel/core";
import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";
import { expectSaved, startEntry } from "../../src/screens/entry-editor.js";

test("a page is built from blocks, with the preview following each save", async ({ page, api }) => {
  const title = uniqueTitle("Visit us");
  await startEntry(page, "pages", title);

  const sections = page.getByRole("group", { name: "Page sections" });
  await sections.getByRole("button", { name: "Add block" }).click();
  await page
    .getByRole("dialog", { name: "Add a block" })
    .getByRole("button", { name: /^Hero/ })
    .click();
  const hero = sections.getByRole("region", { name: "Hero, block 1 of 1" });
  await hero.getByRole("textbox", { name: /Heading/ }).fill("Find us on Harbour Street");

  await sections.getByRole("button", { name: "Add block" }).click();
  await page
    .getByRole("dialog", { name: "Add a block" })
    .getByRole("button", { name: /^FAQ/ })
    .click();
  const faq = sections.getByRole("region", { name: "FAQ, block 2 of 2" });
  await faq.getByRole("textbox", { name: /Question/ }).fill("Do you have parking?");
  await faq.getByRole("textbox", { name: /Answer/ }).click();
  await page.keyboard.type("Yes, behind the shop.");
  await expectSaved(page);

  // Blocks can be put in a different order with the buttons, not only by dragging.
  await faq.getByRole("button", { name: "Move FAQ up" }).click();
  await expect(sections.getByRole("region", { name: "FAQ, block 1 of 2" })).toBeVisible();
  await expectSaved(page);

  await page.getByRole("main").getByRole("button", { name: "Preview" }).click();
  const preview = page.getByRole("complementary", { name: "Preview" });
  await expect(preview.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(preview.getByText("Do you have parking?")).toBeVisible();

  await sections
    .getByRole("region", { name: "Hero, block 2 of 2" })
    .getByRole("textbox", { name: /Heading/ })
    .fill("Find us on Quay Street");
  await expectSaved(page);
  await expect(preview.getByText("Find us on Quay Street")).toBeVisible();

  await preview.getByRole("radio", { name: "Phone" }).check();
  await preview.getByRole("button", { name: "Close preview" }).click();
  await expect(preview).toBeHidden();

  const entryId = page.url().split("/").pop() ?? "";
  const saved = await api.get<EntryResponse>(`/entries/${entryId}`);
  const blocks = saved.data.sections as { type: string }[];
  expect(blocks.map((block) => block.type)).toEqual(["faq", "hero"]);
});

test("a page is placed under another page", async ({ page, content, api }) => {
  await startEntry(page, "pages", uniqueTitle("Our team"));
  const parent = page.getByRole("region", { name: "Parent page" }).getByRole("combobox");
  await parent.selectOption({ label: content.pages.about.title });
  await expect(async () => {
    const entryId = page.url().split("/").pop() ?? "";
    expect((await api.get<EntryResponse>(`/entries/${entryId}`)).parentId).toBe(
      content.pages.about.id,
    );
  }).toPass();

  await page.reload();
  await expect(parent.locator("option:checked")).toHaveText(content.pages.about.title);
});
