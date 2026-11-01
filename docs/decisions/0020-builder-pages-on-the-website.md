# 20. The website draws builder pages with the builder's renderer, and the canvas with the website's stylesheet

Date: 2026-11-01

## Decision

A page designed in the visual builder is drawn on the built-in website by the same
function that draws the builder's canvas (`renderPage` from `@lintel/builder/render`), and
the canvas is drawn inside the same stylesheet, body class, header and footer the website
serves (`GET /website/canvas`). The design sits in `<div class="lintel-design">` in both, and
the builder's element defaults are scoped to it with `:where()`, so they never outweigh a
class the style panel sets.

Animations are stored on the element they belong to (`node.animation`: a spec from
`@lintel/motion` and its preset). The website lists a page's animations as JSON in the page
and loads the motion runtime, one small file, only when that list isn't empty.

## Why

"What you design is what visitors see" has to be true by construction, not by keeping two
renderers in step. One renderer and one stylesheet mean a difference can only come from the
browser, and the tests compare the canvas's stylesheet with the one the website serves.

Keeping the animation on the element means moving, duplicating, hiding or deleting an
element does the same to its animation without any bookkeeping, and undo covers it. Listing
animations in the page, rather than in each element's attributes, keeps the markup clean and
lets pages without animations ship no script at all.

## Consequences

- The canvas waits for `GET /website/canvas` before it opens, so it never jumps from the
  default look to the site's. Without the website feature it falls back to the default theme.
- Pictures with site paths (`/_lintel/illustrations/...`) load in the canvas through a
  `<base>` pointing at the built-in site.
- The website's cloak CSS duplicates `motionCloakCss` from `@lintel/motion`, because
  site-components doesn't depend on the runtime; a test keeps the two equal.
