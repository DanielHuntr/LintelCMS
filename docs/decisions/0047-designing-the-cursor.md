# 47. Designing the cursor: the word's look, the site's own picture, and one choice per element

Date: 2026-11-03

## Context

The site cursor offered a few shapes (dot, ring, ring and dot, inverting circle) with a
trail, colour and size, and an element could give the cursor a word ("View") or show a
picture that follows the pointer. People asked to customise the pointer itself: the word's
colours and shape, their own cursor picture, and what the cursor does over one element.

## Decision

**Site settings (Motion across the site).**

- **"Your own picture"** is a cursor style. The picture comes from the media library; the
  settings keep its `assetId`, its address, its size (16 to 96 px), where it points (the
  middle, or the top-left corner like an arrow) and its file size, so a note can say when it
  is over 64 KB. Until a picture is chosen the visitor sees the normal pointer.
- The page never loads the upload itself: the server rewrites a media library address to a
  copy at twice the shown size, as PNG (`?w=…&format=png`; SVG is drawn to PNG by the
  existing transforms). Addresses are checked like the hover picture's: the site or the web
  only, never `javascript:`, `data:` or another scheme, in the schema and again in the page.
- A picture is a pointer, so it stays exactly on the point: it never eases behind and
  leaves no trail, whatever the motion setting.
- **The cursor's word** has a look: background and letters (Automatic, the site's own
  colours, the theme's colours, or one picked by hand), size (small, medium, large) and
  shape (pill, square, circle). It sits in a group that stays closed until opened.
  "Automatic" keeps today's look: the cursor's colour, or the theme's text colour without a
  custom cursor. Letters left automatic are worked out to read on the background: the
  theme's partner colour, black or white on a hex colour, and on the page for the site's own
  colour variables.
- **A live preview** sits under the settings: moving the mouse over it shows the cursor,
  growing over a sample link and the word over a sample card. It draws from the same
  settings and the same look helpers as the page, so nothing has to be published to try it.

**Per element ("When the pointer is over it", Animate tab).** One choice list: Nothing
changes, A word on the cursor, A picture follows it, The cursor grows, The cursor becomes a
picture, The cursor hides, The normal pointer. Only the chosen option's fields show. The word
can have its own look under "Change its look"; empty parts follow the site. The first two
keep their effects (`cursor-word`, `hover-picture`); the rest are one new effect,
`cursor-over`, with a `mode`. Over an element:

- _grows_: the ring widens as over links; a dot alone or a picture scales up;
- _becomes a picture_: the site cursor shows the element's picture (with its own size and
  point); without a site cursor the picture becomes the browser's own cursor, sized for it,
  with the hotspot where it was set;
- _hides_: no custom cursor and no pointer;
- _the normal pointer_: the custom cursor steps aside and the browser's pointer returns (the
  text cursor over text, the hand over links), for text people select.

Growing needs a site cursor; the Animate tab says so when the site has none.

**How it reaches the page.** The site's word look is plain CSS custom properties on
`:root` (`--lintel-cursor-word-background`, `-colour`, `-size`, `-radius`, `-ratio`),
written by the server only when it differs from the standard look; an element's own look is
set on the word while it shows. Elements carry `data-lintel-cursor-over`, which the site
cursor reads as it reads `data-lintel-cursor-word`. Everything new is in the cursor module
(about 2 kB more, compressed); the core runtime only passes the picture's address, size and
point along, and stays under its 10 kB budget.

## What stays the same

- Settings saved before this read as the standard look and no picture, and draw exactly as
  before: no extra CSS, the same word colours, the same ring and dot.
- Touch screens never see any of it. Keyboard focus rings are untouched. With less motion
  asked for, nothing eases or lags. Over an embedded frame (a video) the cursor and its
  picture step aside and come back afterwards.
- An older page with both a word and a following picture keeps both; the Animate tab shows
  the word as its choice.

## Not done

- The media library's "where used" doesn't list a picture used as the cursor.
- The preview shows the cursor and word; it doesn't draw the trail.
