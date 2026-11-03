import { describe, expect, it } from "vitest";
import { englishLabels } from "../site.types.js";
import { cleanTemplate } from "../templates/clean-template.js";
import type { PageDesign } from "../templates/view.types.js";
import { chrome } from "../testing.js";
import { renderDocumentParts } from "./render-document-parts.js";
import { renderSiteDocument } from "./render-site-document.js";
import { mergePageDesigns } from "./site-sections.js";

const navigationDesign: PageDesign = {
  html: '<header class="site-navigation"><nav aria-label="Main"></nav></header>',
  css: ".site-navigation { padding: 1rem; }",
  animations: [],
  usesBehaviours: true,
};
const footerDesign: PageDesign = {
  html: '<footer class="site-footer">Small print</footer>',
  css: ".site-footer { padding: 2rem; }",
  animations: [],
};
const withSections = { ...chrome, navigationDesign, footerDesign };

const head = {
  title: "Home",
  description: "",
  canonicalUrl: null,
  image: null,
  noindex: false,
  type: "website" as const,
  siteName: "Corner Bakery",
  publishedAt: null,
  alternates: [],
};

const documentProps = {
  head,
  template: cleanTemplate,
  labels: englishLabels,
  stylesheetUrl: "/_lintel/site.css",
  year: 2026,
  elementsScriptUrl: "/_lintel/elements.js",
};

describe("the site's own navigation and footer", () => {
  it("take the automatic header's and footer's places, outside main, with their styles", () => {
    const html = renderSiteDocument({
      ...documentProps,
      chrome: withSections,
      view: { kind: "message", title: "Hello", text: "" },
    });
    expect(html).not.toContain('class="lintel-header');
    expect(html).not.toContain('class="lintel-footer"');
    expect(html).toMatch(
      /lintel-skip-link.*<div class="lintel-design lintel-site-section"[^>]*><header class="site-navigation">.*<main/s,
    );
    expect(html).toMatch(/<\/main><div class="lintel-design lintel-site-section"[^>]*><footer/);
    expect(html).toContain(".site-navigation { padding: 1rem; }");
    expect(html).toContain('<script src="/_lintel/elements.js" defer=""></script>');
  });

  it("are left off a page that hides them or brings its own", () => {
    const design: PageDesign = {
      html: "<p>Page</p>",
      css: ".page {}",
      animations: [],
      ownHeader: true,
      ownFooter: false,
    };
    const parts = renderDocumentParts({ ...documentProps, chrome: withSections, design });
    expect(parts.header).toBe("");
    expect(parts.footer).toContain("site-footer");
    expect(parts.head).not.toContain(".site-navigation");
    expect(parts.head).toContain(".site-footer");
  });

  it("merge with the page's design for the head, once each", () => {
    const merged = mergePageDesigns([navigationDesign, null, navigationDesign, footerDesign]);
    expect(merged?.css.match(/site-navigation/g)).toHaveLength(1);
    expect(merged?.usesBehaviours).toBe(true);
  });
});
