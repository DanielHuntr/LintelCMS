# site-effects

Motion across the whole website, picked in the page builder's site settings: the page
transition (fade, slide, wipe or zoom), a custom cursor (with an optional trail, in the
theme's text or brand colour or one picked by hand), an intro shown once per visit and
smooth scrolling (Gentle or Strong). All of them start off.

- `site-effects.routes.ts`: `GET` and `PUT /website/effects`.
- `site-effects.service.ts`: reading and saving the settings, and `siteEffectsHead`, the CSS,
  intro markup and runtime settings every page gets (see `website/site-context.service.ts`).
- `site-effects.repository.ts`: the one `siteEffects` row in the settings table.

The settings' shape, the transition CSS and the intro markup live in
`@lintel/motion/effects` (`site-effects.ts`), beside the runtime that plays them. Page
transitions use cross-document view transitions where the browser has them (CSS only) and
the `transitions` effect module elsewhere. Saving clears the rendered pages, like any write.
