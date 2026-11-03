import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLiquidEngine } from "../liquid-templates/liquid-engine.js";
import { createLintelGlobal } from "../liquid-templates/liquid-page-helpers.js";
import { listTemplateNames } from "../liquid-templates/templates-folder.repository.js";
import { STARTER_TEMPLATE_FILES, writeStarterTemplates } from "./starter-templates.js";

describe("the starter templates", () => {
  let folder: string;

  beforeEach(async () => {
    folder = join(await mkdtemp(join(tmpdir(), "lintel-starter-")), "site");
  });

  afterEach(async () => {
    await rm(join(folder, ".."), { recursive: true, force: true });
  });

  it("make the folder with a template, a layout and a partial", async () => {
    const result = await writeStarterTemplates(folder);
    expect(result.kept).toEqual([]);
    expect(
      result.written.map((path) =>
        path
          .slice(folder.length + 1)
          .split("\\")
          .join("/"),
      ),
    ).toEqual(["templates/pages.liquid", "layouts/main.liquid", "partials/card.liquid"]);
    expect(await listTemplateNames(folder)).toEqual(["pages"]);
    const layout = STARTER_TEMPLATE_FILES["layouts/main.liquid"] ?? "";
    for (const tag of ["{% lintel_head %}", "{% site_header %}", "{% site_footer %}"]) {
      expect(layout).toContain(tag);
    }
  });

  it("never replace a file that's already there", async () => {
    await mkdir(join(folder, "layouts"), { recursive: true });
    await writeFile(join(folder, "layouts/main.liquid"), "mine");
    const result = await writeStarterTemplates(folder);
    expect(result.kept).toEqual([join(folder, "layouts/main.liquid")]);
    expect(result.written).toHaveLength(2);
    expect(await readFile(join(folder, "layouts/main.liquid"), "utf8")).toBe("mine");

    const again = await writeStarterTemplates(folder);
    expect(again.written).toEqual([]);
    expect(again.kept).toHaveLength(3);
  });

  it("draw a whole page with Lintel's strict engine", async () => {
    await writeStarterTemplates(folder);
    const engine = createLiquidEngine(folder, { cache: false });
    const lintel = createLintelGlobal({
      menu: async () => [],
      form: async () => "",
      design: () => '<div class="lintel-design"></div>',
      headMarker: "<!--head-->",
      header: "<header>site header</header>",
      footer: "<footer>site footer</footer>",
      cookieSettings: "",
    });
    const html = (await engine.renderFile(
      "pages",
      {},
      {
        globals: {
          entry: { title: "About us", data: { body: { html: "<p>We bake.</p>" } } },
          site: { language: "en", home_url: "/" },
          lintel,
        },
      },
    )) as string;
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<!--head-->");
    expect(html).toContain("<header>site header</header>");
    expect(html).toContain("<h1>About us</h1>");
    expect(html).toContain("<p>We bake.</p>");
    expect(html).toContain('<div class="lintel-design"></div>');
    expect(html).toContain('<aside class="card">');
    expect(html).toContain('<a href="/">Find out more</a>');
    expect(html).toContain("<footer>site footer</footer>");
  });
});
