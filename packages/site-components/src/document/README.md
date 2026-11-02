# Document

A whole page: `SiteDocument` (html, head, header, main, footer), the head tags for search
engines and social sites, and the server-only helpers that render to HTML
(`render-html.ts`) and gather the stylesheet (`site-stylesheet.ts`).

A designed page with its own Header or Footer (`PageDesign.ownHeader` / `ownFooter`, worked
out by `ownSiteChrome` in `@lintel/builder-model`) is drawn without the site's own, so a page
never shows two. The builder's canvas hides the site's in the same way.
