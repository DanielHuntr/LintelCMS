---
title: Animation spec reference
description: The JSON animation spec, the runtime that plays it, and the presets library.
since: "0.1"
sidebar:
  label: Animation spec
---

Animations are plain JSON, so the builder can save them with a page and a site can play
them without a framework. Three packages are involved:

| Package                  | What it is                                                                      |
| ------------------------ | ------------------------------------------------------------------------------- |
| `@lintel/motion`         | The runtime: plays specs in the browser. No dependencies, safe to import in SSR |
| `@lintel/motion/schema`  | Zod schemas for validating specs on the server, and `defineMotion()`            |
| `@lintel/motion/presets` | The preset library: 42 specs with names, descriptions and preview samples       |
| `@lintel/motion-editor`  | The React studio the builder embeds                                             |

Why it works the way it does is in decision record 11 (`docs/decisions/0018-animation-runtime.md`).

## Playing an animation

```ts
import { mountMotion, mountMotionList, motionCloakCss } from "@lintel/motion";

// One element:
const controller = mountMotion(document.querySelector("#hero")!, spec);

// Everything on a page, as the builder saves it: elements found by data-node-id.
const page = mountMotionList([{ nodeId: "hero", spec }]);
await page.exitPage(); // plays page-exit animations, then resolves
```

`mountMotion` returns a controller with `play()`, `reverse()`, `pause()`, `restart()`,
`seek(progress)`, `finish()`, `reset()`, `finished()`, `exit()` and `destroy()`. Options:

| Option          | Default          | Meaning                                                               |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| `reducedMotion` | `"auto"`         | `"auto"` follows the device; `"reduce"` or `"no-preference"` force it |
| `nodeAttribute` | `"data-node-id"` | The attribute that holds a builder node's id                          |
| `mode`          | `"auto"`         | `"manual"` listens to nothing, for previews that play and seek        |

On the server, or in a browser without the Web Animations API, mounting does nothing and
the page shows its content as styled.

### Avoiding a flash before scripts run

Elements that fade in would otherwise show for a moment before the runtime hides them.
Put `motionCloakCss` in a `<style>` in the page head and `data-motion-cloak` on those
elements. They start hidden only when scripts are enabled and motion is allowed, the
runtime removes the attribute once the first frame is in place, and if the script never
arrives they show after two seconds anyway.

## The spec

In a page design, an element keeps its animations as a list, up to six:
`"animations": [{ "spec": {...}, "presetId": "fade-up" }]`. It can fade up as it appears
and lift on hover. Pages saved before page version 2 had one, `animation`; they're
migrated when read.

Times are in milliseconds. Every field except `trigger` and `tracks` has a default, filled
in by the schema, so a stored spec is always complete.

```json
{
  "version": 1,
  "trigger": { "type": "inView", "threshold": 0.2 },
  "targets": { "type": "text", "split": "words" },
  "stagger": { "each": 70, "from": "first" },
  "duration": 700,
  "delay": 0,
  "repeat": { "times": 0, "yoyo": false },
  "easing": "easeOutCubic",
  "reducedMotion": "fade",
  "tracks": [
    {
      "property": "opacity",
      "keyframes": [
        { "offset": 0, "value": 0 },
        { "offset": 1, "value": 1 }
      ]
    },
    {
      "property": "translateY",
      "keyframes": [
        { "offset": 0, "value": "0.6em" },
        { "offset": 1, "value": 0 }
      ]
    }
  ]
}
```

| Field           | Default                      | Meaning                                                          |
| --------------- | ---------------------------- | ---------------------------------------------------------------- |
| `trigger`       | required                     | What starts it (see below)                                       |
| `targets`       | `{ "type": "self" }`         | What moves (see below)                                           |
| `stagger`       | `{ each: 0, from: "first" }` | With several targets, each starts `each` ms after the one before |
| `duration`      | `600`                        | Length of one play                                               |
| `delay`         | `0`                          | Wait before the first target starts                              |
| `repeat`        | `{ times: 0, yoyo: false }`  | Extra plays (`"forever"` allowed); `yoyo` alternates direction   |
| `easing`        | `"easeOut"`                  | Easing for every keyframe that doesn't set its own               |
| `tracks`        | required, 1 to 24            | One per property; keyframes at `offset` 0 to 1 of `duration`     |
| `reducedMotion` | `"fade"`                     | `"none"`, `"fade"` or `"instant"` (see below)                    |

`stagger.from` is `first`, `last`, `center`, `edges` or `random` (shuffled the same way
every time, so previews and pages match).

### Triggers

| `type`     | Options (defaults)                                                               | Plays                                                       |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `load`     |                                                                                  | As soon as it mounts                                        |
| `inView`   | `threshold` (0.25), `rootMargin` ("0px"), `onLeave` ("stay")                     | When that share of it (or of the screen, if taller) shows   |
| `scroll`   | `scope` ("element"), `start`, `end`, `pin`, `smooth`, `snap`, `follows`, `range` | Follows the scroll position                                 |
| `hover`    | `onLeave` ("reverse")                                                            | While the pointer is over it                                |
| `click`    | `toggle` (false)                                                                 | On each click; with `toggle`, alternately forwards and back |
| `focus`    | `onLeave` ("reverse")                                                            | While focus is inside it                                    |
| `pointer`  | `smoothing` (0.85)                                                               | Follows the pointer across the element                      |
| `event`    | `name` (required), `listenOn` ("document")                                       | When `new CustomEvent(name)` is dispatched                  |
| `pageExit` |                                                                                  | When `controller.exit()` or `page.exitPage()` is called     |

`onLeave` is `stay`, `reverse` or `reset`. For an action per direction, as on long scroll
stories, give `actions` instead: `{ "enter": "play", "leave": "none", "enterBack": "none",
"leaveBack": "reverse" }` plays on the way down and reverses when people scroll back up
above it. Each is `play`, `reverse`, `restart`, `reset`, `pause`, `resume`, `finish` or
`none`. An `inView` animation only counts as left once
it is fully off screen, so it doesn't flicker at the edge.

**Scroll scenes.** `start` and `end` are markers: `{ "element": 0, "viewport": 1 }` means
"the element's top reaches the bottom of the screen". The default scene runs from the
element entering at the bottom to leaving at the top. With `scope: "page"` the scene is
the whole page, top to bottom. `pin: { "length": 2 }` makes the element two screens taller
and keeps its first child stuck to the top while the page scrolls through it; the scene
then runs while it is stuck. Scroll scenes can't repeat.

`smooth` (0 to 2 seconds, 0 by default) makes the scene follow a moment behind the
scrolling and ease after it, rather than tracking it exactly. `snap` is a list of points in
the scene, such as `[0, 0.5, 1]`: when scrolling stops, the scene settles on the nearest one,
so it rests on a step rather than halfway through. Snapping moves the scene, never the page.
Scenes with either are run by Lintel rather than the browser's own scroll timelines.

**Steps in a scene.** `follows` makes a scroll animation follow another element's scroll,
by node id, instead of its own: a step in that element's scene. `range` plays it over only
part of the scene, so several elements can take turns: `{ "follows": "story", "range":
{ "from": 0.5, "to": 1 } }` plays in the second half of the Story section's scene. The
markers are read on the followed element, and the followed element holds itself on screen
if it's pinned. On the website the followed element carries its `data-node-id`, so the step
can find it.

**Pointer.** Each track says which way it follows with `"input": "x"` or `"y"`: offset 0
is the element's left (or top) edge and 1 its right (or bottom). When the pointer leaves,
everything eases back to the middle. Pointer tracks must be numeric.

### Targets

| `type`     | Fields                 | Moves                                                                                   |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `self`     |                        | The element itself                                                                      |
| `children` |                        | Each direct child                                                                       |
| `selector` | `selector`             | Matches inside the element (`:scope > *` works)                                         |
| `nodes`    | `nodeIds`              | Other builder nodes anywhere on the page                                                |
| `text`     | `split`: words/letters | Each word or letter; inline markup is kept, and screen readers still hear the text once |

### Properties

Only properties the browser can animate without laying out the page again are allowed.

| Property                                                  | Unit for bare numbers                  | CSS written         |
| --------------------------------------------------------- | -------------------------------------- | ------------------- |
| `opacity`                                                 | none                                   | `opacity`           |
| `translateX`, `translateY`, `translateZ`                  | `px` (or `%`, `em`, `rem`, `vw`, `vh`) | `translate`         |
| `scale`, `scaleX`, `scaleY`                               | none                                   | `scale`             |
| `rotate`                                                  | `deg` (or `turn`, `rad`)               | `rotate`            |
| `perspective`, `rotateX`, `rotateY`, `skewX`, `skewY`     | `px` / `deg`                           | `transform`         |
| `blur`, `brightness`, `contrast`, `saturate`, `grayscale` | `px` / none                            | `filter`            |
| `clipPath`                                                | text                                   | `clip-path`         |
| `color`, `backgroundColor`, `borderColor`                 | text                                   | the colour property |
| `--any-name`                                              | text                                   | the CSS variable    |

A track's numeric values must use one unit (zero can be bare). CSS variables blend
smoothly if the track gives `variableSyntax` (for example `"<percentage>"`); the runtime
registers them with `CSS.registerProperty`. Otherwise they switch halfway.

When several tracks write one CSS property (translateX and translateY both write
`translate`) and their keyframes don't line up, the runtime samples them together at 30
steps, because a keyframe's easing in CSS applies to the whole keyframe.

### Easing

```json
"easeOutBack"
{ "type": "cubicBezier", "x1": 0.2, "y1": 1.4, "x2": 0.3, "y2": 1 }
{ "type": "spring", "stiffness": 170, "damping": 26, "mass": 1 }
{ "type": "steps", "count": 4, "position": "end" }
```

Named curves: `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, and `easeIn` / `easeOut` /
`easeInOut` + `Sine`, `Cubic`, `Quint`, `Expo` or `Back`. A keyframe's `easing` applies from
it to the next keyframe. Springs are stretched over the segment they ease and play as CSS
`linear()`; browsers without `linear()` get the closest cubic Bézier. `settleDurationOf()`
gives a spring's natural length.

### Reduced motion

| Value     | What people who prefer less motion get                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `none`    | Nothing: the element is left as styled                                                                                          |
| `fade`    | Only `opacity` and colour tracks, at most 400 ms, played once. Entrances and page exits with nothing calm left get a plain fade |
| `instant` | Everything jumps to its end. Scroll scenes show their end once                                                                  |

Pointer animations never run with reduced motion. The runtime follows the device's
setting while the page is open. `reduceMotion(spec)` returns what will play.

## Validating on the server

```ts
import { defineMotion, motionSpecSchema } from "@lintel/motion/schema";

const result = motionSpecSchema.safeParse(request.body.animation);
if (!result.success) return reply.code(400).send(result.error.issues);
```

The schema checks property names, units, keyframe order, one track per property, pointer
tracks having an `input`, and scroll scenes not repeating, with messages an editor can read.

## Presets

```ts
import { motionPresets, findPreset, presetsIn } from "@lintel/motion/presets";

findPreset("fade-up")?.spec;
```

Each preset has `id`, `name`, `description`, `category` (`entrance`, `scroll`, `hover`,
`attention` or `transition`), `preview.sample` (the stand-in the gallery animates) and a
complete `spec`. Presets are validated when the module loads, and the tests check every
one plays and reduces.

## Embedding the studio

```tsx
import { MotionStudio, motionEditorStrings } from "@lintel/motion-editor";

<MotionStudio
  initialSpec={spec}
  initialPresetId="fade-up"
  onChange={(spec, presetId) => save(spec, presetId)}
  translate={t}
/>;
```

`onChange` is only called with valid specs. The studio's text comes from
`motionEditorStrings`, which the admin spreads into its own strings, so passing the admin's
`t` translates it. Its components use the admin's Tailwind tokens; the admin's `styles.css`
includes the package with `@source`. `/design-system/motion` in a development admin shows
the studio next to a live element and presets on a scrolling page.
