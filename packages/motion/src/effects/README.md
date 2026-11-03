# effects (runtime)

What published pages run for the Effects library. Framework-free; never imports Zod.

| Path              | What it does                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `effect-types.ts` | The shapes the runtime reads: bindings, site settings, behaviours, modules                        |
| `loadEffects.ts`  | Part of the core runtime: finds each element, waits until it nears the screen, imports its module |
| `modules/`        | One lazily loaded file per family (pointer, text, scroll, depth, svg, physics...)                 |
| `kit/`            | Helpers the modules share: frame loop that pauses off screen, overlays, WebGL, the cursor's look  |
| `maths/`          | Pure maths with tests: easing towards a target, springs, velocity, path morphing                  |

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

Every behaviour is `(element, params, context) => cleanup`. `context` says whether the
visitor asked for less motion, is on a low-power device, or has a fine pointer; each
behaviour answers all three, and also keyboard focus where the pointer matters.

`scripts/bundle-effect-modules.mjs` builds `modules/` into `dist/effect-modules` as ES modules with
shared chunks and a `manifest.json`; the server serves them from `/_lintel/effects/`.
The physics module uses the `spring` and `inertia` generators from the `motion` library
(MIT); see `docs/decisions/0026-effects-library.md`.
