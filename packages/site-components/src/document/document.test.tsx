import { describe, expect, it } from "vitest";
import { englishLabels } from "../site.types.js";
import { builtInTemplates, findTemplate } from "../templates/templates.js";
import { journalTemplate } from "../templates/journal-template.js";
import type { SiteView } from "../templates/view.types.js";
import { chrome, photo } from "../testing.js";
import { defaultTheme } from "../theme/theme.js";
import type { PageHead } from "./page-head.types.js";
import { renderSiteDocument } from "./render-site-document.js";
import { siteStylesheet } from "./site-stylesheet.js";

const head: PageHead = {
  title: "About us | Corner Bakery",
  description: "Three generations of baking.",
  canonicalUrl: "https://cornerbakery.example/about",
  image: { url: photo.url, alt: photo.alt, width: 1200, height: 630 },
  noindex: false,
  type: "website",
  siteName: "Corner Bakery",
  publishedAt: null,
  alternates: [{ locale: "fr", url: "https://cornerbakery.example/fr/about" }],
};

function render(view: SiteView, template = builtInTemplates[0]) {
  return renderSiteDocument({
    head,
    chrome,
    view,
    template: template ?? journalTemplate,
    labels: englishLabels,
    stylesheetUrl: "/_lintel/site-abc.css",
    year: 2026,
  });
}

describe("a whole page", () => {
  const page: SiteView = {
    kind: "page",
    title: "About us",
    summary: "Who we are.",
    heroImage: null,
    body: "<p>We bake.</p>",
    sections: [],
  };

  it("is plain HTML with the head search engines and social sites read, and no script", () => {
    const output = render(page);
    expect(
      output.startsWith('<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/>'),
    ).toBe(true);
    expect(output).toContain("<title>About us | Corner Bakery</title>");
    expect(output).toContain('<link rel="canonical" href="https://cornerbakery.example/about"/>');
    expect(output).toContain(
      '<link rel="alternate" hreflang="fr" href="https://cornerbakery.example/fr/about"/>',
    );
    expect(output).toContain('<meta property="og:image:alt" content="Loaves cooling on a rack"/>');
    expect(output).toContain('<meta property="og:locale" content="en_GB"/>');
    expect(output).toContain('<link rel="stylesheet" href="/_lintel/site-abc.css"/>');
    expect(output).not.toContain("<script");
    expect(output).not.toContain("noindex");
  });

  it("starts with a skip link to the main content and has one h1", () => {
    const output = render(page);
    expect(output).toContain(
      '<body class="lintel-site lintel-template-clean"><a class="lintel-skip-link" href="#main-content">Skip to content</a>',
    );
    expect(output).toContain('<main id="main-content" class="lintel-main" tabindex="-1">');
    expect(output.match(/<h1/g)).toHaveLength(1);
  });

  it("is the same every time for the same props", () => {
    expect(render(page)).toBe(render(page));
  });
});

describe("the built-in templates", () => {
  const list: SiteView = {
    kind: "postList",
    title: "Blog",
    description: "",
    posts: [
      {
        id: "p1",
        title: "Sourdough tips",
        url: "/blog/sourdough",
        excerpt: "Start the night before.",
        publishedAt: "2026-03-12T09:00:00.000Z",
        image: photo,
      },
    ],
    pagination: { page: 1, totalPages: 2, previousUrl: null, nextUrl: "/blog/page/2" },
  };

  it("show posts as cards in Clean and as a reading list in Journal", () => {
    expect(render(list, findTemplate("clean"))).toContain("lintel-post-card--card");
    const journal = render(list, findTemplate("journal"));
    expect(journal).toContain("lintel-post-card--row");
    expect(journal).toContain("lintel-header--masthead");
    expect(journal).toContain(
      '<time class="lintel-date" datetime="2026-03-12T09:00:00.000Z">12 March 2026</time>',
    );
    expect(journal).toContain(
      '<a class="lintel-pagination__link" href="/blog/page/2" rel="next">Older posts</a>',
    );
  });

  it("show a friendly page when nothing matches the address", () => {
    const output = render({ kind: "notFound" });
    expect(output).toContain("We couldn’t find that page");
    expect(output).toContain('href="/">Go to the home page</a>');
  });

  it("fall back to the first template for an unknown id", () => {
    expect(findTemplate("missing").id).toBe("clean");
  });
});

describe("the stylesheet", () => {
  it("has the theme's tokens first, then every component's styles", () => {
    const css = siteStylesheet(defaultTheme, journalTemplate);
    expect(css.indexOf("--lintel-color-brand")).toBeLessThan(css.indexOf(".lintel-hero {"));
    expect(css).toContain(".lintel-template-journal");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
  });
});

describe("the HTML", () => {
  it("uses lower-case attribute names and no inline styles, for people editing it", () => {
    const output = render({
      kind: "post",
      title: "Sourdough tips",
      excerpt: "",
      publishedAt: "2026-03-12T09:00:00.000Z",
      image: photo,
      body: "<p>Start early.</p>",
      categories: [{ title: "Bread", url: "/blog/categories/bread" }],
      tags: [],
      backLink: { label: "Blog", url: "/blog" },
    });
    expect(output).not.toMatch(/ (srcSet|dateTime|fetchPriority|charSet|hrefLang)=/);
    expect(output).toContain('<time class="lintel-date" datetime="2026-03-12T09:00:00.000Z">');
    expect(output).not.toContain("style=");
    expect(output).toContain('<article class="lintel-post" data-lintel-component="post">');
  });
});
