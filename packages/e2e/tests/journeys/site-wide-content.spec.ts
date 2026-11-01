import type { NavigationResponse, TermResponse } from "@lintel/core";
import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";

test("a new category is added and offered while writing a post", async ({ page, content }) => {
  const category = uniqueTitle("Seasonal");
  await page.goto("/content");
  await page.getByRole("link", { name: /^Taxonomies/ }).click();
  await page.getByRole("link", { name: /^Categories/ }).click();

  await page.getByRole("button", { name: "Add term" }).click();
  const sheet = page.getByRole("dialog", { name: "New term" });
  await sheet.getByRole("textbox", { name: "Name" }).fill(category);
  await sheet.getByRole("button", { name: "Add term" }).click();
  await expect(page.getByRole("button", { name: new RegExp(category) })).toBeVisible();

  await page.goto(`/content/posts/${content.posts.draft.id}`);
  await expect(
    page.getByRole("group", { name: "Categories" }).getByRole("checkbox", { name: category }),
  ).toBeVisible();
});

test("a link is added to a menu and saved", async ({ page, api }) => {
  const menuName = uniqueTitle("Footer");
  const handle = menuName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  await api.post("/navigation", { handle, name: menuName, maxDepth: 1 });

  await page.goto("/content/navigation");
  await page.getByRole("link", { name: new RegExp(menuName) }).click();
  await expect(page.getByText("This menu is empty")).toBeVisible();

  await page.getByRole("button", { name: "Add link" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a link" });
  await sheet.getByRole("radio", { name: "A web address" }).check();
  await sheet
    .getByRole("textbox", { name: "A web address" })
    .fill("mailto:hello@harbourbakery.test");
  await sheet.getByRole("textbox", { name: "Label" }).fill("Email us");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("list", { name: "Menu items" }).getByText("Email us")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

  const saved = await api.get<NavigationResponse>(`/navigation/${handle}`);
  expect(saved.items.map((item) => item.label)).toEqual(["Email us"]);
});

test("the main menu's links can be reordered with the keyboard buttons", async ({ page }) => {
  await page.goto("/content/navigation/main");
  const items = page.getByRole("list", { name: "Menu items" });
  await expect(items.getByRole("button", { name: "Move “About us” up" })).toBeEnabled();
  await expect(items.getByRole("button", { name: "Move “Home” up" })).toBeDisabled();
});

test("global settings are changed and saved", async ({ page, api }) => {
  const footer = uniqueTitle("Open every day");
  await page.goto("/content/globals");
  await page.getByRole("link", { name: /^Site settings/ }).click();

  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await page.getByRole("textbox", { name: "Footer text" }).fill(footer);
  await save.click();
  await expect(save).toBeDisabled();

  const saved = await api.get<{ values: Record<string, unknown> }>("/globals/site_settings");
  expect(JSON.stringify(saved)).toContain(footer);
});

test("terms can be renamed", async ({ page, api }) => {
  const term = await api.post<TermResponse>("/taxonomies/tags/terms", {
    title: uniqueTitle("Rye"),
  });
  await page.goto("/content/taxonomies/tags");
  await page.getByRole("button", { name: new RegExp(term.title) }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("textbox", { name: "Name" }).fill(`${term.title} bread`);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`${term.title} bread`) })).toBeVisible();
});
