# Smooth scrolling

`startSmoothScroll(window, { strength })` turns the mouse wheel's steps into one soft,
weighted glide. Sites switch it on in the builder's site settings (Off, Gentle or Strong);
the `smooth-scroll` effect module starts it, and only on pages of a site that has it on.
Import it from `@lintel/motion/smooth-scroll`; it isn't part of the main runtime entry.

It moves the page's real scroll position a little each frame, so the scrollbar,
`position: sticky`, scroll triggers, scroll scenes, find in page and links to a part of the
page all keep working without knowing about it. Only the wheel is taken over: keys, the
scrollbar, touch and jumps scroll as usual, and the glide restarts from where they leave
the page. Areas that scroll by themselves, pop-ups and anything marked
`data-lintel-native-scroll` keep the browser's own wheel. Off for less motion and for
touch-only devices. Whether the wheel belongs to such an area, or the page is locked, is
worked out (from computed styles) at the start of a glide, then not again while the wheel
keeps turning the same way over the same element, so a fast wheel doesn't read styles on
every step.

While it glides, `<html>` has `data-lintel-gliding`; while it is on, `data-lintel-smooth-scroll`
says how strong it is. `smoothScroll.test.ts` covers the maths; the browser tests in
`src/browser-tests/site-motion.browser.test.ts` cover it in Chromium.
