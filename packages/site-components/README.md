# @lintel/site-components

The React components Lintel's built-in website is made of: one per page block, layout
primitives, the header and footer, lists of posts, the theme system and two templates.
The site server (`packages/core/src/website`) renders them on the server, and the page
builder's canvas will render the same components.

## Rules every component follows

- **Plain props, no data fetching.** Every component takes plain values (`site.types.ts`,
  `blocks/block.types.ts`). The site server turns published content into them; anything
  else (the builder, a test) can make them by hand.
- **Clean, readable HTML.** Semantic elements (`section`, `header`, `nav`, `main`,
  `footer`, `h1`–`h3`, `ul`, `figure`, `img` with `alt`, `a`, `details`), readable class
  names in BEM style (`lintel-hero__heading`), no inline styles and no script.
  `renderComponentHtml` (from `@lintel/site-components/server`) gives static markup with
  lower-case attribute names; the same props always give the same HTML.
- **Class-based CSS with design tokens.** The styles are plain CSS files in `src/styles`.
  They use only the theme's custom properties (`var(--lintel-color-brand)`), so a theme or a
  developer changes a token, not a component. No CSS-in-JS.
- **Accessible.** One `h1` a page, a skip link, labelled landmarks and sections, visible
  focus, `aria-current` on the current menu item, menus and FAQs as native disclosures
  (keyboard and screen reader friendly, no script), links that open a tab say so.
- **Fast, no layout shift.** Pictures carry `width` and `height`, a `srcset` of WebP crops
  made around the focal point by Lintel's media server, and load lazily except the first.
  Fonts are system font stacks, so nothing is downloaded and nothing reflows.
- **Reduced motion.** Transitions are inside `@media (prefers-reduced-motion: no-preference)`.

## Components and their HTML

Each component's root carries `data-lintel-component`, and each editable part
`data-lintel-field` (text, links) or `data-lintel-image` (pictures), named after the
block's field handle. These markers are the mapping the builder's code view and HTML parser
use to get from HTML back to a component and its props.

| Component (props)                                      | HTML                                                                                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Section` (`tone`, `spacing`, `component`)             | `<section class="lintel-section lintel-section--muted" data-lintel-component>`                                                                                       |
| `Container` (`width`)                                  | `<div class="lintel-container lintel-container--narrow">`                                                                                                            |
| `Stack` (`gap`, `centred`)                             | `<div class="lintel-stack lintel-stack--gap-large">`                                                                                                                 |
| `Columns` (`count`)                                    | `<div class="lintel-columns lintel-columns--3">`                                                                                                                     |
| `Hero` (`heading`, `subheading`, `image`, `button`)    | `section.lintel-hero` > `.lintel-hero__content` > `h1/h2.lintel-hero__heading`, `p.lintel-hero__subheading`, `a.lintel-button`; `picture` > `img.lintel-hero__image` |
| `TextSection` (`heading`, `body`)                      | `section.lintel-text-section` > `h2.lintel-text-section__heading`, `div.lintel-prose`                                                                                |
| `ImageSection` (`image`, `caption`)                    | `section.lintel-image-section` > `figure.lintel-figure` > `img.lintel-figure__image`, `figcaption.lintel-figure__caption`                                            |
| `CallToAction` (`heading`, `text`, `button`)           | `section.lintel-call-to-action.lintel-section--muted` > `h2`, `p`, `a.lintel-button`                                                                                 |
| `FaqList` (`questions`)                                | `section.lintel-faq-section` > `div.lintel-faq` > `details.lintel-faq__item[data-lintel-block]` > `summary.lintel-faq__question`, `div.lintel-prose`                 |
| `Button` (`link`, `variant`)                           | `<a class="lintel-button lintel-button--primary" href>`                                                                                                              |
| `RichText` (`html`)                                    | `<div class="lintel-prose">` with the editor's HTML inside; pictures are `figure.lintel-picture.lintel-picture--{full,left,right}`                                   |
| `DataTable` (`rows`, `headerRow`)                      | `table.lintel-table` > `thead` (first row as `th scope="col"`) and `tbody`                                                                                           |
| `VideoEmbed` (`video`, `title`)                        | `div.lintel-video` > `iframe` (YouTube, Vimeo) or `video controls` (a file)                                                                                          |
| `ResponsiveImage` (`image`, `aspectRatio`, `priority`) | `<img srcset sizes width height alt loading>`, in a `<picture>` when phones get another crop                                                                         |
| `Header` (`chrome`, `layout`)                          | `header.lintel-header.lintel-header--bar` > `a.lintel-header__brand`, `nav.lintel-menu-bar` > `ul.lintel-menu`                                                       |
| `MainMenu` (`items`)                                   | `nav[aria-label]` > `ul.lintel-menu` > `li.lintel-menu__item` > `a` or `details.lintel-menu__group` > `summary`, `ul.lintel-menu__submenu`                           |
| `Footer` (`chrome`, `year`)                            | `footer.lintel-footer` > `.lintel-footer__grid` (about, contact, social links, languages `nav`), `p.lintel-footer__copyright`                                        |
| `PostCard` (`post`, `layout`)                          | `article.lintel-post-card.lintel-post-card--card` > `img`, `time.lintel-date`, `h2` > `a.lintel-post-card__link`, `p`                                                |
| `Pagination` (`links`)                                 | `nav.lintel-pagination` > `a[rel=prev]`, `p`, `a[rel=next]`                                                                                                          |
| `TermLinks` (`label`, `terms`)                         | `div.lintel-terms` > `h2`, `ul` > `a.lintel-terms__link`                                                                                                             |
| `SiteDocument` (`head`, `chrome`, `view`, `template`)  | `<html lang>` with the head tags, `body.lintel-site.lintel-template-<id>` > skip link, header, `main#main-content`, footer                                           |

`BlockList` draws a page's blocks in order with the components above, grouping questions
next to each other into one `FaqList`. When the first block is a hero and the page shows no
title of its own, the hero's heading is the page's `h1`.

## Themes and design tokens

A `SiteTheme` is six choices: brand colour, accent colour, font pairing (`font-pairings.ts`,
a short curated list), corner style, spacing scale, and light, dark or automatic.
`themeStylesheet(theme)` turns it into custom properties on `:root`:

| Token                                                   | What it is                                              |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `--lintel-color-background`, `-surface`, `-border`      | Page, soft panels, hairlines                            |
| `--lintel-color-text`, `-text-secondary`                | Text                                                    |
| `--lintel-color-brand`, `-on-brand`                     | Buttons, and readable text on them                      |
| `--lintel-color-link`, `-accent`                        | Brand and accent, darkened or lightened to pass 4.5 : 1 |
| `--lintel-color-brand-text`                             | Brand for small labels: passes on the page and panels   |
| `--lintel-font-heading`, `--lintel-font-body`           | The font pairing                                        |
| `--lintel-space-1` … `--lintel-space-9`                 | The spacing scale                                       |
| `--lintel-radius-small`, `-medium`, `-large`, `-button` | Corners                                                 |

"Automatic" adds the dark palette inside `@media (prefers-color-scheme: dark)`.
`siteStylesheet(theme, template)` joins the tokens, every component's CSS (in the order of
`styles/stylesheet-order.ts`) and the template's own CSS into the one stylesheet a site
serves.

## Templates

A template (`templates/site-template.ts`) is a default theme, a header layout and a
`renderView` that draws each kind of page (`templates/view.types.ts`: page, post, list of
posts, not found, empty site, message). Both built-in templates use the shared layouts
through `renderStandardView`:

- **Clean** (`clean`): a business site. A slim, translucent header bar, big centred
  headings, posts as cards in a grid.
- **Journal** (`journal`): a blog. A centred masthead, serif type, left-aligned reading
  column, posts as a reading list. Its adjustments are in `styles/templates.css` under
  `.lintel-template-journal`.

Writing your own is described in the docs: "How Lintel renders sites".

## Commands

```bash
pnpm --filter @lintel/site-components build   # dist/, with the CSS files copied beside it
pnpm --filter @lintel/site-components test
```
