import type { SiteFontChoice } from "@lintel/builder-model";
import { englishLabels } from "@lintel/site-components";
import { renderSiteChrome } from "@lintel/site-components/server";
import { readMotionRuntime } from "./site-assets.js";
import { readSiteChrome, readSiteContext, type SiteDependencies } from "./site-pages.service.js";

/**
 * What the page builder's canvas draws around a page so it looks exactly like the website:
 * the site's whole stylesheet (the same text the website serves), its body class, header
 * and footer, the address pictures with site paths load from, and the motion runtime for
 * previewing animations.
 */
export interface CanvasSiteResponse {
  stylesheet: string;
  bodyClassName: string;
  headerHtml: string;
  footerHtml: string;
  baseUrl: string | null;
  motionScript: string;
  /** The site's name, logo, social links and footer words, for Header and Footer elements. */
  siteName: string;
  logo: { src: string; alt: string; width: number | null; height: number | null } | null;
  socialLinks: string[];
  footerText: string;
  /** The site's own fonts, for the builder's font list (the included ones it knows already). */
  fonts: SiteFontChoice[];
  /** Font services' stylesheets the canvas links to, as the website does (Adobe Fonts'). */
  fontStylesheets: string[];
}

export async function readCanvasSite(
  dependencies: SiteDependencies,
  now = new Date(),
): Promise<CanvasSiteResponse> {
  const context = await readSiteContext(dependencies);
  const chrome = await readSiteChrome(dependencies, context, context.defaultLocale);
  const surroundings = renderSiteChrome({
    chrome,
    template: context.look.template,
    labels: englishLabels,
    year: now.getUTCFullYear(),
  });
  return {
    stylesheet: context.stylesheet.css,
    ...surroundings,
    // Illustrations and the like are served by the built-in site, wherever the site lives.
    baseUrl: dependencies.builtInSiteUrl ?? context.siteAddress,
    motionScript: readMotionRuntime()?.code ?? "",
    siteName: chrome.siteName,
    logo: chrome.logo
      ? {
          src: chrome.logo.url,
          alt: chrome.logo.alt,
          width: chrome.logo.width,
          height: chrome.logo.height,
        }
      : null,
    socialLinks: chrome.socialLinks,
    footerText: chrome.footerText,
    fonts: context.fonts,
    fontStylesheets: context.fontStylesheetUrls,
  };
}
