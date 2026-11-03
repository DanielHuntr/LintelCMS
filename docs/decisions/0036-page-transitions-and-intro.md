# 36. Page transitions and the first-visit intro are site settings, run by the browser

Date: 2026-11-03

## Decision

How one page gives way to the next, and an optional intro before the home page, are two
choices in **Settings → Your website**, under **Moving between pages**, beside the site's
colours and fonts. They are stored in the existing `siteEffects` setting, so no migration.

- **Page transitions** use the browser's cross-document view transitions
  (`@view-transition { navigation: auto; }` with our own `::view-transition-old/new(root)`
  animations). There is no client-side router: every page is still a normal page load.
  Four looks (Fade, Rise, Sweep up, Settle) at three speeds (Quick 300 ms, Steady 500 ms,
  Slow 800 ms). The looks are keyframe lists in `@lintel/motion/effects`
  (`page-transition-looks.ts`), written out as CSS for the site and played with the Web
  Animations API by the admin's preview, so the preview is exactly what visitors get.
- **The first-visit intro** (a counting number, the site's name, the logo, or a simple
  line) is an overlay drawn over the home page only, at most once per visit
  (`sessionStorage`), for 1.3 to 3 seconds, and skipped by its button, a click or any key.
  The page is complete underneath, so search engines and screen readers read it as usual.
- **Carry across pages** (the "shared-element" effect, formerly "Morph between pages") gives
  an element a view transition name. A short head script, sent only with transitions on,
  keeps names unique: as a page is left, only the carried element beside the followed link
  keeps its name; as a page arrives, only the first of each name does. Without that, one
  repeated name in a list would make the browser skip the whole transition.

## Why

- **Nothing to break.** Cross-document view transitions keep every page a real page: links,
  history, scroll restoration, analytics and caching work as before, and a browser without
  them simply changes page. The existing `transitions` module still covers those browsers
  with a short cover, as before.
- **Calm by default.** Two selects; speed, words and colours appear only when they matter.
- **Accessibility.** The transition CSS is inside `prefers-reduced-motion: no-preference`,
  and the intro only shows with scripts on and for people happy with motion; CSS hides it
  after four seconds whatever happens. Its middle is `aria-hidden`; its Skip button is not.
- **Home page only.** Someone arriving at an article from a search goes straight to it.

## One thing, not two

The motion presets "Page fades in", "Page rises in", "Page fades out" and "Page sinks out"
overlapped with this. They are no longer offered in the animation gallery (whose
"Transitions" group is now "Section reveals", with a new "Split open"). `findPreset` still
finds them, so designs that use them keep playing and still open in the editor. The
builder's Animate tab keeps the site cursor and points to Settings for the rest.

## Consequences

- The site context now carries the saved settings, and `siteEffectsHead` is drawn per page.
- Only sites with a transition or intro switched on get any of this CSS or script.
- Browsers without cross-document view transitions get the fallback cover, or none under
  reduced motion.
