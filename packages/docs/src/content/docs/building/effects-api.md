---
title: Effects API
description: How the Effects library works, adding effects of your own with defineEffect, and the runtime API for code blocks.
since: "1.0"
sidebar:
  label: Effects API
---

The Effects library sits on top of the animation runtime (see the
[animation spec reference](/building/animation-spec/)). The reasoning, and the third-party
code it uses, are in decision record 31 (`docs/decisions/0031-effects-library.md`).

| Import                            | What it is                                                                |
| --------------------------------- | ------------------------------------------------------------------------- |
| `@lintel/motion`                  | The runtime, including `mountEffect` and `registerEffectBehaviour`        |
| `@lintel/motion/effects`          | Definitions, `defineEffect`, the registry, site settings, weights         |
| `@lintel/motion/effect-modules/*` | The built, lazily loaded modules and their `manifest.json`                |
| `@lintel/motion-editor`           | `EffectsPanel`, `EffectsGallery`, `PageWeightMeter`, `SiteMotionSettings` |

## How a page runs its effects

An element saves its effects beside its animation: `effects: [{ effect: "tilt-glare",
params: { angle: 14 } }]`. When the page is drawn, the renderer looks each one up, cleans
its settings (clamping numbers, keeping choices to their lists) and writes:

- `data-node-id` on the element;
- the effect's **static CSS**, if it has any (a fallback gradient, a flip card's layout),
  so it looks right before and without scripts;
- a `<script type="application/json" id="lintel-effects">` with each binding (`nodeId`,
  `module`, `behaviour`, `params`) and the address of each module the page uses.

The core runtime (under 10 kB gzipped, shared with animations) finds each element and,
when it comes within half a screen of view, imports the module that runs it. Modules are
ES modules with shared chunks, served from `/_lintel/effects/` with fingerprints.

| Module            | gzipped | Behaviours                                                                                                                                                                               |
| ----------------- | ------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pointer`         |  3.2 kB | magnetic, tilt, follow, spotlight, pointerParallax, glowEdge                                                                                                                             |
| `cursor`          |  3.8 kB | siteCursor, cursorLabel, cursorTrail                                                                                                                                                     |
| `scroll`          |  4.3 kB | velocitySkew, velocityStretch, pathDraw, horizontalScroll, focusBlur, revealMask, explodeLayers, scrollParallax, readingProgress, stackingCards, scrollRotate, colourShift, zoomOnScroll |
| `depth`           |  4.6 kB | perspectiveScene, cardStack, cylinderGallery, coverFlow, flipCard                                                                                                                        |
| `svg`             |  4.7 kB | drawLines, morphShapes, livingBlob, waveEdge, gooey, flowingGradient                                                                                                                     |
| `physics`         |  6.9 kB | dragMomentum, elasticDrag, springToggle, springPress, jellyWobble, pullToReveal, glidingSlider, radialMenu, tabSlider                                                                    |
| `text`            |  4.9 kB | scramble, typewriter, letterPhysics, variableAxis, markerHighlight, rotatingWords, countUp, waveText                                                                                     |
| `marquee`         |  2.9 kB | velocityMarquee                                                                                                                                                                          |
| `particles`       |  2.5 kB | particleField (2D canvas)                                                                                                                                                                |
| `liquid-gradient` |  4.3 kB | liquidGradient (WebGL)                                                                                                                                                                   |
| `image-distort`   |  4.1 kB | imageDistort (WebGL)                                                                                                                                                                     |
| `frosted-glass`   |  3.8 kB | frostedGlass (2D canvas)                                                                                                                                                                 |
| `ripple`          |  4.0 kB | waterRipple (WebGL)                                                                                                                                                                      |
| `transitions`     |  1.6 kB | pageTransition (the fallback where view transitions aren't available)                                                                                                                    |
| `intro`           |  2.3 kB | siteIntro, sectionLoader, toast                                                                                                                                                          |

Sizes include the shared chunks each module imports, so two modules on one page cost a
little less than their sum. `pnpm --filter @lintel/motion measure:effects` updates them,
and a test fails when they drift.

## Defining an effect

```ts
import { defineEffect, number, registerEffect, toggle } from "@lintel/motion/effects";

export const softGlow = defineEffect({
  id: "soft-glow",
  name: "Soft glow",
  description: "A gentle glow that breathes around the element.",
  category: "hover",
  kind: "behaviour",
  module: "custom",
  behaviour: "soft-glow",
  suits: ["button", "container"],
  params: {
    size: number("Glow size", 24, 4, 80, { unit: "px" }),
    onHoverOnly: toggle("Only while hovered", false),
  },
  reducedMotion: "A still glow.",
  preview: "button",
});

registerEffect(softGlow); // now in the gallery, with sliders for "Glow size"
```

`defineEffect` checks the definition (an id of lowercase words and dashes, starting values
inside their ranges, a valid animation) and keeps the settings' types: `EffectProps<typeof
softGlow.params>` is `{ size: number; onHoverOnly: boolean }`.

There are three kinds:

- **`behaviour`** runs a function. Lintel's own live in the modules above; `module:
"custom"` runs one registered in the browser (below).
- **`animation`** returns an ordinary animation spec from its settings. Adding it sets the
  element's animation, so it opens on the timeline and composes with presets.
- **`style`** only writes `staticCss(selector, props)` into the page.

Any kind can also have `staticCss`, for a look that should not wait for scripts.

## The runtime API in code blocks

On a published page, `window.lintelMotion` has `mountMotion`, `mountMotionList`,
`mountEffect`, `registerEffectBehaviour` and `exitPage`. A page whose code block mentions
`lintelMotion` loads the runtime even if it has no effects. (Code blocks keep their scripts
only when Settings allows them; see "Custom scripts" in the builder docs.)

```js
window.lintelMotion.registerEffectBehaviour("soft-glow", (element, params, context) => {
  if (context.reduced) {
    element.style.boxShadow = `0 0 ${params.size}px rgb(117 57 253 / 0.4)`;
    return () => (element.style.boxShadow = "");
  }
  const animation = element.animate(
    [
      { boxShadow: "0 0 0 transparent" },
      { boxShadow: `0 0 ${params.size}px rgb(117 57 253 / 0.5)` },
    ],
    { duration: 1600, direction: "alternate", iterations: Infinity },
  );
  return () => animation.cancel();
});
```

Every behaviour gets `(element, params, context)` and returns a cleanup. `context` says
whether the visitor asked for less motion (`reduced`), is on a phone or saving data
(`lowPower`) and has a mouse (`finePointer`). Bindings for a custom behaviour wait until it
is registered, so the order scripts run in doesn't matter.

You can also run any effect yourself:

```js
const stop = await window.lintelMotion.mountEffect(element, {
  module: "pointer",
  behaviour: "tilt",
  params: { angle: 12, glare: true },
});
```

Lintel uses its own runtime and does not bundle any other animation library on published
pages. If you want another engine in your own code blocks, install it yourself and check its
licence allows use in a site builder.

## Writing a good behaviour

- **Less motion.** Return early (or show the end state) when `context.reduced` is true.
- **No layout shift.** Hold widths when changing text, and draw canvases over or under the
  content, absolutely positioned. Put anything layout-related in `staticCss`.
- **Keyboard and touch.** If the pointer matters, answer `focusin` too; use pointer events,
  which cover touch.
- **Idle means idle.** Use a frame loop that stops when settled and pauses off screen
  (`createFrameLoop` in `src/effects/kit/frames.ts`). A browser test checks that a page
  of still effects asks for no frames at all.
- **Undo everything** in the cleanup: the builder's previews mount and unmount effects often.

## Site-wide settings

`GET` and `PUT /website/effects` (`settings:update` to change) hold `{ pageTransition,
cursor, intro }`. Page transitions use cross-document view transitions
(`@view-transition { navigation: auto }`) where the browser has them, with no script; the
`transitions` module covers other browsers by covering the page, playing any `pageExit`
animations, then navigating. Elements given the **Morph between pages** effect share a
`view-transition-name` and glide from one page to the next.
