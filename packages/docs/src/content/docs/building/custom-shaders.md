---
title: Custom shaders
description: Writing your own GLSL background for a site, turning its uniforms into controls, and what Lintel does to keep it safe.
since: "1.0.0-rc"
sidebar:
  label: Custom shaders
---

If you can write a GLSL fragment shader, you can add it to a site as a background layer.
Once it's saved, anyone who designs pages can use it and change its controls without seeing
the code.

## Before you start

You need two things:

- **Your permissions:** `builder:design` and `builder:code`. People with only `builder:design`
  can use saved shaders but can't write them.
- **The site's permission:** the site must allow custom code. If it doesn't, the code box says
  so, and someone with `settings:update` can turn it on there. It's the same setting that lets
  Code elements keep their scripts, so only turn it on if you trust everyone who can write code
  on the site.

If a site stops allowing custom code, no shader reaches its pages, including ones already
saved. Those sections show their plain background.

## Writing one

1. Select a section, open the **Animate** tab and give it a background.
2. Open that background and choose **Add a layer**, then **Add a layer** again, then
   **Write your own…**.
3. Change the code. The preview updates when you pause, and any problem appears under the code
   with its line number.
4. Give it a name and press **Save**. It's added as a layer and saved for the whole site.

To change a saved shader, open its layer and press the code button. A change shows everywhere
the shader is used.

## What you can use

Your shader gets these without declaring them:

| Name         | Type    | What it is                                                        |
| ------------ | ------- | ----------------------------------------------------------------- |
| `uv`         | `vec2`  | Where this pixel is, 0 to 1, from the bottom left                 |
| `time`       | `float` | Seconds, scaled by the layer's Speed setting                      |
| `resolution` | `vec2`  | The size of the drawing, in pixels                                |
| `pointer`    | `vec2`  | The pointer, 0 to 1, from the bottom left; the middle on touch    |
| `scroll`     | `float` | How far the section is through the screen, 0 to 1                 |
| `below(uv)`  | `vec4`  | The layers under this one, with their alpha already multiplied in |

Set `gl_FragColor`, with its colour already multiplied by its alpha. It's WebGL 1, so that's
GLSL ES 1.00. Whole numbers need a point: `1.0`, not `1`.

## Making controls

A comment after a uniform makes a control that people can use without touching the code:

```glsl
// @name Soft rings
// @fallback #101820

uniform float rings;  // @slider "How many rings" min=1 max=20 step=1 value=8
uniform vec3 tint;    // @colour "Ring colour" value=#e8743b
uniform bool flip;    // @toggle "Turn inside out" value=off

void main() {
  vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  float wave = 0.5 + 0.5 * sin(length(p) * rings * 6.28 - time);
  if (flip) wave = 1.0 - wave;
  gl_FragColor = vec4(tint * wave, 1.0);
}
```

| Comment                | Goes on                  | Settings                                              |
| ---------------------- | ------------------------ | ----------------------------------------------------- |
| `// @slider "Label"`   | `uniform float` or `int` | `min`, `max`, `step`, `value`                         |
| `// @colour "Label"`   | `uniform vec3`           | `value`, a colour like `#e8743b` (`@color` works too) |
| `// @toggle "Label"`   | `uniform bool`           | `value`, `on` or `off`                                |
| `// @name Words`       | Any line                 | The name it's first saved with                        |
| `// @fallback #101820` | Any line                 | The plain background where it can't run               |

A uniform with no comment still gets a control, labelled from its name: `ringWidth` becomes
"Ring width". Sliders can follow the pointer, scrolling or a timeline like any other number.

## The limits

Lintel treats the code as untrusted. The same checks run in the code box, on the server when
you save, and on the page before it's compiled.

| Limit                  | Amount                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| Size                   | 16 KB and 800 lines                                               |
| Controls               | 12                                                                |
| Repeats for each pixel | 8,192, with loops inside loops multiplied, through function calls |
| Saved shaders          | 40 for each site                                                  |

And the code can't use:

- `while`, `do` or `goto`. Use a `for` loop with a fixed number of steps that heads towards its
  end, such as `for (int i = 0; i < 32; i++)`. A loop's limit can be a plain number, or a
  `const` or `#define` that is one.
- Any `#` line except a number, such as `#define STEPS 32`.
- Pictures of its own. `below(uv)` is the only way to read anything.
- The names `time`, `resolution`, `pointer`, `scroll`, `uv` and `below`, which are provided, or
  anything starting `lintel` or `webgl_`.

## If a shader can't run

A shader never leaves a section broken. It shows its plain background instead (the `@fallback`
colour, which people can change as **Plain background**), and any other layers carry on, when:

- it doesn't compile on that device, or WebGL isn't there;
- it takes more than 40 ms on a tiny trial drawing before the first frame;
- it keeps taking more than 120 ms a frame, after being drawn smaller;
- the graphics card gave up on it. It then isn't tried again until the visitor's next visit.

The words are measured against whatever shows, so they stay readable.

People who ask for less motion get a single still frame.

## Slow shaders and frozen screens

Lintel can make a frozen graphics card unlikely, and recover from one, but can't rule it out.
WebGL has no way to cancel a drawing once it starts, and nothing can tell in advance how long a
shader will take. A shader within every limit above can still be too much for a weak phone. If
a drawing won't finish, only the browser or the operating system can stop it, which can take a
few seconds and may freeze the tab. Every shader effect on that page then stops until the
browser restores them.

So do a little less than you could:

- Test on the slowest phone you can find, not on your own computer.
- Keep loops short. Anything over about 64 steps deserves a second look.
- Draw soft shapes with maths rather than many small steps.
- Only give the code permission to people you trust.

The reasoning is in decision record 66 (`docs/decisions/0066-shader-studio.md`).
