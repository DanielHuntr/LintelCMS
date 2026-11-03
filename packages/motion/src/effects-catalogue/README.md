# effects-catalogue (`@lintel/motion/effects`)

The Effects library as data: what the builder's gallery offers and how saved effects turn
into what a published page runs. Uses Zod, so it is for the server and the editor only.

| Path                       | What it does                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `effect-definition.ts`     | `defineEffect`, the three kinds (behaviour, animation, style), typed settings, `cleanProps`  |
| `parameters.ts`            | `number`, `choice`, `colour`, `toggle`, `text`: short ways to write settings                 |
| `catalogue/`               | Lintel's effects, one file per category; the creative pack is `creative-effects.ts`          |
| `effect-registry.ts`       | The shared list; `registerEffect` adds one from a plugin or code                             |
| `resolve-effects.ts`       | Saved `{ effect, params }` to runtime bindings and static CSS                                |
| `page-weight.ts`           | The meter: effects, modules and kilobytes, and heavy-combination warnings                    |
| `module-sizes.ts`          | Each module's gzipped size, measured by `pnpm measure:effects`                               |
| `site-effects.ts`          | The site-wide settings (page transition, cursor, intro) and their checks                     |
| `page-transition-looks.ts` | The four page-change looks as keyframes, their CSS, the speeds and the carried-element guard |
| `site-intro.ts`            | The first-visit intro's markup, CSS, timing and how it leaves                                |

The docs pages "Effects" (for beginners) and "Effects API" (for developers) explain both.
