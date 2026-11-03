# site-effects

Motion across the whole website: the page transition (fade, rise, sweep up or settle, at
three speeds) and the first-visit intro, chosen in the admin's Settings → Your website, and
a custom cursor (in the theme's text or brand colour or one picked by hand) and smooth
scrolling (Gentle or Strong), chosen in the page builder's Animate tab. All start off, and a
site with everything off ships no effect CSS or script. See decisions 0034 and 0036.

- `site-effects.routes.ts`: `GET` and `PUT /website/effects`.
- `site-effects.service.ts`: reading and saving the settings, and `siteEffectsHead`, the CSS,
  intro markup, head scripts and runtime settings one page gets. It is drawn per page
  (see `website/site-documents.ts` and the Liquid pages), because the intro only plays
  before the home page, with the site's name or logo.
- `site-effects.repository.ts`: the one `siteEffects` row in the settings table.

The settings' shape, the transition looks and the intro live in `@lintel/motion/effects`
(`site-effects.ts`, `page-transition-looks.ts`, `site-intro.ts`), beside the runtime that
plays them. Page transitions are cross-document view transitions: CSS only where the browser
has them, and the `transitions` effect module elsewhere. Nobody who asks for less motion gets
a transition or the intro. Saving clears the rendered pages, like any write.
