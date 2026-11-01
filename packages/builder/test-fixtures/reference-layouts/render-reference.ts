import { type PageDocument, standardCatalogue, validatePageDocument } from "@lintel/builder-model";
import { cleanTemplate, defaultTheme, englishLabels } from "@lintel/site-components";
import { renderSiteDocument, siteStylesheet } from "@lintel/site-components/server";
import { designBaseStylesheet } from "../../src/render/design-stylesheet.js";
import { renderPage } from "../../src/render/render-page.js";
import { standardRegistry } from "../../src/render/stand-in-components.js";
import { agencyBold } from "./agency-bold.js";
import { eyewearMinimal } from "./eyewear-minimal.js";
import { fashionEditorial } from "./fashion-editorial.js";

/** The three layouts, with the reference picture each was rebuilt from. */
export const referenceLayouts = [
  { name: "fashion-editorial", document: fashionEditorial },
  { name: "eyewear-minimal", document: eyewearMinimal },
  { name: "agency-bold", document: agencyBold },
] as const;

export const stylesheetPath = "/_lintel/site.css";

/**
 * A layout as the website serves it: checked as a save would check it, drawn by the
 * builder's renderer exactly as the website's designed pages are (`readPageDesign` in core),
 * and put in the website's own page document with the site's header, footer and stylesheet.
 */
export function renderReferenceWebsite(document: PageDocument): { html: string; css: string } {
  const checked = validatePageDocument(document, standardCatalogue);
  if (!checked.ok) {
    throw new Error(checked.problems.map((problem) => problem.message).join("\n"));
  }
  const design = renderPage(checked.document, standardRegistry, { withMotion: true });
  const html = renderSiteDocument({
    head: {
      title: "Reference layout",
      description: "",
      canonicalUrl: null,
      image: null,
      noindex: true,
      type: "website",
      siteName: "Reference",
      publishedAt: null,
      alternates: [],
    },
    chrome: {
      siteName: "Reference",
      logo: null,
      homeUrl: "/",
      menu: [],
      footerText: "",
      contactEmail: "",
      socialLinks: [],
      languages: [],
      locale: "en-GB",
    },
    view: {
      kind: "page",
      title: "Reference layout",
      summary: "",
      heroImage: null,
      body: "",
      sections: [],
      design,
    },
    template: cleanTemplate,
    labels: englishLabels,
    stylesheetUrl: stylesheetPath,
    year: 2026,
  });
  return { html, css: `${siteStylesheet(defaultTheme, cleanTemplate)}\n\n${designBaseStylesheet}` };
}
