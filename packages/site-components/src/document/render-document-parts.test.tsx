import { describe, expect, it } from "vitest";
import { englishLabels } from "../site.types.js";
import { cleanTemplate } from "../templates/clean-template.js";
import { chrome, photo } from "../testing.js";
import type { PageHead } from "./page-head.types.js";
import { renderDocumentParts, renderResponsiveImageHtml } from "./render-document-parts.js";

const head: PageHead = {
  title: "About us | Corner Bakery",
  description: "Three generations of baking.",
  canonicalUrl: "https://cornerbakery.example/about",
  image: null,
  noindex: false,
  type: "website",
  siteName: "Corner Bakery",
  publishedAt: null,
  alternates: [],
};

const props = {
  head,
  chrome,
  template: cleanTemplate,
  labels: englishLabels,
  stylesheetUrl: "/_lintel/site-abc.css",
  year: 2026,
};

describe("the shared document in parts", () => {
  it("gives the same head, skip link, header and footer as a whole page", () => {
    const parts = renderDocumentParts({ ...props, design: null });
    expect(parts.language).toBe("en-GB");
    expect(parts.head).toContain("<title>About us | Corner Bakery</title>");
    expect(parts.head).toContain('<link rel="stylesheet" href="/_lintel/site-abc.css"/>');
    expect(parts.bodyClassName).toBe("lintel-site lintel-template-clean");
    expect(parts.skipLink).toContain('href="#main-content"');
    expect(parts.mainId).toBe("main-content");
    expect(parts.header).toContain('class="lintel-header');
    expect(parts.footer).toContain('class="lintel-footer"');
    expect(parts.head).not.toContain("<script");
  });

  it("adds a design's styles and scripts, and leaves out what it draws itself", () => {
    const parts = renderDocumentParts({
      ...props,
      design: {
        html: "",
        css: ".hero { color: red; }",
        animations: [],
        usesBehaviours: true,
        ownHeader: true,
      },
      elementsScriptUrl: "/_lintel/elements-abc.js",
    });
    expect(parts.head).toContain("<style>.hero { color: red; }</style>");
    expect(parts.head).toContain('<script src="/_lintel/elements-abc.js" defer=""></script>');
    expect(parts.header).toBe("");
    expect(parts.footer).not.toBe("");
  });
});

describe("a responsive picture as HTML", () => {
  it("is the same picture the components draw", () => {
    const html = renderResponsiveImageHtml({ image: photo, aspectRatio: 16 / 9, sizes: "50vw" });
    expect(html).toMatch(/^<img /);
    expect(html).toContain('sizes="50vw"');
    expect(html).toContain("srcset=");
    expect(html).toContain(`alt="${photo.alt}"`);
  });
});
