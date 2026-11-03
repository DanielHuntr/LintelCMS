# players

The animation players the Lottie and Rive elements use, each bundled into a file of its own
by `scripts/effect-modules.mjs` (not into the effect modules or their shared chunks). The
`lottie` and `rive` modules import them by address, only when an element needs one, so no
other page or module pays for them.

| File               | What it is                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `lottie-player.ts` | lottie-web's light SVG build (MIT), about 49 KB gzipped                                         |
| `rive-player.ts`   | `@rive-app/canvas-lite` (MIT), about 62 KB gzipped, plus its WebAssembly (about 350 KB gzipped) |
