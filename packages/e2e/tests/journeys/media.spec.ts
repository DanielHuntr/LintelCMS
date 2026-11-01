import type { Asset } from "@lintel/core";
import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";
import { sampleFile } from "../../src/site/seed-site.js";
import { expectSaved, startEntry } from "../../src/screens/entry-editor.js";

test("an editor uploads a photo, marks its subject and describes it", async ({ page, api }) => {
  await page.goto("/media");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload" }).click();
  await (await chooser).setFiles(sampleFile("garden.jpg"));

  const library = page.getByRole("list", { name: "Media files" });
  await expect(library.getByRole("button", { name: /garden\.jpg/ }).first()).toBeVisible();
  await library
    .getByRole("button", { name: /garden\.jpg/ })
    .first()
    .click();

  const details = page.getByRole("dialog", { name: "garden.jpg" });
  await expect(details.getByText("640 × 480")).toBeVisible();

  // The focal point moves with the arrow keys as well as the mouse.
  const focalPoint = details.getByRole("application", { name: "Focal point" });
  await focalPoint.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(details.getByText(/60% across, 40% down/).first()).toBeVisible();

  await details.getByRole("textbox", { name: "Alt text" }).fill("Sunflowers along the garden wall");
  await details.getByRole("textbox", { name: "Alt text" }).blur();
  await expect(details.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // The focal point saves a moment after it stops moving, the alt text when the field is left.
  const id = new URL(page.url()).searchParams.get("asset");
  const savedAsset = async () => {
    const assets = await api.get<{ assets: Asset[] }>("/media?search=garden");
    return assets.assets.find((asset) => asset.id === id) ?? assets.assets[0];
  };
  await expect.poll(async () => (await savedAsset())?.alt).toBe("Sunflowers along the garden wall");
  await expect.poll(async () => (await savedAsset())?.focalPoint).toEqual({ x: 0.6, y: 0.4 });
});

test("a featured image is chosen from the library while writing", async ({ page, content }) => {
  await startEntry(page, "posts", uniqueTitle("A post with a picture"));

  await page
    .getByRole("group", { name: "Featured image" })
    .getByRole("button", { name: "Choose image" })
    .click();
  const picker = page.getByRole("dialog", { name: "Choose an image" });
  await picker.getByRole("button", { name: new RegExp(content.images.harbour.filename) }).click();

  const field = page.getByRole("group", { name: "Featured image" }).first();
  await expect(field.getByText("harbour.jpg")).toBeVisible();
  await expect(field.getByRole("button", { name: "Replace" })).toBeVisible();
  await expectSaved(page);
});

test("an image used by an entry can't be deleted by accident", async ({ page, content }) => {
  await page.goto(`/media?asset=${content.images.harbour.id}`);
  const details = page.getByRole("dialog", { name: "harbour.jpg" });
  await details.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete file" }).click();

  await expect(page.getByText("This file is still in use")).toBeVisible();
  await expect(page.getByText(content.posts.published.title)).toBeVisible();
});
