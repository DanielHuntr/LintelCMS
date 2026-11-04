# 0066: Shader studio: settings, layers, reactions and custom shaders

Date: 4 November 2026. Status: accepted. Builds on decision 0057.

## Context

Daniel asked for more control over shader backgrounds, and for people who can write a
shader to bring their own. Everything in Lintel still has to be simple by default, cheap on
a page, and safe when one part fails. Decision 0057 gave each background a few settings and
one WebGL context per page. The page runtime's 10 KB budget is full, so all of this has to
load lazily.

A custom shader is code from a person, running on every visitor's graphics card. It needs
treating as untrusted, even though only trusted people can write it.

## Decision

### Settings and looks

- **More settings:** each background keeps its few settings and folds the rest (size,
  direction, softness, a third colour, how many lines) under "More settings". Each starts at
  the value that leaves the look as it was, so saved effects look the same.
- **New looks,** written from scratch: Glass, Halftone, Dithering, Aurora, Silk and Soft
  cells. Each has a still version in the page's stylesheet and draws one still frame for
  less motion. Glass, Halftone and Dithering rework the layers under them.

### Layers

- A section's background can be a stack of up to six layers (`layered-background`), each
  with a blend mode, an opacity, and a way to hide, reorder and remove it. All of it draws
  through the page's one WebGL context, with three shared textures. Blending happens in a
  small shader using the W3C compositing formula, so the first layer can blend with the
  section's own colour.
- "Keep words readable" belongs to the stack, not to each layer. The veil is measured from
  what's really drawn, and only ever deepens while it moves, so it doesn't flicker.
- Dust, contours and grain only lay over a section, so a section with nothing but those
  keeps its own background picture under them.
- Film grain alone stays an SVG tile, which needs no WebGL. As a layer it's a shader, because
  layers have to blend.

### Reacting

Any number setting can follow the pointer, scrolling or a repeating timeline, moving from its
own value to a second one. That includes speed and a layer's opacity. With less motion
nothing drives anything. On touch screens the pointer doesn't either; scrolling and timelines
still do.

### Old effects

An effect takes the new path only when it needs to: it has layers, a reacting setting, or
is one of the new looks. Anything else comes out exactly as before, on its own module.

### Custom shaders

- **The code box** is a GLSL fragment shader editor with a live preview and messages that
  name the line as typed. Comments make controls (see the docs page "Custom shaders").
  Nothing can be saved until it compiles and has been tried, and not while the card has
  stopped that code.
- **Who may do what:** anyone with `builder:design` can use a saved shader as a layer. Writing
  one takes `builder:design` and `builder:code`, and the site's `builderCustomScripts`
  setting must be `allowScripts`. We added `builder:code` because a shader is code, and the
  same people should be trusted with it as with Code elements.
- **One switch:** there's no separate setting for shaders. While a site removes scripts, no
  shader code reaches a page or the builder's canvas, including ones saved earlier. Those
  sections show their plain background. People with `settings:update` can turn it on from the
  code box, which says what else that allows.
- **Storage:** one `customShaders:<site id>` row per site in the settings table, so there is
  no migration, and 40 shaders at most. Pages name a shader by id. Saved page data can't
  carry code: `planLayer` takes code only from the library, and the plan is built from known
  fields, so a `plan` or `code` value in saved data is dropped. A page's `lintel-effects` list
  carries only the shaders that page uses, written with `scriptSafeJson`.

### Untrusted code

`readCustomShader` runs in the code box, on the server when saving, and on the page before
compiling. It works without a browser.

- **Size:** at most 16 KB, 800 lines and 12 controls.
- **What it may use:** no `while`, `do` or `goto`; `for` loops only, with a fixed number of
  steps that head towards their end; the only `#` line is a plain number `#define`; no
  textures of its own, so it reads only the layers under it, through `below(uv)`.
- **Work per pixel:** at most 8,192 repeats, multiplying loops inside loops and through
  function calls. A constant must be a plain number, a name given twice counts as its
  largest value, and functions that share a name count as the dearest.
- **Running:** it's compiled with the browser's own checks, in a program of its own. If it
  fails, that layer is left out with a plain message in the console and the rest carry on.
- **Trial:** before the first real frame it's drawn at 8 and 48 pixels and timed. Over 40 ms
  it's left out for this device.
- **While running:** one frame in 30 is timed. Over 120 ms the drawing shrinks; after four of
  those, custom layers stop.
- **Lost context:** the section falls back at once. A custom shader that was running then is
  remembered by a fingerprint in `sessionStorage` and isn't tried again this visit, and looks
  come back when the context does. The code box's preview has a context of its own, so a
  shader being written can't take the rest of the screen with it.

**It never runs scripts.** GLSL runs on the graphics card and can't reach the page, the
network, cookies or storage. A shader sees only its uniforms and the layers below it. The
admin's Content Security Policy doesn't change: there's no `eval`, worker or blob, and no new
address, and the code travels in the JSON the page already has. Published pages send no policy
of their own, and all of this also works under a strict one that a host adds.

### How far a GPU hang can be prevented

Not entirely, and we shouldn't claim otherwise. WebGL can't cancel a draw once it's sent, and
no static check can prove how long a shader takes. What Lintel does is make a hang unlikely
and recoverable:

- The limits above stop infinite loops and very large ones before the card sees them.
- A shader inside the limits can still be very slow: 8,192 repeats of expensive maths, for
  every pixel, on a weak phone. The trial and timing see this only after the work has run,
  and the trial is itself that first exposure.
- If a draw won't finish, Lintel can't stop it. The browser's watchdog or the operating
  system's driver reset does, which can take seconds and may freeze the tab, or briefly the
  whole screen, on some devices. Then the context is lost, and the recovery above takes over.
- Because the context is shared, every shader effect on that page stops until it comes back.

So the real protection is who may write shaders, which is why it takes two permissions and
the site's setting. The docs tell developers to test on a slow phone.

### When a shader fails

Whatever stops a drawing, the section shows its plain background or still version, and the
words are measured against that. This holds with "Keep words readable" off too, because the
words were chosen for a background that is no longer there. A veil meant for the drawing is
taken away with it.

## Consequences

- Nothing is added to the page runtime (9.6 kB gzipped). The layer stack is one module of
  18 kB, loaded only where it's used.
- A shader's messages are in English and aren't translated: the same words come from the
  browser-free check on the server, and they're for developers. Everything else in the panel
  goes through `t()`.
- Deleting a shader, or moving a page to another site, leaves layers naming a shader that
  isn't there. They show as "Shader no longer in this site" and the section keeps its plain
  background.
- The builder needs a bigger screen, so the layers and the code box can't be used on a phone.
- No shader library, no GSAP and WebGL only. Nothing here comes from another product: no code,
  presets, names or assets.
