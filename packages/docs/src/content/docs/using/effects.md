---
title: Effects
description: Adding effects like magnetic buttons, scrambled headlines and liquid backgrounds, and motion across the whole site.
since: "1.0.0-rc"
sidebar:
  label: Effects
---

Effects are ready-made bits of life for your page: a button that leans towards the
pointer, a headline that scrambles into place, a card that tilts in 3D, a background of
flowing colour. There are over a hundred, and you add them without any code.

## Adding an effect

1. Select something on your page: a heading, a picture, a button or a whole section.
2. Open the **Animate** tab, press **Add motion**, then **More effects…**.
3. Move the pointer over a card (or tab to it) to try it. It plays on the card, and on your
   selected element on the page, so you see it on your own design.
4. Click a card to add it. Its settings appear under **On this element**, in plain words:
   "How strong", "Speed", "Marker colour".

The gallery only shows effects that suit what you selected. Untick **Only ones that suit
this element** to see every kind, or search: "carousel", "glow", "typing".

An element can have up to six effects and up to six animations: a card can fade up as it
arrives _and_ tilt when the pointer is over it. A few effects, such as **Letters rise**, are
animations themselves. Adding one adds an animation to the element, which you can fine-tune
in **More settings**, with the timeline under **Advanced**.

## The kinds of effect

| Kind         | What it does                                                         | Try                      |
| ------------ | -------------------------------------------------------------------- | ------------------------ |
| Hover        | Responds to the pointer: pull, tilt, spotlight, glowing edges        | Magnetic pull, Tilt      |
| Text         | Scramble, typewriter, rotating words, counting up, marker highlights | Typing phrases, Count up |
| Scroll       | Follows the scroll: lean with speed, reveals, parallax, sideways     | Circle reveal            |
| 3D           | Card stacks, galleries on a curve, depth on scroll, flip cards       | Arc carousel, Card stack |
| Backgrounds  | Particles and flowing WebGL gradients, liquid pictures, frost, water | Liquid gradient          |
| Physics      | Drag and throw, springy switches and presses, pull to reveal         | Squishy press            |
| Shapes       | SVG line drawing, shape morphing, blobs and waves                    | Draw the lines           |
| Cursor       | A "View" label or a trail of sparkles over one element               | “View” cursor            |
| Marquee      | Endless rows that speed up when people scroll                        | Scroll-powered row       |
| Loaders      | Shimmers, spinners and notifications                                 | Loading shimmer          |
| Page changes | Carrying a picture from one page to the next                         | Carry across pages       |

There are also ready-made animated elements in the Insert panel: **Magnetic button**,
**Card stack**, **3D gallery**, **Arc carousel**, **Scrolling row**, **Counter row**,
**Switch**, **Round menu** and **Notification**. They start with their effects, which you
can change or remove.

## 3D models

The **3D model** element in Insert shows a model like a picture. Choose a `.glb` file from
your media, or try one of the samples, then pick how it moves (it can spin, follow the
pointer, turn as people scroll or turn when dragged) and how it is lit. Describe it for
people who can't see it. Keep files under 10 MB so they load quickly on phones; 25 MB is the
most you can upload. A `.gltf` works if everything it needs is inside the one file. Models
compressed with Draco aren't supported, so export those without it.

Lintel takes a picture of the model for you. That picture is what the canvas shows, and what
visitors see while the model loads, if they ask for less motion, or if their device can't
draw 3D. If you change the light or background, press **Take a new picture**.

A page with a model downloads about 160 kB more, only when the model comes near the screen.

## Motion across the whole site

Smooth scrolling, the site's cursor, page transitions and an intro on the first visit are
set once for the whole site. See [Motion across the site](/using/site-motion/).

To carry a picture across, such as a project photo that grows into the project page's big
photo, give both the **Carry across pages** effect with the same name. It plays when a page
transition is chosen.

## Keeping pages quick

The meter at the top of the Effects tab adds up your page: "Effects: 3, adding 14.0 kB". A
page only downloads the code for the kinds of effect it uses, and each kind downloads once
however many elements use it. Pages without effects download none.

If you combine heavy effects (several WebGL backgrounds on one page, say), the meter warns
you in plain words. Effects pause when they're off screen, and phones get lighter versions.

## Everyone sees something good

- **Less motion.** People who ask their device for less motion get a calm version of every
  effect: things stay still, show their finished state or fade gently. Each effect's
  settings say what its calm version is.
- **Keyboard and touch.** Effects that answer the pointer also answer keyboard focus (a
  card tilts up, a light shows), and stacks, galleries and switches work with the arrow
  keys, Enter and Space. Touch works like a mouse.
- **Screen readers** hear your words once, as written, never letter by letter, and the
  extra copies a marquee needs are hidden from them.
- **No JavaScript.** Your content is in the page as you wrote it. Effects only add to it.
