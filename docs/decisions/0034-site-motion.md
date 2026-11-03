# 34. Smooth scrolling moves the real page; pointer touches are effects with fields of their own

Date: 2026-11-03

## Decision

Website makers can give a site the feel of a studio's portfolio: smooth scrolling, a custom
cursor that shows a word over chosen elements, a picture that follows the pointer over a
list row, a slider dragged freely with momentum, and a live clock. Each is one switch or
one choice, and each is off until someone turns it on.

- **Smooth scrolling is a site setting** (Off, Gentle, Strong), beside the page transition,
  cursor and intro in the builder's site settings (Animate tab with nothing selected). It's
  saved in the existing `siteEffects` setting, so there is no migration. There is no
  per-page override: a site that glides on one page and not the next feels broken.
- **It moves the page's real scroll position**, a little each frame, rather than moving the
  page with a transform inside a fixed box (the usual approach of scroll libraries). The
  scrollbar, `position: sticky`, scroll triggers and scroll scenes (in script and in the
  browser's own scroll timelines), find in page and links to part of a page all keep
  working without knowing it's there. Only the mouse wheel is taken over; keys, the
  scrollbar and jumps scroll as usual and the glide restarts from where they leave the page.
  Areas that scroll by themselves, pop-ups and anything marked `data-lintel-native-scroll`
  keep the browser's own wheel.
- **It's written in `@lintel/motion`** (`src/smooth-scroll`, the `smooth-scroll` effect
  module, about 1.8 kB gzipped), not taken from a scroll library. Pages only load it when
  the site has it on, and only for a mouse or trackpad: touch screens already scroll with
  momentum, and people who ask for less motion get the browser's scrolling.
- **The cursor's colour follows the theme by default** (text or brand colour, so it works in
  light and dark), with "Pick a colour" for anything else. Older saved hex colours still work.
- **The word on the cursor and the picture on hover are effects with fields of their own.**
  They are saved as the element's `cursor-word` and `hover-picture` effects, which gives them
  undo, copy and paste, blocks and load-only-when-used for free. They are marked
  `listed: false`, so the Effects gallery and the element's motion list leave them out, and
  the Animate tab shows them as two plain fields under "When the pointer is over it".
  The site cursor shows the word itself; without one, the word follows the pointer alone.
- **The drag gallery is the Slider with one more switch**, "Let visitors drag it freely",
  rather than a near-copy of it. It turns off snapping and looping and adds mouse dragging
  with momentum and a soft stop at each end; touch, the wheel, the arrow keys, Previous and
  Next and the dots keep working as before.
- **The clock is a small element** with a place picked from a list of cities (or the
  visitor's own time) and a 12 or 24-hour choice. The elements script fills it in on the
  website and changes it on the minute; a saved page never shows a stale time.

## Why not a transform-based smooth scroll

Moving the page inside a fixed box gives the most control, but it breaks `position: sticky`,
find in page, the scrollbar, scroll timelines and anything else that reads the real
position, and each of those then needs a workaround. Easing the real position keeps them
all for free, at the cost of not being able to smooth keyboard or scrollbar scrolling, which
the browser already does.
