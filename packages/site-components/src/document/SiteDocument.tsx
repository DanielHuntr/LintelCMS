import { Footer } from "../chrome/Footer.js";
import { Header } from "../chrome/Header.js";
import { MAIN_CONTENT_ID, SkipLink } from "../chrome/SkipLink.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import type { SiteTemplate } from "../templates/site-template.js";
import type { SiteView } from "../templates/view.types.js";
import type { SiteEffectsHead } from "../templates/view.types.js";
import { DesignHead } from "./DesignHead.js";
import { EffectsHead } from "./EffectsHead.js";
import { HeadTags } from "./HeadTags.js";
import type { PageHead } from "./page-head.types.js";

export interface SiteDocumentProps {
  head: PageHead;
  chrome: SiteChrome;
  view: SiteView;
  template: SiteTemplate;
  labels: SiteLabels;
  /** The address of the site's stylesheet (theme tokens and component styles). */
  stylesheetUrl: string;
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
  year,
  motionScriptUrl,
  elementsScriptUrl,
  siteEffects,
  effectModuleUrls = {},
}: SiteDocumentProps) {
  const design = view.kind === "page" ? view.design : null;
  return (
    <html lang={chrome.locale}>
      <head>
        <HeadTags head={head} locale={chrome.locale} stylesheetUrl={stylesheetUrl} />
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
        <Header chrome={chrome} labels={labels} layout={template.headerLayout} />
        <main id={MAIN_CONTENT_ID} className="lintel-main" tabIndex={-1}>
          {template.renderView({ view, chrome, labels })}
        </main>
        <Footer chrome={chrome} labels={labels} year={year} />
      </body>
    </html>
  );
}
