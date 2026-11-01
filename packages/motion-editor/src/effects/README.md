# effects

The Animate tab's Effects: `EffectsPanel` (what the element has, with Simple settings, and
the gallery), `EffectsGallery` and `EffectCard` (search, kinds, "Suits this element", and a
live preview on hover or focus that runs the real module), `PageWeightMeter` ("Effects: 3,
adding 14 kB", with warnings) and `SiteMotionSettings` (page transitions, cursor, intro).

Effects come from `@lintel/motion/effects`; pass `registry` to offer code-registered ones.
Previews need `moduleAddresses`: where each effect module is served (the admin serves them
beside itself at `/canvas-effects/`).
