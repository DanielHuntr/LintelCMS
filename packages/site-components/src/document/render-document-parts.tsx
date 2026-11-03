import { Footer } from "../chrome/Footer.js";
import { Header } from "../chrome/Header.js";
import { MAIN_CONTENT_ID, SkipLink } from "../chrome/SkipLink.js";
import { ResponsiveImage, type ResponsiveImageProps } from "../media/ResponsiveImage.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import type { SiteTemplate } from "../templates/site-template.js";
import type { PageDesign, SiteEffectsHead } from "../templates/view.types.js";
import { DesignHead } from "./DesignHead.js";
import { EffectsHead } from "./EffectsHead.js";
import { HeadTags } from "./HeadTags.js";
import type { PageHead } from "./page-head.types.js";
import { renderComponentHtml } from "./render-html.js";

/** What a page drawn by something other than a template needs to look like the site. */
export interface DocumentPartsProps {
  head: PageHead;
  chrome: SiteChrome;
  template: SiteTemplate;
  labels: SiteLabels;
  stylesheetUrl: string;
  year: number;
  /** The design (or designs, merged) the page shows, for their styles and scripts. */
  design: PageDesign | null;
  motionScriptUrl?: string;
  elementsScriptUrl?: string;
  siteEffects?: SiteEffectsHead;
  effectModuleUrls?: Readonly<Record<string, string>>;
}

/** The same parts `SiteDocument` puts together, each as finished HTML. */
export interface DocumentParts {
  language: string;
  /** Everything inside `<head>`: SEO tags, the stylesheet, a design's styles and scripts. */
  head: string;
  bodyClassName: string;
  /** What the site's effects put first in `<body>` (an intro), or "". */
  bodyStart: string;
  skipLink: string;
  header: string;
  footer: string;
  /** The id `<main>` needs, for the skip link. */
  mainId: string;
}

/**
 * The shared document in parts, for pages whose middle is written some other way (Liquid
 * templates in core): they keep the same `<head>`, skip link, header and footer.
 */
export function renderDocumentParts(props: DocumentPartsProps): DocumentParts {
  const { head, chrome, template, labels, design } = props;
  return {
    language: chrome.locale,
    head: renderComponentHtml(
      <>
        <HeadTags head={head} locale={chrome.locale} stylesheetUrl={props.stylesheetUrl} />
        {design && (
          <DesignHead
            design={design}
            motionScriptUrl={props.motionScriptUrl}
            elementsScriptUrl={props.elementsScriptUrl}
          />
        )}
        <EffectsHead
          design={design}
          siteEffects={props.siteEffects}
          effectModuleUrls={props.effectModuleUrls ?? {}}
          motionScriptUrl={props.motionScriptUrl}
        />
      </>,
    ),
    bodyClassName: `lintel-site lintel-template-${template.id}`,
    bodyStart: props.siteEffects?.bodyStartHtml
      ? `<div>${props.siteEffects.bodyStartHtml}</div>`
      : "",
    skipLink: renderComponentHtml(<SkipLink label={labels.skipToContent} />),
    header: design?.ownHeader
      ? ""
      : renderComponentHtml(
          <Header chrome={chrome} labels={labels} layout={template.headerLayout} />,
        ),
    footer: design?.ownFooter
      ? ""
      : renderComponentHtml(<Footer chrome={chrome} labels={labels} year={props.year} />),
    mainId: MAIN_CONTENT_ID,
  };
}

/** A picture in several sizes, cropped around its focal point, as `ResponsiveImage` draws it. */
export function renderResponsiveImageHtml(props: ResponsiveImageProps): string {
  return renderComponentHtml(<ResponsiveImage {...props} />);
}
