# Journeys

Whole journeys through Lintel in a real Chromium, with Playwright. They need a fresh Lintel
(nothing set up yet), so they aren't part of `pnpm test`.

`start-from-template.mjs`: set up a new site, choose **Start from a template** on the last
setup screen, use the Bakery template, open its home page in the builder, skip the tour,
change the heading on the canvas, give it the Pop in animation, switch to the Designer tools,
look through Insert (Sections first, in closed groups by purpose, then a search across
Elements), check that Advanced
styles start with their groups closed and that **Style for** is a dropdown, publish, go back
to the page's Design card, make a new page that opens straight in the builder once it has a
title, start it with **Add a section** (which opens Insert with the search ready) and a call
to action, then check the website: the new heading is there, the page loads the motion
runtime and lists its animations, the heading finishes animating in, and with reduced
motion it doesn't move at all.

`more-elements.mjs` (`pnpm --filter @lintel/admin journey:elements`, which also needs
`API_URL`): set up a new site, switch on the blog and the shop and publish two posts through
the API, make a page and choose **Add elements** on its empty canvas, add a **Slider**, a **Collection list** of the blog
posts (checking its heading shows each post's title) and a **Product grid**, publish, then
check the website: the slider moves with its buttons and arrow keys, the posts are listed
newest first, the grid shows its empty state, the shop and basket pages answer, and the page
fits tablet and phone widths.

Run them against a fresh install, on ports of your own:

```bash
pnpm build
rm -rf .lintel                     # a fresh built-in database
(cd packages/core && API_PORT=4610 SITE_PORT=3610 ADMIN_ORIGIN=http://localhost:5610 \
  NODE_ENV=development node dist/main.js) &
(cd packages/admin && VITE_API_URL=http://localhost:4610 npx vite build --outDir /tmp/journey-admin \
  && npx vite preview --outDir /tmp/journey-admin --port 5610) &
ADMIN_URL=http://localhost:5610 SITE_URL=http://localhost:3610 SCREENSHOTS=/tmp/journey-shots \
  pnpm --filter @lintel/admin journey
```

`SCREENSHOTS` is optional; when set, each step is saved there as a PNG. Stop both servers and
delete `.lintel` afterwards.
