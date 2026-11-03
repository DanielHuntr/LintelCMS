# 0057: Shader backgrounds and picture effects

Date: 3 November 2026. Status: accepted.

## Context

Daniel approved a creative pack. This part is moving backgrounds for sections and effects
for pictures: a small set that looks considered rather than generated, each with only a
few settings, that works for people who can't write a shader and doesn't cost a page its
speed. The effects library already had a liquid gradient, a liquid picture, a lens warp,
water ripples and 2D particles, each opening its own WebGL context; browsers allow only a
handful at once, and each costs memory. The page runtime's 10 KB budget is full.

## Decision

- **Backgrounds for sections** (category "canvas", offered under Always):
  - Moving gradient: two soft pools of colour drifting over the section's own background.
  - Soft light: light on the bottom of a pool, on a colour of its own.
  - Floating dust: specks at three depths, near ones larger and soft, shifting a little with
    the pointer.
  - Contour lines: a map's contour lines over a slowly shifting landscape, every fifth line
    a little stronger.
  - Film grain: an SVG noise tile laid over the section with an overlay blend. It needs no
    WebGL; it jumps a few times a second, and stays still for less motion.
- **Picture effects:** Develop from noise and Pixelate in, which play once as the picture
  comes into view (offered under Appears), and Colour split, while the pointer moves over
  the picture (offered under Hover). Liquid on hover is the existing Liquid picture, now
  offered under Hover too, with the Lens warp.
- **Few settings:** each has its colours (one or two), speed and how much. The covering
  backgrounds add "Keep words readable", on by default.
- **Site colours:** colour settings offer the site's colours first, then the theme's, and
  save them by name (`var(--lintel-color-brand)`, `var(--my-colour)`), so a background
  follows Site styles. Dust and lines start as `currentColor`, the colour of the section's
  words, which suits light and dark sections without a choice. Colour settings now accept
  hex, `var(--name)` and `currentColor`, and nothing else.
- **Readable words:** with "Keep words readable" on, the page reads the colours of the words
  in the section and lays a veil (black under light words, white under dark ones) just
  strong enough for 4.5:1 contrast over every colour of the background, at most 85%. With
  enough contrast already there is no veil. This works without WebGL too.
- **One WebGL context per page** (`kit/shader-renderer.ts`): a hidden canvas compiles each
  shader once and draws every effect in turn; the picture is copied onto the element's own
  2D canvas. The liquid gradient and liquid picture use it too; ripples and frosted glass
  keep their own small contexts for now. If WebGL is missing, or the context is lost, the
  effect leaves its static look.
- **Cost:** canvases draw at most twice the screen's pixels, once on phones and slow
  devices, and half again where WebGL runs without a graphics card; soft looks (the
  gradient, the light) draw at a fraction of that. Frames stop off screen and in hidden
  tabs, and run at 30 a second on phones. The backgrounds are one module (7.7 kB with what
  it shares), the picture effects another (7.5 kB), grain 1.8 kB; nothing is added to the
  page runtime. They count towards the "several shader effects" warning.
- **Fallbacks:** the gradient and the light write a still version into the page's
  stylesheet, which shows before the module loads, without WebGL and in the builder's
  canvas; the others leave the section's own background. With less motion, the backgrounds
  draw one still frame and pictures show as they are.
- **In the builder:** choosing Always for a section, or Appears or Hover for a picture, shows
  these as tiles with small looping drawings in the Motion panel's style; the chosen
  effect's settings show under the tiles, and each change plays on the canvas.
- **Original work:** every shader here was written for Lintel. No GSAP; no code, names or
  shaders from other products or shader sites.

## Consequences

- Colour settings saved before this were hex, which still works. A colour saved by name
  depends on the site's styles: if the variable is removed, the background uses the
  effect's default.
- A section with a covering background is isolated (`isolation: isolate`) while the effect
  runs, so the canvas sits behind its content; this doesn't change how it looks.
- Pictures from another site that don't allow reading can't be used as a texture: the
  picture simply shows.
- Video elements count as pictures for the gallery, but these effects only work on images;
  on a video they do nothing.
