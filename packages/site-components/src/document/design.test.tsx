import { describe, expect, it } from "vitest";
import { englishLabels } from "../site.types.js";
import { cleanTemplate } from "../templates/clean-template.js";
import type { PageDesign, SiteView } from "../templates/view.types.js";
import { chrome } from "../testing.js";
import { renderSiteChrome } from "./render-site-chrome.js";
import { renderSiteDocument } from "./render-site-document.js";

function pageWith(design: PageDesign): SiteView {
  return {
    kind: "page",
    title: "Home",
    summary: "",
    heroImage: null,
    body: "",
    sections: [],
    design,
  };
}

function render(view: SiteView, motionScriptUrl?: string) {
  return renderSiteDocument({
    head: {
      title: "Home",
      description: "",
      canonicalUrl: null,
      image: null,
      noindex: false,
      type: "website",
      siteName: "Corner Bakery",
      publishedAt: null,
      alternates: [],
    },
    chrome,
    view,
    template: cleanTemplate,
    labels: englishLabels,
    stylesheetUrl: "/_lintel/site-abc.css",
    year: 2026,
    motionScriptUrl,
  });
}

describe("a page designed in the builder", () => {
  const still: PageDesign = {
    html: '<div class="page"><h1 class="title">Fresh bread</h1></div>',
    css: ".title { color: red; }",
    animations: [],
  };

  it("shows the design inside .lintel-design, with its own stylesheet and no script", () => {
    const page = render(pageWith(still), "/_lintel/motion-abc.js");
    expect(page).toContain(
      '<div class="lintel-design" data-lintel-component="page_design"><div class="page"><h1 class="title">Fresh bread</h1></div></div>',
    );
    expect(page).toContain("<style>.title { color: red; }</style>");
    expect(page).not.toContain("<script");
    expect(page).not.toContain("lintel-page-header");
  });

  it("keeps a stylesheet saved before its code was checked inside its style element", () => {
    const page = render(pageWith({ ...still, css: ".x{}</style><script>alert(1)</script>" }));

    expect(page).toContain("<style>.x{}<\\/style><script>alert(1)</script></style>");
    expect(page).not.toContain(".x{}</style>");
  });

  it("loads the motion runtime only when something moves, with the list kept safe", () => {
    const moving: PageDesign = {
      ...still,
      animations: [{ nodeId: "n1", spec: { trigger: { type: "event", name: "</script><b>" } } }],
    };
    const page = render(pageWith(moving), "/_lintel/motion-abc.js");
    expect(page).toContain('<script src="/_lintel/motion-abc.js" defer="">');
    expect(page).toContain('<script type="application/json" id="lintel-motion">[{"nodeId":"n1"');
    expect(page).toContain("\\u003c/script>\\u003cb>");
    expect(page).not.toContain("</script><b>");
    expect(page).toContain("[data-motion-cloak]");
  });

  it("draws the header and footer on their own, for the builder's canvas", () => {
    const surroundings = renderSiteChrome({
      chrome,
      template: cleanTemplate,
      labels: englishLabels,
      year: 2026,
    });
    expect(surroundings.bodyClassName).toBe("lintel-site lintel-template-clean");
    expect(surroundings.headerHtml).toContain("Corner Bakery");
    expect(surroundings.footerHtml).toContain("Fresh bread every morning.");
  });
});
