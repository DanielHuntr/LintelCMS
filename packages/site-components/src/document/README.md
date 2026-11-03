# Document

A whole page: `SiteDocument` (html, head, header, main, footer), the head tags for search
engines and social sites, and the server-only helpers that render to HTML
(`render-html.ts`) and gather the stylesheet (`site-stylesheet.ts`).

A designed page with its own Header or Footer (`PageDesign.ownHeader` / `ownFooter`, worked
out by `ownSiteChrome` in `@lintel/builder-model`) is drawn without the site's own, so a page
never shows two. The builder's canvas hides the site's in the same way.

A site can have its own navigation and footer, made in the builder (`SiteChrome.navigationDesign`
and `footerDesign`, drawn by core for each page). `site-sections.tsx` puts them where the
automatic header and footer would go, outside `<main>` and in `.lintel-design`, and their
styles and scripts join the page's in the head. A page that hides them, or brings its own,
gets neither.

`renderDocumentParts` gives the same document in parts (head, skip link, header, footer),
each as finished HTML, for pages whose middle is written some other way: core's Liquid
templates put them around their own HTML, so they keep the same SEO tags, stylesheet and
chrome. `renderResponsiveImageHtml` is `ResponsiveImage` as HTML, for their `{% image %}` tag.
