# effects (runtime)

What published pages run for the Effects library. Framework-free; never imports Zod.

| Path              | What it does                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `effect-types.ts` | The shapes the runtime reads: bindings, site settings, behaviours, modules                        |
| `loadEffects.ts`  | Part of the core runtime: finds each element, waits until it nears the screen, imports its module |
| `modules/`        | One lazily loaded file per family (pointer, text, scroll, depth, svg, physics...)                 |
| `kit/`            | Helpers the modules share: frame loop that pauses off screen, overlays, WebGL, the cursor's look  |
| `maths/`          | Pure maths with tests: easing towards a target, springs, velocity, path morphing                  |

Every behaviour is `(element, params, context) => cleanup`. `context` says whether the
visitor asked for less motion, is on a low-power device, or has a fine pointer; each
behaviour answers all three, and also keyboard focus where the pointer matters.

`scripts/bundle-effect-modules.mjs` builds `modules/` into `dist/effect-modules` as ES modules with
shared chunks and a `manifest.json`; the server serves them from `/_lintel/effects/`.
The physics module uses the `spring` and `inertia` generators from the `motion` library
(MIT); see `docs/decisions/0026-effects-library.md`.
