# 56. 3D models and curved layouts

Date: 2026-11-03

## Context

Daniel approved a "creative pack": a 3D model element (upload a .glb, place it like a
picture, choose how it moves and how it is lit) and curved and 3D layouts (a curved
carousel, 3D card stacks, layers at different depths as the page scrolls). Every page
already loads a core runtime whose 10 KB gzip budget is full, and the Effects library
(0026) already has a 3D family: a card stack, a cylinder gallery, cover flow and flips.

## Decision

### The model is drawn by an effect the element implies

The 3D model element prints plain HTML: a `<figure role="img">` named by the model's
description, holding its poster (or a quiet cube). For every model with a file the page
also runs the `model-viewer` effect (`impliedModelEffect`, like the Menu link's scramble
in 0050), in a new lazily loaded `model` effect module. So:

- the core runtime gains nothing: the effects loader already imports a module when its
  element nears the screen;
- the `model` module (about 4.8 kB gzipped) only checks the visitor's settings and the
  device, then imports `model-scene.ts`, a chunk holding three.js and its GLTFLoader
  (about 157 kB gzipped), only on pages with a model, only as one comes near the screen,
  and only where it will be drawn;
- the effect isn't listed in the gallery (`listed: false`); motion, light and background
  are the element's own fields.

### three.js, MIT, without Draco

three.js is MIT-licensed and its GLTFLoader reads every common glTF 2.0 file. Draco needs
a decoder several times bigger than the viewer, so Draco-compressed files are not
supported (the page keeps showing the poster); meshopt
compression is, its small decoder imported only for files that use it.

### The poster does the accessibility and fallback work

The poster shows while the model loads, for people who ask for less motion, where WebGL
is missing or blocked, and if the file can't be read. The builder takes it automatically
when a model is chosen: `@lintel/motion/model-poster` draws the model with the same light,
background and framing as the page's first frame and saves the picture to the media
library. Without a poster, less motion gets a model that stands still. The description is
the element's accessible name; the panel asks for one while it is empty.

### Gentle on devices

Drawing stops off screen and in hidden tabs (the shared frame loop). The pixel ratio is
capped at 2, and phones, data savers and a battery under 20% that isn't charging get 1.25,
no antialiasing and at most 30 frames a second. "Drag to turn" also turns with the arrow
keys.

### Models in the media library are .glb

`model/gltf-binary` joins the allowed types, detected from the file's bytes. A `.gltf`
(JSON) is packed into a `.glb` as it is uploaded when everything it needs is inside it as
`data:` addresses, and refused with a plain note otherwise, so a page always loads a model
in one request. Uploads stay at 25 MB; the builder warns above 10 MB. Model files are
served with `Access-Control-Allow-Origin: *`, as pages fetch them by script. Website
visitors can't send a model through a form's file field. With storage that redirects to
signed links, the bucket must allow cross-origin reads, or pages keep showing the poster.

### Samples are Lintel's own

Three small samples (a vase, a disc, a knot, 72 to 98 kB) are made by
`packages/motion/scripts/make-sample-models.mjs` from three.js's geometry, so there is no
asset licence to carry. They are served at `/_lintel/models/` like the starter sites'
illustrations, and offered as "Try a sample". The API serves them too, at
`/media/sample-models/`, because the admin's Content-Security-Policy only lets the builder
fetch from itself and the API, and a site can be on any address; the builder takes sample
posters from there.

### The layouts extend the 3D family

- **Arc carousel** is a new behaviour in the `depth` module with its own element: items on
  a curve that bends away or wraps round the viewer, drifting, following a drag, a sideways
  swipe and the page's scroll. CSS 3D only. The DOM keeps its order; arrow keys step; focus
  brings an item to the middle; less motion gets a flat row that scrolls sideways.
- **3D card stacks** extend the existing Card stack rather than adding another: a Look
  (Pile, Fan, Tilted back) on `card-stack` and `card-stack-auto`, and a new "Cards on
  scroll" entry that steps through the cards as the stack passes through the screen.
- **Depth on scroll** is a new behaviour in the `scroll` module: a section's children at
  different depths, the nearer moving further. Layers only step back from where they are
  laid out, so nothing grows past the section, and each has its own perspective, so they
  don't crowd towards the section's middle. It starts on Gentle: the stronger looks suit
  pictures and shapes better than lines of text, which they can bring close together. Less
  motion leaves them flat. It sits beside
  "Exploded view", which spreads layers apart once rather than parallaxing them.

The Animate panel offers 3D effects that follow the scroll under Scroll, and the arc
carousel under Always, instead of under Hover with the rest of the family.

## Consequences

- A page with a 3D model downloads about 162 kB gzipped more, once the model nears the
  screen. The page weight meter counts effects from the Animate tab only, so it doesn't
  include a model yet.
- The canvas shows a model's poster; it doesn't run the model, as it doesn't run other
  continuous effects outside previews.
- In a block's design there is no picture upload, so a model there gets no automatic poster.
- Draco files show their poster only. Supporting them later means shipping the decoder as
  its own lazily loaded files.
