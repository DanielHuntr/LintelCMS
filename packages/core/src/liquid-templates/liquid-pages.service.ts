import { randomUUID } from "node:crypto";
import { createEmptyPage, type PageDocument } from "@lintel/builder-model";
import {
  englishLabels,
  type MenuItem,
  type PageDesign,
  type PageView,
  type PostView,
  type SiteChrome,
} from "@lintel/site-components";
import { type DocumentParts, renderDocumentParts } from "@lintel/site-components/server";
import type { DeliveredEntryWithTranslations } from "../delivery/delivery.schema.js";
import { deliverAllGlobalSets } from "../globals/globals-delivery.service.js";
import { listNavigations } from "../navigation/navigation.service.js";
import { checkPageDesign, drawPageDesign } from "../website/designed-pages.js";
import { loadPageData } from "../website/page-data.service.js";
import type { SiteResponse } from "../website/rendered-pages-cache.js";
import {
  readEffectModules,
  readElementsScript,
  readMotionRuntime,
} from "../website/site-assets.js";
import { loadOtherMenu, localiseUrl, markCurrent } from "../website/site-chrome.service.js";
import { htmlResponse, pageChrome } from "../website/site-documents.js";
import { buildPageHead, type HeadSubject } from "../website/site-head.service.js";
import type { PageRequest } from "../website/site-pages.service.js";
import { createLintelGlobal, type LiquidPageHelpers } from "./liquid-page-helpers.js";
import { escapeHtml } from "./liquid-tags.js";
import type { LiquidTemplates } from "./liquid-templates.service.js";

/**
 * An entry's page drawn with a Liquid template (see README.md). The template draws what goes
 * inside `<main>`, and Lintel puts it in the shared document (head, skip link, header,
 * footer); a template whose output is a whole document (it starts with `<!DOCTYPE` or
 * `<html`) is sent as it is, with `{% lintel_head %}` replaced by the page's `<head>`.
 * Either way the `<head>` is the one every page gets: SEO tags, the stylesheet, and the
 * styles and scripts of any design or form drawn on the page.
 */

export interface LiquidEntryPage {
  templates: LiquidTemplates;
  templateName: string;
  collectionHandle: string;
  entry: DeliveredEntryWithTranslations;
  /** The page or post view, with the entry's design drawn when it has one. */
  view: PageView | PostView;
  subject: HeadSubject;
  translations: ReadonlyMap<string, string>;
  private?: boolean;
}

export async function renderEntryWithLiquid(
  request: PageRequest,
  page: LiquidEntryPage,
): Promise<SiteResponse> {
  const { dependencies, context, locale } = request;
  const head = await buildPageHead(
    dependencies.database,
    context,
    request.chrome.siteName,
    page.subject,
    dependencies.assetLookup,
    dependencies.site,
  );
  const chrome = pageChrome(context, request.chrome, request.path, page.translations);
  const year = (dependencies.now?.() ?? new Date()).getUTCFullYear();
  const partsFor = (design: PageDesign | null): DocumentParts =>
    renderDocumentParts({
      head,
      chrome,
      template: context.look.template,
      labels: englishLabels,
      stylesheetUrl: context.stylesheet.path,
      fontStylesheetUrls: context.fontStylesheetUrls,
      year,
      design,
      motionScriptUrl: readMotionRuntime()?.path,
      elementsScriptUrl: readElementsScript()?.path,
      siteEffects: context.effects,
      effectModuleUrls: readEffectModules()?.urls,
    });

  const drawn: PageDesign[] = [];
  const plainParts = partsFor(null);
  const helpers: LiquidPageHelpers = {
    menu: async (handle) =>
      markCurrent(
        await loadOtherMenu(dependencies.database, handle, context, locale, dependencies.site),
        request.path,
      ),
    form: async (handle, options) => {
      const design = await drawForm(request, handle, options.showTitle);
      if (!design) return "";
      drawn.push(design);
      return designHtml(design);
    },
    design: () => {
      const design = page.view.kind === "page" ? page.view.design : null;
      if (!design) return "";
      drawn.push(design);
      return designHtml(design);
    },
    headMarker: `<!--lintel-head-${randomUUID()}-->`,
    header: plainParts.header,
    footer: plainParts.footer,
  };

  let output: string;
  try {
    output = await page.templates.render(page.templateName, {
      ...(await liquidVariables(request, page, chrome)),
      lintel: createLintelGlobal(helpers),
    });
  } catch (error) {
    if (!page.templates.showsErrors) throw error;
    return htmlResponse(templateErrorPage(page.templateName, error), {
      statusCode: 500,
      private: true,
    });
  }

  const parts = partsFor(mergeDesigns(drawn));
  const body = isWholeDocument(output)
    ? withHead(output, helpers.headMarker, parts.head)
    : sharedDocument(parts, output);
  return htmlResponse(body, { private: page.private });
}

/** What templates can read: `entry`, `site`, `menus`, `globals` and `request`. */
async function liquidVariables(
  request: PageRequest,
  page: LiquidEntryPage,
  chrome: SiteChrome,
): Promise<Record<string, unknown>> {
  const { dependencies, context, locale } = request;
  const { entry, view } = page;
  const [{ globals }, { navigations }] = await Promise.all([
    dependencies.cache.shareValue(`liquid-globals:${locale}`, () =>
      deliverAllGlobalSets(
        dependencies.database,
        locale,
        dependencies.assetLookup,
        dependencies.site,
      ),
    ),
    listNavigations(dependencies.database, dependencies.site),
  ]);
  // Each menu is read only when a template asks for it.
  const menus: Record<string, unknown> = {};
  for (const { handle } of navigations) {
    Object.defineProperty(menus, handle, {
      enumerable: true,
      get: () =>
        loadOtherMenu(dependencies.database, handle, context, locale, dependencies.site).then(
          (items) => markCurrent(items, request.path).map(menuItemVariable),
        ),
    });
  }
  return {
    entry: {
      id: entry.id,
      title: view.title,
      slug: entry.slug,
      url: localiseUrl(entry.url ?? `/${entry.slug}`, locale, context),
      locale: entry.locale,
      collection: page.collectionHandle,
      published_at: entry.publishedAt,
      has_design: view.kind === "page" && Boolean(view.design),
      data: entry.data,
    },
    site: {
      name: chrome.siteName,
      address: context.siteAddress,
      language: locale,
      home_url: chrome.homeUrl,
      logo: context.logo,
      languages: chrome.languages.map((language) => ({
        code: language.code,
        name: language.name,
        url: language.url,
        current: language.current,
      })),
    },
    menus,
    globals,
    request: { path: request.path, page: request.query.page },
  };
}

function menuItemVariable(item: MenuItem): Record<string, unknown> {
  return {
    label: item.label,
    url: item.url,
    new_tab: item.newTab,
    current: item.current,
    children: item.children.map(menuItemVariable),
  };
}

/** A form from Forms, drawn by the builder's Form element so it looks and works the same. */
async function drawForm(
  request: PageRequest,
  handle: string,
  showTitle: boolean,
): Promise<PageDesign | null> {
  const empty = createEmptyPage();
  const document: PageDocument = {
    ...empty,
    root: {
      ...empty.root,
      children: [
        {
          id: "liquid-form",
          type: "formEmbed",
          name: "",
          props: { form: handle, showTitle },
          styles: { base: {} },
          children: [],
          hidden: false,
          locked: false,
        },
      ],
    },
  };
  const checked = checkPageDesign(document, request.context.scriptRule);
  if (!checked) return null;
  return drawPageDesign(checked, await loadPageData(request, checked));
}

function designHtml(design: PageDesign): string {
  return `<div class="lintel-design" data-lintel-component="page_design">${design.html}</div>`;
}

/** The designs drawn on one page, as one for the `<head>`: all their styles and scripts. */
export function mergeDesigns(designs: readonly PageDesign[]): PageDesign | null {
  if (designs.length === 0) return null;
  const unique = <Value>(values: Value[]) => [...new Set(values)];
  return {
    html: "",
    css: unique(designs.map((design) => design.css).filter(Boolean)).join("\n"),
    animations: designs.flatMap((design) => design.animations),
    effects: designs.flatMap((design) => design.effects ?? []),
    fontPreloads: unique(designs.flatMap((design) => design.fontPreloads ?? [])),
    script: unique(designs.map((design) => design.script ?? "").filter(Boolean)).join("\n"),
    usesBehaviours: designs.some((design) => design.usesBehaviours === true),
    usesMotionApi: designs.some((design) => design.usesMotionApi === true),
    ownHeader: designs.some((design) => design.ownHeader === true),
    ownFooter: designs.some((design) => design.ownFooter === true),
  };
}

export function isWholeDocument(output: string): boolean {
  return /^\s*(<!doctype\s|<html[\s>])/i.test(output);
}

/**
 * A whole document from a layout gets the page's `<head>` where `{% lintel_head %}` was, or
 * at the top of its `<head>` when the layout forgot the tag, so SEO and styles still work.
 */
export function withHead(output: string, marker: string, head: string): string {
  if (output.includes(marker)) return output.split(marker).join(head);
  return output.replace(/<head(\s[^>]*)?>/i, (opening) => `${opening}${head}`);
}

function sharedDocument(parts: DocumentParts, main: string): string {
  return (
    `<!DOCTYPE html><html lang="${escapeHtml(parts.language)}"><head>${parts.head}</head>` +
    `<body class="${escapeHtml(parts.bodyClassName)}">${parts.bodyStart}${parts.skipLink}${parts.header}` +
    `<main id="${parts.mainId}" class="lintel-main lintel-liquid" tabindex="-1">${main}</main>` +
    `${parts.footer}</body></html>`
  );
}

/** In development, what went wrong in a template, on the page itself. */
function templateErrorPage(templateName: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Template problem</title></head>' +
    `<body><h1>The template “${escapeHtml(templateName)}” couldn’t be drawn</h1>` +
    `<pre>${escapeHtml(message)}</pre>` +
    "<p>Fix the file and reload: changes are picked up without a restart.</p></body></html>"
  );
}
