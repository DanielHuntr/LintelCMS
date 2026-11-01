# Browser tests

Tests that need a real browser: Web Animations, IntersectionObserver, scroll timelines, layout
and pointer events. `harness.ts` bundles the source with esbuild, starts Chromium through
Playwright and loads the runtime and presets as `window.motion` and `window.presets`.
