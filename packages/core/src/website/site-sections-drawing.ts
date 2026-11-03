import {
  findNode,
  type PageNode,
  siteSectionNodeIds,
  siteSectionsPage,
} from "@lintel/builder-model";
import { renderPage, standardRegistry } from "@lintel/builder/render";
import type { PageDesign, SiteChrome } from "@lintel/site-components";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { readSiteSections } from "../site-sections/site-sections.service.js";
import { checkPageDesign } from "./designed-pages.js";
import { loadPageData } from "./page-data.service.js";
import { localiseUrl, markCurrent } from "./site-chrome.service.js";
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
  // Links typed into them ("/work") lead to this site's pages: with its path prefix and language.
  const localise = (url: string) => localiseUrl(url, request.locale, request.context);
  const onThisSite = {
    navigation: sections.navigation && withSiteAddresses(sections.navigation, localise),
    footer: sections.footer && withSiteAddresses(sections.footer, localise),
  };
  const document = checkPageDesign(
    siteSectionsPage(onThisSite, pageComponentCatalogue),
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

/** Every address an element links to (`href`, `featuredHref`, links in lists) that is on the site. */
export function withSiteAddresses(node: PageNode, localise: (url: string) => string): PageNode {
  const visit = (value: unknown, key: string): unknown => {
    if (typeof value === "string") {
      return /href$/i.test(key) && value.startsWith("/") && !value.startsWith("//")
        ? localise(value)
        : value;
    }
    if (Array.isArray(value)) return value.map((item) => visit(item, key));
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([name, inner]) => [name, visit(inner, name)]),
      );
    }
    return value;
  };
  return {
    ...node,
    props: visit(node.props, "") as Record<string, unknown>,
    children: node.children.map((child) => withSiteAddresses(child, localise)),
  };
}
