# @lintel/motion

Plays Lintel animation specs: the JSON the page builder saves for each animated element.
Framework-free, about 8 kB gzipped, safe to import during server rendering. Built on the
Web Animations API, with scroll-driven animations and `IntersectionObserver` where the
browser has them. The full reference is the docs page "Animation spec reference"
(`packages/docs/src/content/docs/building/animation-spec.md`); the reasoning is in
`docs/decisions/0018-animation-runtime.md`.

```ts
import { mountMotion } from "@lintel/motion";
import { findPreset } from "@lintel/motion/presets";

const controller = mountMotion(element, findPreset("fade-up")!.spec);
```

## Entry points

| Import                           | What it is                                                       |
| -------------------------------- | ---------------------------------------------------------------- |
| `@lintel/motion`                 | The runtime. No dependencies; only imports types from the schema |
| `@lintel/motion/schema`          | Zod schemas, the inferred types and `defineMotion()`             |
| `@lintel/motion/presets`         | The preset library (uses the schema to check every preset)       |
| `@lintel/motion/site-runtime.js` | The built file published pages load (see `src/site-runtime`)     |

## Where things live

| Folder               | What it does                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `src/spec`           | The spec's schemas (the single source of its shape) and the property list     |
| `src/easing`         | Named curves, cubic Béziers, springs and steps: evaluated and as CSS          |
| `src/keyframes`      | Tracks to Web Animations keyframes, and sampling tracks that share a property |
| `src/targets`        | Finding targets, splitting text, stagger order                                |
| `src/reduced-motion` | What each spec becomes for people who prefer less motion                      |
| `src/runtime`        | `mountMotion`, playback, feature checks, scroll-scene maths                   |
| `src/triggers`       | One file per kind of trigger, and the list that picks one                     |
| `src/presets`        | The 42 presets, by category                                                   |
| `src/site-runtime`   | The script published pages load, and `window.lintelMotion` for the canvas     |
| `src/browser-tests`  | Tests in real Chromium through Playwright                                     |

## Tests

`pnpm test` runs the unit tests (Vitest, some in jsdom) and then the browser tests
(`vitest.browser.config.ts`), which bundle the source with esbuild and drive Chromium with
Playwright. Install the browser once with `pnpm --filter @lintel/motion exec playwright install chromium`.
