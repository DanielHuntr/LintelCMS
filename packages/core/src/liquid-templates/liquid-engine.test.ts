import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { MenuItem } from "@lintel/site-components";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLiquidEngine } from "./liquid-engine.js";
import { createLintelGlobal, type LiquidPageHelpers } from "./liquid-page-helpers.js";

const photo = {
  id: "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f",
  url: "http://localhost:4000/media/6f1c/file",
  alt: "Fresh loaves",
  width: 2000,
  height: 1200,
  focalPoint: { x: 0.4, y: 0.6 },
};

const menu: MenuItem[] = [
  {
    label: "About <us>",
    url: "/about",
    newTab: false,
    style: "link",
    current: true,
    children: [
      { label: "Team", url: "/team", newTab: true, style: "link", current: false, children: [] },
    ],
  },
];

function helpers(overrides: Partial<LiquidPageHelpers> = {}): LiquidPageHelpers {
  return {
    menu: async (handle) => (handle === "main" ? menu : []),
    form: async (handle) => `<form data-form="${handle}"></form>`,
    design: () => '<div class="lintel-design">designed</div>',
    headMarker: "<!--head-->",
    header: "<header>site header</header>",
    footer: "<footer>site footer</footer>",
    ...overrides,
  };
}

describe("the Liquid engine", () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-liquid-"));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  async function file(path: string, content: string) {
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), content);
  }

  function render(name: string, variables: Record<string, unknown> = {}) {
    const engine = createLiquidEngine(folder, { cache: false });
    return engine.renderFile(
      name,
      {},
      {
        globals: { ...variables, lintel: createLintelGlobal(helpers()) },
      },
    ) as Promise<string>;
  }

  it("escapes what it prints unless told it is safe", async () => {
    await file("templates/page.liquid", "{{ entry.title }}|{{ entry.title | raw }}");
    expect(await render("page", { entry: { title: "<b>Bread & butter</b>" } })).toBe(
      "&lt;b&gt;Bread &amp; butter&lt;/b&gt;|<b>Bread & butter</b>",
    );
  });

  it("prints rich text's cleaned HTML, and plain text escaped", async () => {
    await file("templates/page.liquid", "{{ body | rich_text }}|{{ words | rich_text }}");
    expect(
      await render("page", { body: { html: "<p>Fresh <em>bread</em></p>" }, words: "<script>" }),
    ).toBe("<p>Fresh <em>bread</em></p>|&lt;script&gt;");
  });

  it("refuses unknown filters and variables, but lets {% if %} and default ask", async () => {
    await file("templates/filter.liquid", "{{ entry.title | shout }}");
    await expect(render("filter", { entry: { title: "Hi" } })).rejects.toThrow(/shout/);
    await file("templates/missing.liquid", "{{ entry.subtitle }}");
    await expect(render("missing", { entry: { title: "Hi" } })).rejects.toThrow(/subtitle/);
    await file(
      "templates/optional.liquid",
      "{% if entry.subtitle %}yes{% else %}no{% endif %}-{{ entry.subtitle | default: 'none' }}",
    );
    expect(await render("optional", { entry: { title: "Hi" } })).toBe("no-none");
  });

  it("reads only its own properties", async () => {
    await file("templates/page.liquid", "{{ entry.constructor }}");
    await expect(render("page", { entry: { title: "Hi" } })).rejects.toThrow();
  });

  it("uses layouts and partials from their own folders", async () => {
    await file(
      "layouts/main.liquid",
      "<!DOCTYPE html><html><head>{% lintel_head %}</head><body>{% site_header %}{% block content %}{% endblock %}{% site_footer %}</body></html>",
    );
    await file("partials/card.liquid", "<article>{{ heading }} for {{ site.name }}</article>");
    await file(
      "templates/page.liquid",
      "{% layout 'main' %}{% block content %}{% render 'card', heading: entry.title %}{% endblock %}",
    );
    expect(await render("page", { entry: { title: "Bread" }, site: { name: "Bakery" } })).toBe(
      "<!DOCTYPE html><html><head><!--head--></head><body><header>site header</header>" +
        "<article>Bread for Bakery</article><footer>site footer</footer></body></html>",
    );
  });

  it("never reads a file outside the templates folder", async () => {
    await writeFile(join(folder, "..", "lintel-secret.liquid"), "secret");
    await file("templates/up.liquid", "{% render '../../lintel-secret' %}");
    await file("templates/include.liquid", "{% include '../lintel-secret' %}");
    await file(
      "templates/absolute.liquid",
      `{% render '${join(folder, "..", "lintel-secret")}' %}`,
    );
    await file("templates/relative.liquid", "{% render './up' %}");
    for (const name of ["up", "include", "absolute", "relative"]) {
      await expect(render(name), name).rejects.toThrow(/Failed to lookup|ENOENT/);
    }
    await expect(render("../partials/x")).rejects.toThrow();
    await rm(join(folder, "..", "lintel-secret.liquid"));
  });

  it("draws a responsive, cropped picture with {% image %}", async () => {
    await file(
      "templates/page.liquid",
      '{% image entry.hero width: 800, ratio: "16/9", class: "hero" %}|{% image entry.none %}',
    );
    const html = await render("page", { entry: { hero: photo, none: null } });
    expect(html).toContain('class="hero"');
    expect(html).toContain('alt="Fresh loaves"');
    expect(html).toContain('sizes="(max-width: 800px) 100vw, 800px"');
    expect(html).toContain("fit=cover");
    expect(html).toContain('loading="lazy"');
    expect(html.endsWith("|")).toBe(true);
  });

  it("gives a resized copy's address with | image_url", async () => {
    await file("templates/page.liquid", "{{ entry.hero | image_url: 800 }}");
    expect(await render("page", { entry: { hero: photo } })).toBe(
      "http://localhost:4000/media/6f1c/file?w=800&amp;format=webp",
    );
  });

  it("draws a menu as a list of links, escaped, with the current page marked", async () => {
    await file("templates/page.liquid", '{% menu "main" %}|{% menu "footer" %}');
    expect(await render("page")).toBe(
      '<nav class="lintel-menu" aria-label="Main"><ul class="lintel-menu__list">' +
        '<li class="lintel-menu__item"><a class="lintel-menu__link" href="/about" aria-current="page">About &lt;us&gt;</a>' +
        '<ul class="lintel-menu__list"><li class="lintel-menu__item"><a class="lintel-menu__link" href="/team" target="_blank" rel="noopener">Team</a></li></ul>' +
        "</li></ul></nav>|",
    );
  });

  it("draws a form and the page's design with their tags", async () => {
    await file("templates/page.liquid", '{% form "contact" %}{% design %}');
    expect(await render("page")).toBe(
      '<form data-form="contact"></form><div class="lintel-design">designed</div>',
    );
  });

  it("says how to use a tag that is missing its value", async () => {
    await file("templates/page.liquid", "{% menu %}");
    await expect(render("page")).rejects.toThrow(/needs something to show/);
    await file("templates/design.liquid", "{% design 'x' %}");
    await expect(render("design")).rejects.toThrow(/takes nothing/);
  });
});
