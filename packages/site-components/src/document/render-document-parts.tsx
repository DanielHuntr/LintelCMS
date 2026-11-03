import { Footer } from "../chrome/Footer.js";
import { Header } from "../chrome/Header.js";
import { MAIN_CONTENT_ID, SkipLink } from "../chrome/SkipLink.js";
import { FigureCaption } from "../media/PhotoCredit.js";
import { ResponsiveImage, type ResponsiveImageProps } from "../media/ResponsiveImage.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import type { SiteTemplate } from "../templates/site-template.js";
import type { PageDesign, SiteEffectsHead } from "../templates/view.types.js";
import { type CookieNoticeHead, CookieNoticeTags } from "./CookieNoticeHead.js";
import { DesignHead } from "./DesignHead.js";
import { EffectsHead } from "./EffectsHead.js";
import { HeadTags } from "./HeadTags.js";
import type { PageHead } from "./page-head.types.js";
import { renderComponentHtml } from "./render-html.js";
import { chromeSlots, headDesign, SiteSection } from "./site-sections.js";

/** What a page drawn by something other than a template needs to look like the site. */
export interface DocumentPartsProps {
  head: PageHead;
  chrome: SiteChrome;
  template: SiteTemplate;
  labels: SiteLabels;
  stylesheetUrl: string;
  /** Font services' stylesheets (an Adobe Fonts project's), linked before the site's own. */
  fontStylesheetUrls?: readonly string[];
  year: number;
  /** The design (or designs, merged) the page shows, for their styles and scripts. */
  design: PageDesign | null;
  motionScriptUrl?: string;
  elementsScriptUrl?: string;
  siteEffects?: SiteEffectsHead;
  effectModuleUrls?: Readonly<Record<string, string>>;
  /** The cookie notice, on sites that ask visitors about cookies. */
  cookieNotice?: CookieNoticeHead;
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
  const { head, chrome, template, labels } = props;
  const slots = chromeSlots(chrome, props.design);
  const design = headDesign(props.design, slots);
  return {
    language: chrome.locale,
    head: renderComponentHtml(
      <>
        <HeadTags
          head={head}
          locale={chrome.locale}
          stylesheetUrl={props.stylesheetUrl}
          fontStylesheetUrls={props.fontStylesheetUrls}
        />
        <CookieNoticeTags notice={props.cookieNotice} />
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
    header:
      slots.header === "automatic"
        ? renderComponentHtml(
            <Header chrome={chrome} labels={labels} layout={template.headerLayout} />,
          )
        : slots.header
          ? renderComponentHtml(<SiteSection design={slots.header} />)
          : "",
    footer:
      slots.footer === "automatic"
        ? renderComponentHtml(<Footer chrome={chrome} labels={labels} year={props.year} />)
        : slots.footer
          ? renderComponentHtml(<SiteSection design={slots.footer} />)
          : "",
    mainId: MAIN_CONTENT_ID,
  };
}

/** A picture in several sizes, cropped around its focal point, as `ResponsiveImage` draws it. */
export function renderResponsiveImageHtml(props: ResponsiveImageProps): string {
  return renderComponentHtml(<ResponsiveImage {...props} />);
}

/**
 * A picture with its photo credit underneath, as a `<figure>` with
 * `<figcaption class="lintel-credit">`; just the picture when there is no credit.
 */
export function renderCreditedImageHtml(props: ResponsiveImageProps): string {
  const { credit } = props.image;
  if (!credit) return renderResponsiveImageHtml(props);
  return renderComponentHtml(
    <figure className="lintel-credited-image">
      <ResponsiveImage {...props} />
      <FigureCaption caption={null} credit={credit} />
    </figure>,
  );
}
