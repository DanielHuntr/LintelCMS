# 0055: Creative pack: text on a path, Lottie and Rive, drag and throw

Date: 3 November 2026. Status: accepted.

## Context

Daniel approved a "creative pack" so website makers can build playful, award-style pages
without code. This part adds three things: words that follow a circle or a curve (the
rotating "Trust your gut" sticker), Lottie and Rive animations from the media library, and
a container whose items visitors can drag and throw. Each needed a preset and two or three
plain controls, a calm version for less motion, light and dark, phones, and no code on
pages that don't use it. The page runtime's core has a hard 10 kB budget that is full.

## Decision

- **Text on a path is SVG and CSS only.** The words sit on a `<textPath>`; screen readers
  get them once as ordinary (visually hidden) text and the drawing is `aria-hidden`. The
  SVG's box is measured in em, and its text is one em, so the Style panel's text size, font
  and colour (and so the site's text styles) set the badge. A circle spreads its words
  evenly round (`textLength`), with a dot and fixed spaces where the end meets the start.
  Turning is a CSS animation inside `prefers-reduced-motion: no-preference`; "turns as
  visitors scroll" is a CSS scroll-driven animation, so browsers without them show it still.
- **Lottie and Rive are elements whose player is an implied effect.** Like the Menu link's
  scramble (0050), the element's own settings become an effect binding
  (`impliedAnimationEffect`), so the effects runtime loads the `lottie` or `rive` module only
  on pages with one, when it nears the screen. The effects are `listed: false`.
- **Official open-licence players, kept apart.** Lottie uses lottie-web's light build (MIT;
  SVG only, no expressions, so a file can't run code). Rive uses `@rive-app/canvas-lite`
  (MIT): the lite build's WebAssembly is 349 kB gzipped against the full build's 932 kB. Its
  README says it won't draw Rive Text or play Rive Audio, and that such files still run
  without them. Each player is bundled whole into a file of its
  own, with a fingerprint, beside the effect modules, and imported by address. That keeps
  them out of esbuild's shared chunks: imported normally, they added 330 to 610 bytes to
  every other module. Apart, the cost to other modules is about 100 to 170 bytes, because
  the new modules share some small kit files and so split a chunk further. Rive's WebAssembly is served the same way
  and its CDN fallback is switched off, so nothing loads from anyone else's servers.
- **.lottie without a zip library.** A `.lottie` is unpacked in the browser with
  `DecompressionStream` (about 1 kB of our code); pictures inside it are embedded.
- **Media library.** Uploads are recognised by their bytes, as before: a Rive file starts
  with `RIVE`, a `.lottie` is a zip with an `animations/*.json`, and a Lottie `.json` is JSON
  with a version, frame rate, length and layers. They are a new kind, `animation`, served
  with `access-control-allow-origin: *` like fonts, so pages on another address can fetch
  them. The builder's new `file` field uploads one or takes an address, and keeps the
  media library's id in `assetId`, as Picture does, because the check that stops a file in
  use from being deleted looks for that id as a value of its own.
- **Samples made from scratch.** `packages/motion/samples` writes a Lottie (three dots
  hopping) and a Rive file (a circle with an orbiting dot, and a "Hover" state machine with
  a `hover` switch), the Rive one field by field in Rive's runtime format. An element with
  no file plays its sample.
- **Drag and throw on our own small engine.** `maths/playground.ts`: boxes with gravity, air
  drag, bouncy walls and box-to-box pushes, no rotation in collisions (a tilt follows
  sideways speed as a look). Matter.js 0.20 (MIT) was the alternative, but at 25.8 kB
  gzipped it would not fit an effect module's 8 kB limit and does far more than this needs;
  ours is 4.6 kB with the module. Items move with `translate` and `rotate`, so the layout
  never changes and a reload puts everything back. Only the items get `touch-action: none`,
  so a finger on the empty space still scrolls; arrow keys move the focused item; an
  optional Tidy up button appears once something has moved. With less motion nothing moves.
- **The canvas plays a selected animation.** The canvas only previews effects, so a Lottie
  or Rive plays while selected and shows a quiet stand-in otherwise.
- **The admin's Content-Security-Policy allows `'wasm-unsafe-eval'`,** which lets the
  canvas compile Rive's WebAssembly. It allows WebAssembly only; `eval` stays refused.

## Consequences

- A page with a Lottie downloads about 3 kB of module, 48 kB of player and its file; a page
  with a Rive about 2.4 kB, 62 kB and 349 kB of WebAssembly, plus its file. The page weight
  meter counts the players (`effectPlayerBytes`), so both trigger its heavy download
  warning. Pages without them download nothing new; the core runtime is unchanged.
- Pages using other effects carry about 100 to 170 bytes more per module (see above).
- Rive files that use text or audio need the full runtime; they play without those parts.
  Lottie expressions don't run.
- A Rive file with an animation and a state machine of the same name plays the animation,
  because the runtime looks for animations first, so its inputs don't respond.
- The playground ignores rotation in collisions and is meant for a handful to a few dozen
  items; it is not a general physics engine.
- The element stylesheet, on every page, grows by 1.6 kB (0.5 kB gzipped).
