import { Footer } from "../chrome/Footer.js";
import { Header } from "../chrome/Header.js";
import { MAIN_CONTENT_ID, SkipLink } from "../chrome/SkipLink.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import type { SiteTemplate } from "../templates/site-template.js";
import type { SiteView } from "../templates/view.types.js";
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
}

/**
 * A whole page: `<html>` with its head, the skip link, header, `<main>` and footer. The
 * template draws what's inside `<main>`. Rendered on the server; it ships no script.
 */
export function SiteDocument({
  head,
  chrome,
  view,
  template,
  labels,
  stylesheetUrl,
  year,
}: SiteDocumentProps) {
  return (
    <html lang={chrome.locale}>
      <head>
        <HeadTags head={head} locale={chrome.locale} stylesheetUrl={stylesheetUrl} />
      </head>
      <body className={`lintel-site lintel-template-${template.id}`}>
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
