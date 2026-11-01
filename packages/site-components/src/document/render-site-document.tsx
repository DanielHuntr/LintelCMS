import { renderComponentHtml } from "./render-html.js";
import { SiteDocument, type SiteDocumentProps } from "./SiteDocument.js";

/** A whole page as finished HTML, ready to send. */
export function renderSiteDocument(props: SiteDocumentProps): string {
  return `<!DOCTYPE html>${renderComponentHtml(<SiteDocument {...props} />)}`;
}
