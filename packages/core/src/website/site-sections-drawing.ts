import { findNode, siteSectionNodeIds, siteSectionsPage } from "@lintel/builder-model";
import { renderPage, standardRegistry } from "@lintel/builder/render";
import type { PageDesign, SiteChrome } from "@lintel/site-components";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { readSiteSections } from "../site-sections/site-sections.service.js";
import { checkPageDesign } from "./designed-pages.js";
import { loadPageData } from "./page-data.service.js";
import { markCurrent } from "./site-chrome.service.js";
import type { PageRequest } from "./site-pages.service.js";

/**
 * The site's own navigation and footer (see src/site-sections), drawn for one page: with
 * the builder's renderer, the menu's current page marked, and their layer names starting
 * with "Site" so their class names never meet the page's own. The page's document puts them
 * where the automatic header and footer would go. A site without them keeps the automatic ones.
 */
export async function withSiteSections(
  request: PageRequest,
  chrome: SiteChrome,
): Promise<SiteChrome> {
  const { dependencies } = request;
  const sections = await dependencies.cache.shareValue("site-sections", () =>
    readSiteSections(dependencies.database, dependencies.site),
  );
  if (!sections.navigation && !sections.footer) return chrome;
  const document = checkPageDesign(
    siteSectionsPage(sections, pageComponentCatalogue),
    request.context.scriptRule,
  );
  if (!document) return chrome;
  const marked: PageRequest = {
    ...request,
    chrome: { ...request.chrome, menu: markCurrent(request.chrome.menu, request.path) },
  };
  const data = await loadPageData(marked, document);
  const draw = (nodeId: string): PageDesign | undefined => {
    if (!findNode(document.root, nodeId)) return undefined;
    const drawn = renderPage(document, standardRegistry, { withMotion: true, data, nodeId });
    return {
      html: drawn.html,
      css: drawn.css,
      animations: drawn.animations,
      effects: drawn.effects,
      usesMotionApi: drawn.usesMotionApi,
      script: drawn.script,
      usesBehaviours: drawn.usesBehaviours,
    };
  };
  return {
    ...chrome,
    navigationDesign: draw(siteSectionNodeIds.navigation),
    footerDesign: draw(siteSectionNodeIds.footer),
  };
}
