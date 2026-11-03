# Browser tests

Tests that need a real browser: layout, pointer drags and Web Animations. `harness.ts` bundles
the studio from source with esbuild, builds the Tailwind classes it uses, starts Chromium through
Playwright and opens the studio on the timeline. Each spec the studio reports is collected in
`window.studioChanges`. `openMotionPanel` opens the Motion panel in a column as narrow as the builder's side panel, for checking that it fits and that the tiles' drawings stop for people who ask for less motion.

Run them with `pnpm --filter @lintel/motion-editor test:browser`.
