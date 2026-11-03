# 26. The Effects library runs on our own runtime, with lazily loaded modules

Date: 2026-11-01

## Decision

The Effects library (over a hundred effects in the builder's Animate tab) is built on
`@lintel/motion`, not on a third-party animation engine. Effects are data: each is a
definition in `@lintel/motion/effects` (name, settings, which elements it suits, what it
does for less motion) that points at a behaviour in one of fifteen ES modules. A small
loader in the core runtime imports a module only when an element using it nears the
screen. Site-wide motion (page transitions, cursor, intro) is one setting, `siteEffects`.

The physics module uses the `spring` and `inertia` value generators from the `motion`
package (motion.dev), version 14, under the MIT licence. Nothing else from it, and nothing
from Motion+ (which is not MIT), is used. Its full `animate()` would add about 25 kB
gzipped; the two generators add about 2.5 kB to the one module that needs them.

GSAP is not used and no adapter is offered: its standard licence does not allow use in
tools that let people build animations without code, which is what the builder is.

## Why

- **Size.** The core runtime stays under 10 kB gzipped (8.3 kB with the loader). Modules
  are 1.6 to 7 kB gzipped each, measured at build time and shown to editors per page.
- **One spec.** "Animation" effects produce ordinary animation specs, so they compose with
  presets and open on the timeline. Reduced motion follows the same rules everywhere.
- **Accessibility and quality** are easier to guarantee in code we own: every behaviour
  answers reduced motion, keyboard focus and touch, and pauses off screen.
- **Licences.** MIT code only, and only where it saves real work (springs and momentum with
  bounds and snapping are fiddly to get right).

## Measured

At half CPU speed in Chromium, a page with twenty effects (particles, tilt, spotlight,
scroll skew and parallax, marquee, scramble, line drawing) scrolls at 60 fps with no task
over 50 ms, and so does a WebGL liquid gradient. A page whose effects are all at rest
requests no animation frames.

## Consequences

- Adding an effect is a definition, plus a behaviour if none fits; `defineEffect` and
  `registerEffect` let plugins and code do the same, and `registerEffectBehaviour` lets a
  code block provide the behaviour.
- Effect modules are served from `/_lintel/effects/` (the website) and `/canvas-effects/`
  (beside the admin, for previews); both read `dist/effect-modules/manifest.json`.
- Module sizes are committed in `module-sizes.ts`; a test fails when they drift by 10%.
