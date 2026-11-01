# 21. Advanced styling stays plain CSS properties, with stricter checks for the few that point at files

Date: 2026-11-01

## Decision

Transforms, shapes, masks, layered backgrounds, blends, filters and text effects are more
entries in the builder's one list of style properties (`style-properties.ts`), stored per
screen size and state like every other style and printed as the CSS property of the same
name. Values the panel builds from several controls (a polygon's corners, a gradient's
colours, a list of filters) are written as the CSS value and read back from it; a value the
panel can't read is shown as text and left alone.

A few things can't be one property, so they are settings on the element instead: a section's
`freeLayout` (its children are placed with `left`/`top`/`width` in percent, and the styles
it implies are merged under the element's own when the stylesheet is printed), a
`backgroundVideo`, the page's `fonts` (on the page element's props), and `marks` on headings
and paragraphs for styles on part of the text.

Values can point at files in exactly three places: `background-image` and `mask-image`
(`url("...")` layers), and a page font's files. There the value is parsed, every address must
be a web address or a path on the site with no quotes, brackets, spaces or backslashes, and
everything else must be a gradient or `none`. Shapes, filters and `transform` are checked to
be lists of the functions the panel offers. Everywhere else, `url()` is still refused.

The fonts that come with Lintel are open-licence files in the repository, served by the
website from `/_lintel/fonts/`; uploaded fonts and videos go into the media library.

## Why

Keeping everything a property means per-screen-size and hover styles, undo, the code view,
copy and paste and HTML export work for the new styles without any new code, and a
developer reading the stylesheet sees ordinary CSS. Settings are used only where CSS alone
can't express the idea (a video element, `@font-face` rules, markup for styled words).

Allowing `url()` at all widens what a stored page can do, so it is limited to the
properties that need it and parsed rather than pattern-matched as a whole.

## Consequences

- New style properties are one line each in `style-properties.ts`, plus a check in
  `style-values.ts` if their values are more than words and numbers.
- Free layouts keep the reading order: dragging changes styles, never the order of elements.
- Bundled fonts add about 1.3 MB to the repository; `scripts/fetch-fonts.mjs` refreshes them.
