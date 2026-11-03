# Document

A whole page: `SiteDocument` (html, head, header, main, footer), the head tags for search
engines and social sites, and the server-only helpers that render to HTML
(`render-html.ts`) and gather the stylesheet (`site-stylesheet.ts`).

A designed page with its own Header or Footer (`PageDesign.ownHeader` / `ownFooter`, worked
out by `ownSiteChrome` in `@lintel/builder-model`) is drawn without the site's own, so a page
never shows two. The builder's canvas hides the site's in the same way.

`renderDocumentParts` gives the same document in parts (head, skip link, header, footer),
each as finished HTML, for pages whose middle is written some other way: core's Liquid
templates put them around their own HTML, so they keep the same SEO tags, stylesheet and
chrome. `renderResponsiveImageHtml` is `ResponsiveImage` as HTML, for their `{% image %}` tag.
