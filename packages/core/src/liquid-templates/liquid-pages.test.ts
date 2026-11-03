import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createEmptyPage,
  createNode,
  pageLinkHref,
  standardCatalogue,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pagesWithSimpleSectionsCollection } from "../collections/default-collections.js";
import { ensureCollection } from "../collections/collections.service.js";
import { acceptAnyAsset, type DeliveredAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";
import { readForm, type SiteSources } from "../website/site-sources.js";

const SITE_URL = "http://localhost:3999";

const photo: DeliveredAsset = {
  id: "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f",
  url: "http://localhost:4000/media/6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f/file",
  alt: "Loaves",
  width: 1200,
  height: 800,
  focalPoint: null,
};

const contactForm: SiteSources["forms"] = {
  findForm: async (handle) =>
    handle !== "contact"
      ? null
      : readForm({
          handle,
          name: "Contact us",
          submitLabel: "Send",
          fields: [
            { handle: "email", type: "email", label: "Email address", required: true, options: {} },
          ],
          spamProtection: { honeypotField: "_website", tokenField: "_token", token: "123.abc" },
          confirmation: { type: "message", message: "Thanks." },
        }),
};

describe("pages drawn with Liquid templates", { timeout: 30000 }, () => {
  const testDatabase = useTestDatabase();
  let folder: string;
  let api: FastifyInstance;
  let site: FastifyInstance;
  let admin: SendRequest;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-liquid-site-"));
    api = await startTestServer(testDatabase.activeDatabase, {
      assetExists: acceptAnyAsset,
      assetLookup: {
        findAssetsByIds: async (ids) => new Map(ids.includes(photo.id) ? [[photo.id, photo]] : []),
      },
      website: { builtInSiteUrl: SITE_URL, liquidTemplates: { folder } },
    });
    site = buildSiteServer({
      api,
      sources: {
        forms: contactForm,
        shop: {
          listProducts: async () => ({ products: [], total: 0 }),
          findProduct: async () => null,
          listCollections: async () => [],
          findCollection: async () => null,
        },
      },
    });
    await site.ready();
    await ensureCollection(testDatabase.database, pagesWithSimpleSectionsCollection);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    admin = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    await admin("PATCH", "/globals/site_settings/values", { data: { site_name: "Corner Bakery" } });
    await publish({ title: "Home" }, "home");
  });

  afterEach(async () => {
    await site.close();
    await api.close();
    await rm(folder, { recursive: true, force: true });
  });

  async function file(path: string, content: string) {
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), content);
    // As the development watcher would; tests don't wait for it.
    api.website.liquidTemplates?.changed();
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  function visit(url: string) {
    return site.inject({ method: "GET", url });
  }

  async function publish(data: Record<string, unknown>, slug?: string) {
    const created = await admin("POST", "/collections/pages/entries", {
      data,
      ...(slug ? { slug } : {}),
    });
    expect(created.statusCode, created.body).toBe(201);
    const published = await admin("POST", `/entries/${created.json().id}/publish`);
    expect(published.statusCode, published.body).toBe(200);
    return created.json().id as string;
  }

  it("draws pages with the built-in template while there is no template for them", async () => {
    await publish({ title: "About" }, "about");
    const page = await visit("/about");
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("lintel-page-header__title");
    expect((await admin("GET", "/website/liquid-templates")).json()).toEqual({ templates: [] });
  });

  it("draws a collection's pages with its template, inside the shared document", async () => {
    await file(
      "templates/pages.liquid",
      "<article><h1>{{ entry.title }}</h1>{{ entry.data.body | rich_text }}" +
        "<p>{{ site.name }} in {{ site.language }}</p>{% menu 'main' %}</article>",
    );
    await publish(
      {
        title: "Bread & <butter>",
        summary: "All about bread",
        body: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh daily" }] }],
        },
      },
      "bread",
    );

    const page = await visit("/bread");

    expect(page.statusCode).toBe(200);
    expect(page.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
    expect(page.body).toMatch(/^<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/);
    expect(page.body).toContain("<title>Bread &amp; &lt;butter&gt; | Corner Bakery</title>");
    expect(page.body).toContain('<meta name="description" content="All about bread"/>');
    expect(page.body).toMatch(/<link rel="stylesheet" href="\/_lintel\/site-[0-9a-f]+\.css"\/>/);
    expect(page.body).toContain("<h1>Bread &amp; &lt;butter&gt;</h1><p>Fresh daily</p>");
    expect(page.body).toContain("<p>Corner Bakery in en-GB</p>");
    expect(page.body).toContain('class="lintel-skip-link"');
    expect(page.body).toContain('<main id="main-content" class="lintel-main lintel-liquid"');
    expect(page.body).toContain('class="lintel-footer"');
    expect(page.body).not.toContain("lintel-page-header__title");
    // The cache keeps the page until a template changes.
    expect((await visit("/bread")).body).toBe(page.body);
    await file("templates/pages.liquid", "<p>Changed</p>");
    expect((await visit("/bread")).body).toContain("<p>Changed</p>");
  });

  it("gives templates the page's address for links to pages, and draws pictures in text", async () => {
    await file(
      "templates/pages.liquid",
      "{{ entry.data.body | rich_text }}" +
        "{% for section in entry.data.sections %}<a href='{{ section.data.button.url }}'>" +
        "{{ section.data.button.label }}</a>{% endfor %}",
    );
    const storyId = await publish({ title: "Our story" }, "story");
    const link = { type: "link", attrs: { href: pageLinkHref(storyId) } };
    await publish(
      {
        title: "Linking",
        body: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Our story", marks: [link] }] },
            {
              type: "image",
              attrs: { assetId: photo.id, alt: "Bread", caption: "", align: "right" },
            },
          ],
        },
        sections: [
          {
            id: "hero-1",
            type: "hero",
            data: { heading: "Hi", button: { url: pageLinkHref(storyId), label: "Read it" } },
          },
        ],
      },
      "linking",
    );
    await admin("PATCH", `/entries/${storyId}`, { slug: "about-us" });
    await admin("POST", `/entries/${storyId}/publish`);

    const page = (await visit("/linking")).body;

    expect(page).toContain('href="/about-us">Our story</a>');
    expect(page).toContain("<a href='/about-us'>Read it</a>");
    expect(page).toMatch(
      /<figure class="lintel-picture lintel-picture--right"><img [^>]*alt="Bread"/,
    );
    expect(page).not.toContain("lintel:page/");
  });

  it("sends a layout's whole document with the page's head in it", async () => {
    await file(
      "layouts/main.liquid",
      '<!DOCTYPE html><html lang="{{ site.language }}"><head>{% lintel_head %}</head>' +
        "<body>{% site_header %}<main>{% block content %}{% endblock %}</main>{% site_footer %}</body></html>",
    );
    await file("partials/byline.liquid", "<p class=byline>{{ site.name }}</p>");
    await file(
      "templates/pages.liquid",
      "{% layout 'main' %}{% block content %}<h1>{{ entry.title }}</h1>{% render 'byline' %}{% endblock %}",
    );
    await publish({ title: "Story" }, "story");

    const page = (await visit("/story")).body;

    expect(page).toMatch(/^<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/);
    expect(page).toContain("<title>Story | Corner Bakery</title>");
    expect(page).toContain("<h1>Story</h1><p class=byline>Corner Bakery</p>");
    expect(page).toContain('class="lintel-header');
    expect(page).not.toContain("lintel-head-");
  });

  it("lets each page choose its template, or the visual designer", async () => {
    await file("templates/pages.liquid", "<p>Collection template</p>");
    await file("templates/landing/big.liquid", "<p>Landing template</p>");
    const design = createEmptyPage();
    design.root.children = [
      createNode(
        { type: "heading", props: { text: "Designed heading", level: 1 } },
        standardCatalogue,
        () => "h1",
      ),
    ];
    await publish({ title: "Plain" }, "plain");
    await publish({ title: "Landing", _template: "landing/big" }, "landing");
    await publish({ title: "Designed", design, _template: "designed" }, "designed");

    expect((await visit("/plain")).body).toContain("<p>Collection template</p>");
    expect((await visit("/landing")).body).toContain("<p>Landing template</p>");
    const designed = (await visit("/designed")).body;
    expect(designed).toMatch(/<h1[^>]*>Designed heading<\/h1>/);
    expect(designed).not.toContain("Collection template");

    expect((await admin("GET", "/website/liquid-templates")).json()).toEqual({
      templates: [
        { name: "landing/big", collectionHandle: null },
        { name: "pages", collectionHandle: "pages" },
      ],
    });
  });

  it("keeps the choice through saving, and clears it when sent empty", async () => {
    await file("templates/landing.liquid", "<p>Landing</p>");
    const id = await publish({ title: "Choice", _template: "landing" }, "choice");
    await admin("PATCH", `/entries/${id}`, { data: { title: "Choice, renamed" } });
    expect((await admin("GET", `/entries/${id}`)).json().data._template).toBe("landing");
    await admin("PATCH", `/entries/${id}`, { data: { _template: null } });
    expect((await admin("GET", `/entries/${id}`)).json().data._template).toBeUndefined();
  });

  it("draws the page's design and a form inside a code template, with their scripts", async () => {
    await file(
      "templates/pages.liquid",
      "<section class=intro>{{ entry.title }}</section>{% design %}{% form 'contact' %}",
    );
    const design = createEmptyPage();
    design.root.children = [
      createNode(
        { type: "heading", props: { text: "From the designer", level: 2 } },
        standardCatalogue,
        () => "h2",
      ),
    ];
    await publish({ title: "Mixed", design }, "mixed");

    const page = (await visit("/mixed")).body;

    expect(page).toContain("<section class=intro>Mixed</section>");
    expect(page).toMatch(/<div class="lintel-design"[^>]*><div[^>]*>.*From the designer/);
    expect(page).toContain("Email address");
    expect(page).toMatch(/<script src="\/_lintel\/elements-[0-9a-f]+\.js" defer=""><\/script>/);
  });

  it("previews a draft through its template, never cached", async () => {
    await file("templates/pages.liquid", "<p>Live: {{ entry.data.summary }}</p>");
    await file("templates/draft.liquid", "<p>Draft: {{ entry.data.summary }}</p>");
    const id = await publish({ title: "Prices", summary: "Old prices" }, "prices");
    await admin("PATCH", `/entries/${id}`, {
      data: { summary: "New prices", _template: "draft" },
    });

    const preview = await admin("POST", `/entries/${id}/preview`);
    const draft = await visit(String(preview.json().previewUrl).slice(SITE_URL.length));

    expect(draft.statusCode).toBe(200);
    expect(draft.body).toContain("<p>Draft: New prices</p>");
    expect(draft.body).toContain('<meta name="robots" content="noindex"/>');
    expect(draft.headers["cache-control"]).toBe("private, no-store");
    expect((await visit("/prices")).body).toContain("<p>Live: Old prices</p>");
  });

  it("fails like any page in production when a template is broken", async () => {
    await file("templates/pages.liquid", "{{ entry.title | shout }}");
    await publish({ title: "Broken" }, "broken");
    const page = await visit("/broken");
    expect(page.statusCode).toBe(500);
    expect(page.body).toContain("Something went wrong");
    expect(page.body).not.toContain("shout");
  });
});
