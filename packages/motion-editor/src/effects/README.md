# effects

The Animate tab's Effects: `EffectsPanel` (what the element has, with Simple settings, and
the gallery), `EffectsGallery` and `EffectCard` (search, kinds, "Suits this element", and a
live preview on hover or focus that runs the real module), `PageWeightMeter` ("Effects: 3,
adding 14 kB", with warnings) and `SiteMotionSettings` (smooth scrolling and the site's cursor, including "Your own
picture"; page transitions and the intro are in the admin's Settings → Your website).
`CursorLookFields` sets the look of the cursor's word (for the site, and for one element on
the builder's Animate tab) and `CursorPreview` is the box where moving the mouse tries the
cursor without publishing.

Effects come from `@lintel/motion/effects`; pass `registry` to offer code-registered ones.
Previews need `moduleAddresses`: where each effect module is served (the admin serves them
beside itself at `/canvas-effects/`).
