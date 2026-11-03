import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LiquidTemplates } from "./liquid-templates.service.js";
import { keepTemplateChoice, readTemplateChoice } from "./template-choice.js";
import { listTemplateNames } from "./templates-folder.repository.js";

describe("choosing a page's template", () => {
  it("keeps a template name or Designed with the checked values, and drops anything else", () => {
    const checked = { title: "About" };
    expect(keepTemplateChoice({ _template: "landing" }, checked)).toEqual({
      title: "About",
      _template: "landing",
    });
    expect(keepTemplateChoice({ _template: "pages/wide" }, checked)._template).toBe("pages/wide");
    expect(keepTemplateChoice({ _template: "designed" }, checked)._template).toBe("designed");
    for (const value of [null, "", "../secret", "Landing Page", "/abs", 3, { name: "x" }]) {
      expect(keepTemplateChoice({ _template: value }, checked), String(value)).toEqual(checked);
    }
    expect(readTemplateChoice(undefined)).toBeUndefined();
  });
});

describe("the templates folder", () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-templates-"));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  async function file(path: string, content = "") {
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), content);
  }

  it("lists nothing when the folder doesn't exist", async () => {
    expect(await listTemplateNames(join(folder, "missing"))).toEqual([]);
    const templates = new LiquidTemplates({ folder: join(folder, "missing") });
    expect(await templates.chooseTemplate("pages", undefined)).toBeNull();
  });

  it("lists page templates by name, subfolders included, and nothing else", async () => {
    await file("templates/page.liquid");
    await file("templates/pages/wide.liquid");
    await file("templates/Notes.txt");
    await file("templates/Has Spaces.liquid");
    await file("layouts/main.liquid");
    await file("partials/card.liquid");
    expect(await listTemplateNames(folder)).toEqual(["page", "pages/wide"]);
  });

  it("uses the entry's choice, else its collection's template, else the built-in one", async () => {
    await file("templates/pages.liquid");
    await file("templates/landing.liquid");
    const templates = new LiquidTemplates({ folder });
    expect(await templates.chooseTemplate("pages", undefined)).toBe("pages");
    expect(await templates.chooseTemplate("pages", "landing")).toBe("landing");
    expect(await templates.chooseTemplate("posts", "landing")).toBe("landing");
    expect(await templates.chooseTemplate("posts", undefined)).toBeNull();
    // Designed always means the built-in template, which draws the visual design.
    expect(await templates.chooseTemplate("pages", "designed")).toBeNull();
    // A chosen file that has since gone falls back to the collection's.
    expect(await templates.chooseTemplate("pages", "gone")).toBe("pages");
  });

  it("notices new templates once told the folder changed", async () => {
    let changes = 0;
    const templates = new LiquidTemplates({ folder }, () => (changes += 1));
    expect(await templates.listTemplateNames()).toEqual([]);
    await file("templates/pages.liquid", "One");
    // Production keeps the list until restarted (or told).
    expect(await templates.listTemplateNames()).toEqual([]);
    templates.changed();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(changes).toBe(1);
    expect(await templates.listTemplateNames()).toEqual(["pages"]);
    expect(await templates.render("pages", {})).toBe("One");
    await file("templates/pages.liquid", "Two");
    expect(await templates.render("pages", {})).toBe("One");
    templates.changed();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await templates.render("pages", {})).toBe("Two");
  });

  it("in development, picks up a changed file by itself", async () => {
    await file("templates/pages.liquid", "One");
    let changes = 0;
    const templates = new LiquidTemplates({ folder, development: true }, () => (changes += 1));
    templates.startWatching();
    try {
      expect(await templates.render("pages", {})).toBe("One");
      await file("templates/pages.liquid", "Two");
      await expect.poll(() => changes, { timeout: 3000 }).toBeGreaterThan(0);
      await expect.poll(() => templates.render("pages", {}), { timeout: 3000 }).toBe("Two");
    } finally {
      templates.stopWatching();
    }
  });
});
