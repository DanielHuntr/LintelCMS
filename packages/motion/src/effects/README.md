# effects (runtime)

What published pages run for the Effects library. Framework-free; never imports Zod.

| Path              | What it does                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `effect-types.ts` | The shapes the runtime reads: bindings, site settings, behaviours, modules                                             |
| `loadEffects.ts`  | Part of the core runtime: finds each element, waits until it nears the screen, imports its module                      |
| `modules/`        | One lazily loaded file per family (pointer, text, scroll, depth, svg, physics...)                                      |
| `kit/`            | Helpers the modules share: frame loop that pauses off screen, overlays, WebGL, the cursor's look                       |
| `maths/`          | Pure maths with tests: easing towards a target, springs, velocity, path morphing, 3D layouts, the playground's physics |
| `players/`        | The Lottie and Rive players, each bundled into a file of its own and imported by address                               |
| `model/`          | The 3D model element: three.js scene, light presets, reading model files, poster pictures                              |

## Shader effects

The shader backgrounds (`shader-backgrounds`: moving gradient, soft light, floating dust,
contour lines), the picture effects (`picture-effects`: develop from noise, pixelate in,
colour split) and the older liquid gradient and liquid picture all draw through one WebGL
context per page (`kit/shader-renderer.ts`): a hidden canvas draws each in turn and its
picture is copied onto the element's own 2D canvas, so a page with many never runs out of
contexts. `kit/layers.ts` places the canvases (behind the content for backgrounds, exactly
over a picture for picture effects) and keeps their pixels in check; `kit/picture-shader.ts`
lines a picture up the way `object-fit` and `object-position` do. Film grain
(`film-grain`) is an SVG noise tile and needs no WebGL. `maths/readable.ts` works out the
veil that keeps words readable over a background. Ripples and frosted glass still have
their own small contexts. See `docs/decisions/0057-shader-backgrounds.md`.

### Layers, reactions and custom shaders

`modules/shader-stack` draws a section's background as layers, and any look with a setting
that reacts to something. It reads a plan from the `plan` setting, made by
`effects-catalogue/shader-plan.ts`; an effect that needs none of this stays on its own module,
exactly as it was. See `docs/decisions/0066-shader-studio.md`.

| Path                        | What it does                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `kit/shader-looks.ts`       | The four backgrounds' shaders, and what the page needs to know about each                  |
| `kit/shader-looks-extra.ts` | The looks only the stack runs: glass, halftone, dithering, grain, aurora, silk, soft cells |
| `kit/shader-stack.ts`       | Draws layers to textures and blends them, in the page's one context                        |
| `kit/shader-reacts.ts`      | What can drive a number: the pointer, scrolling, a repeating timeline                      |
| `kit/custom-shader.ts`      | Reads pasted code: limits, controls from comments, plain messages. No browser in it        |
| `kit/shader-preview.ts`     | The code box's preview, with a context of its own (`@lintel/motion/shader-preview`)        |

A custom shader is not trusted: `readCustomShader` checks it here, in the code box and on the
server, then it's tried on a tiny drawing and timed while it runs. Whatever stops a layer, the
rest carry on; with none left, the section keeps its plain background or still look and the
words are measured against that.

Every behaviour is `(element, params, context) => cleanup`. `context` says whether the
visitor asked for less motion, is on a low-power device, or has a fine pointer; each
behaviour answers all three, and also keyboard focus where the pointer matters.

`scripts/bundle-effect-modules.mjs` builds `modules/` into `dist/effect-modules` as ES modules with
shared chunks and a `manifest.json`; the server serves them from `/_lintel/effects/`.
`kit/scroll-progress.ts` is the effects' scroll engine (an element's progress through the
screen, read in frames after the page moves); the scroll effects, depth on scroll, cards on
scroll and "Turn as you scroll" models all use it.

The physics module uses the `spring` and `inertia` generators from the `motion` library
(MIT); see `docs/decisions/0026-effects-library.md`.

The creative pack (decision 0055) adds three modules. `playground` is "Drag and throw these":
its small physics world is `maths/playground.ts`, our own. `lottie` and `rive` play the
Lottie and Rive elements; the players they need (lottie-web's light build and
`@rive-app/canvas-lite`, both MIT), Rive's WebAssembly and Lintel's two samples
(`../../samples`) are written beside the modules with fingerprints and found through
`kit/media-player.ts`. They never join the shared chunks, so no module carries their code. The page weight meter
counts them (`effectPlayerBytes`).
