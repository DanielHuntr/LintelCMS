# effects (runtime)

What published pages run for the Effects library. Framework-free; never imports Zod.

| Path              | What it does                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `effect-types.ts` | The shapes the runtime reads: bindings, site settings, behaviours, modules                                 |
| `loadEffects.ts`  | Part of the core runtime: finds each element, waits until it nears the screen, imports its module          |
| `modules/`        | One lazily loaded file per family (pointer, text, scroll, depth, svg, physics...)                          |
| `kit/`            | Helpers the modules share: frame loop that pauses off screen, overlays, WebGL, the cursor's look           |
| `maths/`          | Pure maths with tests: easing towards a target, springs, velocity, path morphing, the playground's physics |
| `players/`        | The Lottie and Rive players, each bundled into a file of its own and imported by address                   |

Every behaviour is `(element, params, context) => cleanup`. `context` says whether the
visitor asked for less motion, is on a low-power device, or has a fine pointer; each
behaviour answers all three, and also keyboard focus where the pointer matters.

`scripts/bundle-effect-modules.mjs` builds `modules/` into `dist/effect-modules` as ES modules with
shared chunks and a `manifest.json`; the server serves them from `/_lintel/effects/`.
The physics module uses the `spring` and `inertia` generators from the `motion` library
(MIT); see `docs/decisions/0026-effects-library.md`.

The creative pack (decision 0055) adds three modules. `playground` is "Drag and throw these":
its small physics world is `maths/playground.ts`, our own. `lottie` and `rive` play the
Lottie and Rive elements; the players they need (lottie-web's light build and
`@rive-app/canvas-lite`, both MIT), Rive's WebAssembly and Lintel's two samples
(`../../samples`) are written beside the modules with fingerprints and found through
`kit/media-player.ts`. They never join the shared chunks, so no module carries their code. The page weight meter
counts them (`effectPlayerBytes`).
