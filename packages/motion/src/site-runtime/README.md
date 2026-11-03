# Site runtime

The one file a published page loads when it has animations (`dist/site-runtime.js`, about
8 kB gzipped). `site-runtime-entry.ts` is bundled by `scripts/bundle-site-runtime.mjs`
during `pnpm build`. It reads the page's animations from
`<script type="application/json" id="lintel-motion">[{ "nodeId", "spec" }]</script>`,
mounts each on the element with that `data-node-id`, and sets `window.lintelMotion` so the
builder's canvas can preview an animation on an element. Reduced motion is followed as
everywhere else in the runtime.

When the site intro is on screen, entrances (animations that play on load or when they come
into view) wait for it to lift: the intro module fires `lintel:intro-end` on the document
when it has gone, and `afterIntro` starts them then, or after a few seconds at most.

The built-in website serves the file at `/_lintel/motion-<fingerprint>.js`
(see `packages/core/src/website`).
