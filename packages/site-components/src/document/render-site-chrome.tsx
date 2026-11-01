import { Footer } from "../chrome/Footer.js";
import { Header } from "../chrome/Header.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import type { SiteTemplate } from "../templates/site-template.js";
import { renderComponentHtml } from "./render-html.js";

export interface RenderedSiteChrome {
  /** The `<body>` class every page has, which carries the template. */
  bodyClassName: string;
  headerHtml: string;
  footerHtml: string;
}

/**
 * The parts of a page that surround its content, as HTML: what the page builder's canvas
 * draws around the page being designed, so it looks exactly like the website.
 */
export function renderSiteChrome(props: {
  chrome: SiteChrome;
  template: SiteTemplate;
  labels: SiteLabels;
  year: number;
}): RenderedSiteChrome {
  const { chrome, template, labels, year } = props;
  return {
    bodyClassName: `lintel-site lintel-template-${template.id}`,
    headerHtml: renderComponentHtml(
      <Header chrome={chrome} labels={labels} layout={template.headerLayout} />,
    ),
    footerHtml: renderComponentHtml(<Footer chrome={chrome} labels={labels} year={year} />),
  };
}
