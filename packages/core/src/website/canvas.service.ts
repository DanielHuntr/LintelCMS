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
  };
}
