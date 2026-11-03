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
import { withPageLinkAddresses } from "./page-link-addresses.js";
import { loadPageData } from "./page-data.service.js";
import { removePathPrefix } from "../sites/site-addresses.js";
import { localiseUrl, markCurrent } from "./site-chrome.service.js";
import type { SiteContext } from "./site-context.service.js";
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
  const stored = await dependencies.cache.shareValue("site-sections", () =>
    readSiteSections(dependencies.database, dependencies.site),
  );
  if (!stored.navigation && !stored.footer) return chrome;
  // "Choose a page" links become the pages' addresses before they are put on this site.
  const sections = await dependencies.cache.shareValue(`site-sections:${request.locale}`, () =>
    withPageLinkAddresses(dependencies.database, stored, request.locale),
  );
  // Links typed into them ("/work") lead to this site's pages: with its path prefix and language.
  const localise = (url: string) =>
    isPageAddress(url, request.context) ? localiseUrl(url, request.locale, request.context) : url;
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

/**
 * Whether a typed address is one of the site's pages, so it should get the site's language:
 * not Lintel's own files ("/_lintel/…"), not a file ("/menu.pdf"), and not an address that
 * already names a language ("/fr/about", or "/shop/fr/about" under the site's prefix).
 */
export function isPageAddress(
  url: string,
  site: Pick<SiteContext, "defaultLocale" | "locales" | "pathPrefix">,
): boolean {
  const path = (url.split(/[?#]/)[0] ?? "").toLowerCase();
  const onSite = removePathPrefix(site.pathPrefix, path);
  if (onSite === "/_lintel" || onSite.startsWith("/_lintel/")) return false;
  const lastSegment = onSite.split("/").pop() ?? "";
  if (/\.[a-z0-9]{1,8}$/.test(lastSegment)) return false;
  const firstSegment = onSite.split("/")[1] ?? "";
  return !site.locales.some(
    (locale) => locale.code !== site.defaultLocale && locale.code.toLowerCase() === firstSegment,
  );
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
