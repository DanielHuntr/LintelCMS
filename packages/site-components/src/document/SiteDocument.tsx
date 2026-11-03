import { Footer } from "../chrome/Footer.js";
import { Header } from "../chrome/Header.js";
import { MAIN_CONTENT_ID, SkipLink } from "../chrome/SkipLink.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import type { SiteTemplate } from "../templates/site-template.js";
import type { SiteView } from "../templates/view.types.js";
import type { SiteEffectsHead } from "../templates/view.types.js";
import { type CookieNoticeHead, CookieNoticeTags } from "./CookieNoticeHead.js";
import { DesignHead } from "./DesignHead.js";
import { EffectsHead } from "./EffectsHead.js";
import { HeadTags } from "./HeadTags.js";
import { chromeSlots, headDesign, SiteSection } from "./site-sections.js";
import type { PageHead } from "./page-head.types.js";

export interface SiteDocumentProps {
  head: PageHead;
  chrome: SiteChrome;
  view: SiteView;
  template: SiteTemplate;
  labels: SiteLabels;
  /** The address of the site's stylesheet (theme tokens and component styles). */
  stylesheetUrl: string;
  /** Font services' stylesheets (an Adobe Fonts project's), linked before the site's own. */
  fontStylesheetUrls?: readonly string[];
  /** For the footer's copyright line. */
  year: number;
  /**
   * The motion runtime's address. Loaded only by pages with animations, so every other page
   * still ships no script at all.
   */
  motionScriptUrl?: string;
  /** The elements script's address, for designs with sliders, tabs, forms or the shop. */
  elementsScriptUrl?: string;
  /** Page transitions, cursor and intro, when the site has any switched on. */
  siteEffects?: SiteEffectsHead;
  /** Where each effect module is served; only the ones a page uses are listed in it. */
  effectModuleUrls?: Readonly<Record<string, string>>;
  /** The cookie notice, on sites that ask visitors about cookies. */
  cookieNotice?: CookieNoticeHead;
}

/**
 * A whole page: `<html>` with its head, the skip link, header, `<main>` and footer. The
 * template draws what's inside `<main>`. Rendered on the server; it ships no script unless
 * the page has animations.
 */
export function SiteDocument({
  head,
  chrome,
  view,
  template,
  labels,
  stylesheetUrl,
  fontStylesheetUrls,
  year,
  motionScriptUrl,
  elementsScriptUrl,
  siteEffects,
  effectModuleUrls = {},
  cookieNotice,
}: SiteDocumentProps) {
  const pageDesign = view.kind === "page" ? view.design : null;
  const slots = chromeSlots(chrome, pageDesign);
  // The page's design and the site's navigation and footer share the head.
  const design = headDesign(pageDesign, slots);
  return (
    <html lang={chrome.locale}>
      <head>
        <HeadTags
          head={head}
          locale={chrome.locale}
          stylesheetUrl={stylesheetUrl}
          fontStylesheetUrls={fontStylesheetUrls}
        />
        <CookieNoticeTags notice={cookieNotice} />
        {design && (
          <DesignHead
            design={design}
            motionScriptUrl={motionScriptUrl}
            elementsScriptUrl={elementsScriptUrl}
          />
        )}
        <EffectsHead
          design={design ?? null}
          siteEffects={siteEffects}
          effectModuleUrls={effectModuleUrls}
          motionScriptUrl={motionScriptUrl}
        />
      </head>
      <body className={`lintel-site lintel-template-${template.id}`}>
        {siteEffects?.bodyStartHtml && (
          <div dangerouslySetInnerHTML={{ __html: siteEffects.bodyStartHtml }} />
        )}
        <SkipLink label={labels.skipToContent} />
        {slots.header === "automatic" ? (
          <Header chrome={chrome} labels={labels} layout={template.headerLayout} />
        ) : (
          slots.header && <SiteSection design={slots.header} />
        )}
        <main id={MAIN_CONTENT_ID} className="lintel-main" tabIndex={-1}>
          {template.renderView({ view, chrome, labels })}
        </main>
        {slots.footer === "automatic" ? (
          <Footer chrome={chrome} labels={labels} year={year} />
        ) : (
          slots.footer && <SiteSection design={slots.footer} />
        )}
      </body>
    </html>
  );
}
