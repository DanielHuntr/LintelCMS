# Fix log: shader studio (`feature/shader-studio`, 4 November 2026)

More settings for each shader, layers, reacting settings, new looks and custom shaders. The
decision is `docs/decisions/0066-shader-studio.md`; the docs are `using/effects` and
`building/custom-shaders`.

Checked in Chromium on a real install (fresh Lintel folder, API 4741, site 4742, admin 5741),
on a published page and in the builder. Screenshots are in `screenshots/shader-studio/`. WebGL
in those runs is software (SwiftShader), not a real graphics card.

## Found and fixed

Each was reproduced first. Those marked "test" have a regression test that failed before the
fix. Those marked "looked" are drawings, judged from before and after screenshots.

| ID            | Severity | What was wrong                                                                                                      | Fix                                                                            | Proof  |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| LINTEL-UX-250 | P2       | Making Speed react did nothing: the frame loop read the saved value                                                 | Time now runs at the speed as it is at that moment                             | test   |
| LINTEL-UX-251 | P3       | A layer's Opacity was the one number that couldn't react                                                            | It has the same control, saved as `layerOpacity`                               | test   |
| LINTEL-UX-252 | P3       | Film grain's Grain setting did nothing once it was a layer                                                          | Fine, medium and coarse now set the size of the grain                          | test   |
| LINTEL-UX-253 | P2       | Dust, contours or grain as layers hid the section's own background picture                                          | A section with only those keeps its picture, and the drawing stays see-through | test   |
| LINTEL-UX-254 | P1       | The section went blank in the builder after "Add a layer": a stopped stack never gave back the section's still look | The still look comes back on stopping, and the new stack shows at once         | test   |
| LINTEL-UX-255 | P2       | A shader didn't show on the canvas after Save, as the panel still held the library from before                      | Code just saved is used straight away; changed code also shows at once         | test   |
| LINTEL-UX-256 | P3       | Every layer had its own "Keep words readable", which did nothing                                                    | Only the stack has it                                                          | test   |
| LINTEL-UX-257 | P1       | After the graphics card stopped a shader, the code box stayed stopped for good and kept retrying the same code      | It waits for changed code, tries that, and won't save stopped code             | test   |
| LINTEL-UX-258 | P2       | Escape closed the code box and lost what was typed                                                                  | Escape only leaves while nothing has changed; Cancel always leaves             | test   |
| LINTEL-UX-259 | P2       | "Delete from this site" removed a shader from every page at one press                                               | It now says what happens and asks first                                        | test   |
| LINTEL-UX-260 | P2       | Shader code reached the builder's canvas while the site didn't allow custom code                                    | The canvas now leaves it out, as published pages do                            | test   |
| LINTEL-UX-261 | P1       | The loop checks could be fooled, so a shader could ask for far more work than allowed (details below)               | All five ways are closed                                                       | test   |
| LINTEL-UX-262 | P3       | A veil meant for a shader came back after it stopped, from the old pixels in the hidden canvas                      | The veil is only measured while a drawing shows                                | test   |
| LINTEL-UX-263 | P2       | Without WebGL, words were checked against the section's colour, not the still look showing (white on light silk)    | The still look's colours are measured too                                      | test   |
| LINTEL-UX-264 | P3       | Silk looked like lava-lamp blobs, not cloth                                                                         | New folds: long, soft, with a highlight along them                             | looked |
| LINTEL-UX-265 | P3       | On light sections dust's nearest specks looked like smudges                                                         | The near specks gain less than the far ones                                    | looked |
| LINTEL-UX-266 | P3       | The Develop tile showed a dot, not a picture: a broken clip removed the hills                                       | A small landscape, drawn as a mask, that develops out of specks                | looked |
| LINTEL-UX-267 | P3       | The Colour split tile had the same problem                                                                          | The same landscape, with red and blue fringes that part and close              | looked |
| LINTEL-UX-268 | P3       | The Grain tile was flat in dark mode: multiply does nothing on a dark tile                                          | Specks in the colour of the words, on any theme                                | looked |
| LINTEL-UX-269 | P3       | Opening the code box left focus behind it                                                                           | Focus goes to the code, and back to where it was on leaving                    | test   |

### LINTEL-UX-261: how the checks were fooled

| Written                                              | What the check did                                     |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `const int N = 0x7fffffff;`                          | Read the first digit, so counted 0 steps               |
| `const int N = 1000 * 1000;`                         | Counted 1,000                                          |
| `const int N` given twice, large then small          | Kept the last                                          |
| `float a(int)` and `float a(float)`                  | Kept the last function of that name                    |
| `for (int i = 0; i < 10; i--)`, and `!=` with a step | Counted 10, though it would run until the card gave up |

Constants must now be plain numbers, a repeated name counts as its largest value, functions
sharing a name count as the dearest, and a loop has to step towards its end.

## Also changed

- "Layered background" is no longer listed under More effects, where it added an empty stack
  with no next step. "Add a layer" on a background is the way in. Saved stacks aren't affected.
- A `MotionPanel` test was updated: it listed the Always tiles from before Glass was added.

## Found, not fixed

- `shader-backgrounds` (the older path, for one look alone) clears `background-image` on any
  look, so dust or contours alone would hide a section's own picture. This is from reading the
  code, not seen in a browser. It's the same fault as LINTEL-UX-253. It was left alone because
  the brief says existing sites keep their look. Daniel's call.
- `packages/admin/src/commerce/WaysToPay.test.tsx` fails `tsc` (a test fixture is missing
  `siteIsLocal` and `checksForPayments`). This branch doesn't touch that folder.

## Browser checks

| Check                                                                      | Published page                         | Builder                                    |
| -------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| Every look, desktop and 390px, light and dark                              | Yes, 16 sections in all four           | Desktop, light and dark                    |
| More settings, reacting, layers, blend, reorder, hide                      | Saved stacks shown                     | Desktop, light and dark                    |
| Code box: preview, real compiler error naming the line, controls, save     | Failing shader names line 3            | Desktop, light and dark; 1024px, light     |
| Less motion: seven looks stay still over 1.2 seconds                       | Desktop                                | Not checked                                |
| No WebGL: ten sections keep a still or plain look                          | Desktop                                | Not checked                                |
| A real lost context, then restored                                         | Desktop                                | Not checked                                |
| Custom code off: no code in the HTML, save refused with 403, plain section | Desktop                                | The code box says so and offers the switch |
| Develop, Colour split and Always tiles                                     |                                        | Desktop, light and dark, zoomed in         |
| A setting reacting to scrolling and the pointer                            | Desktop, on a saved and published page | Not checked                                |

At 390px the builder shows "The designer needs a bigger screen" by design, so layers and the
code box can't be used there, and narrowing an open window closes them. The notice is
screenshotted in light and dark.

Not checked in a browser:

- A person with `builder:design` but not `builder:code`: covered by a core API test and a panel
  test only.
- Any real graphics card or phone, a real GPU hang, or a real hang's recovery time.
- Other browsers than Chromium.

## Content Security Policy

Published pages send no policy of their own, and the development admin doesn't apply one, as
it's written into the built `index.html`. So a clean console proves nothing. Instead, the real
policy from `contentSecurityPolicy.ts` was put into both builder frames as an enforced meta tag
after start-up, then a layer stack, a saved shader on the canvas and the code box's preview were
opened: 0 violations. The published page, under `default-src 'self'; style-src 'self'
'unsafe-inline'; img-src 'self' data:; script-src 'self'`: 0 violations, 13 canvases drawn. The
built admin itself wasn't run. A meta tag added late doesn't cover what loaded before it.

## Sizes

`pnpm --filter @lintel/motion measure:effects`, gzipped. The core runtime is 9,791 bytes, under
its 10,240 limit, and nothing was added to it. `shader-stack` is 18 kB and loads only on pages
that use it.
