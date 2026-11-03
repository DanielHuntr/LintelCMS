# model

How the 3D model element draws its model. The element itself (`model3d` in
`@lintel/builder-model`) prints the model's poster, or a quiet cube; the page then runs
the `model-viewer` effect, which the builder adds for every model with a file
(`impliedModelEffect`), so the model never shows in the Effects gallery.

| File               | What it does                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `model-scene.ts`   | three.js (MIT): renderer, the light preset, loading the .glb, centring and framing the model |
| `light-presets.ts` | Studio, Soft daylight, Dramatic and Night as plain data                                      |
| `model-file.ts`    | Reads a .glb's JSON for the extensions it needs; pixel ratio and scroll turn maths           |
| `model-poster.ts`  | `@lintel/motion/model-poster`: a still of the model, which the builder saves as its poster   |

`../modules/model.module.ts` is the small part a page loads when a model comes near the
screen. It keeps the poster for people who ask for less motion, and where WebGL is missing
or the file can't be read. Otherwise it imports `model-scene.ts`, a chunk of its own with
three.js (about 157 kB gzipped), so pages without a model never download it. Drawing stops
off screen and in hidden tabs; phones, data savers and a low battery get a pixel ratio of at
most 1.25, no antialiasing and 30 frames a second. Drag to turn also turns with the arrow keys.

Draco-compressed models aren't supported (the decoder is bigger than the viewer); meshopt
compression is, its decoder loading only for files that use it. The sample models
(`../../../sample-models`, served at `/_lintel/models/`) are made by
`scripts/make-sample-models.mjs` from three.js's geometry: Lintel's own, with no licence to
carry.
