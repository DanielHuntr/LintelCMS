---
title: How Lintel renders sites
description: The built-in website, its components, themes and caching, and writing a template.
since: "0.1"
---

Lintel serves a website from the same process as the API: a second small server on port
3000 (`SITE_PORT`), started by `pnpm dev` and in production. It renders published pages and
posts on the server with React and sends plain HTML and one stylesheet; it ships no
JavaScript. The decision is recorded in `docs/decisions/0011-built-in-website.md`, and the
code is in `packages/core/src/website` and `packages/site-components`.

Headless use is unchanged: the [delivery API](/building/delivery-api/), GraphQL and the
[Next.js starter](/building/nextjs-starter/) work exactly as before. Set
`SITE_ENABLED=false` if you build the site separately.

## Settings

| Variable          | Default                      | What it does                           |
| ----------------- | ---------------------------- | -------------------------------------- |
| `SITE_PORT`       | `3000`                       | The port the website listens on        |
| `SITE_PUBLIC_URL` | `http://localhost:SITE_PORT` | Its address as visitors reach it       |
| `SITE_ENABLED`    | `true`                       | `false` turns the built-in website off |

In production, put both behind one domain with a reverse proxy: the site at `/`, the API
where the admin expects it.

## From an address to a page

1. The language prefix comes off (`/fr-FR/about` is `/about` in French).
2. With the SEO plugin on, active redirects are answered first.
3. The path is matched against each collection's route pattern. `/` is the page with the
   slug `home`; a dated collection with the pattern `/blog/{slug}` also has a list at
   `/blog` (`/blog/page/2`...) and an archive per term of each taxonomy its terms fields
   use (`/blog/categories/recipes`).
4. The entry is read through the delivery services, so the site never serves anything the
   delivery API wouldn't, and turned into the plain props of a view: `page`, `post`,
   `postList`, `notFound`, `emptySite` or `message`.
5. The template draws the view inside the shared document (head, skip link, header, main,
   footer).

The `<head>` comes from the SEO plugin when it is on: the title template, description,
social image, `noindex`, a canonical address and `hreflang` links between translations.
`/sitemap.xml` and `/robots.txt` are the plugin's, with the site's own addresses.

## Caching

Finished responses are kept in memory with an `ETag`. The cache empties on every content
event (publish, unpublish, delete, scheduled publish) and every successful write through
the admin API, such as a menu or a theme change, and pages expire after ten minutes. The
stylesheet is served at an address that holds a fingerprint of its contents, cached for a
year.

## Live preview

Any page with `?preview=<token>` shows that entry's working copy with the real template,
never cached and marked `noindex`. Collections with pages and no preview address of their
own are previewed this way, so the editor's preview is the real site.

## Components

`@lintel/site-components` has one component per block (Hero, Text, Image, Call to action,
FAQ), layout primitives (`Section`, `Container`, `Stack`, `Columns`), `Header`, `Footer`,
post lists and the theme system. Every component takes plain props and fetches nothing, so
the page builder can render the same ones. Their output is semantic HTML with readable
classes (`lintel-hero__heading`), and each root and editable part is marked with
`data-lintel-component`, `data-lintel-field` or `data-lintel-image`. The package README
lists the HTML every component gives.

The CSS is plain files in `packages/site-components/src/styles`, using only design tokens:

```css
.lintel-button--primary {
  background: var(--lintel-color-brand);
  color: var(--lintel-color-on-brand);
  border-radius: var(--lintel-radius-button);
}
```

A theme is six choices (brand and accent colour, font pairing, corners, spacing, and light,
dark or automatic) that `themeStylesheet` turns into those `--lintel-*` properties on
`:root`. Link and accent colours are adjusted until they pass 4.5 to 1 on the background.

## Writing a template

A template is an object: a default theme, a header layout, optional CSS, and a function that
draws each kind of view. Reuse the shared layouts with `renderStandardView` and replace only
what you need:

```tsx
import {
  type SiteTemplate,
  cleanTemplate,
  Container,
  renderStandardView,
  Section,
} from "@lintel/site-components";

export const studioTemplate: SiteTemplate = {
  id: "studio",
  name: "Studio",
  description: "A portfolio with a dark, gallery-like feel.",
  defaultTheme: { ...cleanTemplate.defaultTheme, colourScheme: "dark", brandColour: "#ff9f0a" },
  headerLayout: "bar",
  stylesheet: `
    .lintel-template-studio .lintel-hero__heading { text-transform: uppercase; }
  `,
  renderView: (props) => {
    if (props.view.kind === "notFound") {
      return (
        <Section>
          <Container width="narrow">
            <h1>Nothing here</h1>
          </Container>
        </Section>
      );
    }
    return renderStandardView(props, { cardLayout: "card" });
  },
};
```

Then offer it beside Clean and Journal, in `packages/core/src/main.ts`:

```ts
const server = buildServer({
  // ...
  website: { builtInSiteUrl: siteUrl, templates: [studioTemplate] },
});
```

It appears in **Settings → Your website**. Its body gets the class
`lintel-template-studio`, so its CSS can adjust any component without touching the others.
A template with the same `id` as a built-in one replaces it.

Keep to the rules the built-in components follow: one `h1` a page, semantic elements,
classes rather than inline styles, tokens rather than fixed colours, and motion only inside
`@media (prefers-reduced-motion: no-preference)`.
