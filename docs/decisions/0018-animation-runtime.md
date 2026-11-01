# 18. Animations as JSON specs, played by our own small runtime on the Web Animations API

Date: 2026-11-01

## Decision

Animations made in the builder are saved as a JSON spec (trigger, targets, tracks of
keyframes, timing, easing and a reduced-motion behaviour), validated on the server with Zod
schemas from `@lintel/motion/schema`. Published pages play them with `@lintel/motion`, a
runtime of our own of about 8 kB gzipped, with no dependencies, built on the browser's Web
Animations API. Scroll scenes use the browser's scroll-driven animations (`ViewTimeline`
and `ScrollTimeline`) where they exist, and a one-read, one-write-per-frame fallback where
they don't. Scroll-into-view uses `IntersectionObserver`. The studio that edits specs is a
separate React package, `@lintel/motion-editor`, so the builder only embeds a component.

## Why

- **Specs are data.** A JSON spec can be stored with a page, versioned, validated, diffed
  in revisions and previewed in the admin, then played by any site, whatever framework it
  is built with. Code (or a library's API calls) would tie saved pages to one library and
  one version of it.
- **The browser already has a good animation engine.** Web Animations run opacity,
  transforms and filters on the compositor, off the main thread, and give us play, pause,
  reverse and seek for free. A runtime that turns specs into keyframes and wires up
  triggers is small, which matters because it ships on every published page.
- **Scroll scenes without jank.** Scroll-driven animations let the browser tie an
  animation to scrolling itself. Where they aren't available (or for staggered scenes,
  which a single view timeline can't offset per element) the runtime reads the element's
  position once per frame and only then sets animation times, so the layout is never
  calculated twice in a frame.
- **Reduced motion is part of the spec.** Each animation says what people who prefer less
  motion get (nothing, only fades, or the end state at once), because the right answer
  depends on the animation. The runtime follows the device setting while the page is open.
- **Only properties that don't cause layout.** Specs can animate opacity, transforms,
  filters, clip paths, colours and CSS variables, never sizes or positions, so nothing an
  editor builds can make a page stutter.
- **Springs without a physics loop.** Springs are solved in closed form and played as CSS
  `linear()` easing, with the nearest cubic Bézier for browsers that don't know it.

## Alternatives considered

- **GSAP** (with ScrollTrigger): the most capable option, and its scroll pinning inspired
  ours. But it is around 25 kB or more gzipped before plugins, runs every frame in
  JavaScript on the main thread, and saved pages would depend on its API.
- **Motion (formerly Framer Motion's `animate`)**: small and also built on Web
  Animations, but its spec is code, not data, its scroll and spring helpers would still
  need our trigger, stagger and reduced-motion layer on top, and it would be a runtime
  dependency of every site.
- **CSS only** (generated keyframes and `animation-timeline`): no JavaScript at all, but
  hover reversal, toggling clicks, custom events, pointer following, page exits and
  previews that seek need script anyway, and scroll timelines aren't in every browser yet.
- **Lottie**: plays After Effects exports, which suits illustrations, not animating the
  page's own elements.
