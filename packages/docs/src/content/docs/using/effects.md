---
title: Effects
description: Adding effects like magnetic buttons, scrambled headlines and liquid backgrounds, and motion across the whole site.
since: "1.0"
sidebar:
  label: Effects
---

Effects are ready-made bits of life for your page: a button that leans towards the
pointer, a headline that scrambles into place, a card that tilts in 3D, a background of
flowing colour. There are over a hundred, and you add them without any code.

## Adding an effect

1. Select something on your page: a heading, a picture, a button or a whole section.
2. Open the **Animate** tab and choose **Effects**.
3. Move the pointer over a card (or tab to it) to try it. It plays on the card, and on your
   selected element on the page, so you see it on your own design.
4. Click a card to add it. Its settings appear under **On this element**, in plain words:
   "How strong", "Speed", "Marker colour".

The gallery only shows effects that suit what you selected. Untick **Only ones that suit
this element** to see every kind, or search: "carousel", "glow", "typing".

An element can have up to six effects, and an animation as well: a card can fade up as it
arrives _and_ tilt when the pointer is over it. A few effects, such as **Letters rise**,
are animations themselves. Adding one replaces the element's animation, and you can
fine-tune it on the **Animation** tab, with the timeline if you're a Designer.

## The kinds of effect

| Kind         | What it does                                                         | Try                       |
| ------------ | -------------------------------------------------------------------- | ------------------------- |
| Hover        | Responds to the pointer: pull, tilt, spotlight, glowing edges        | Magnetic pull, Tilt       |
| Text         | Scramble, typewriter, rotating words, counting up, marker highlights | Typing phrases, Count up  |
| Scroll       | Follows the scroll: lean with speed, reveals, parallax, sideways     | Circle reveal             |
| 3D           | Card stacks, a cylinder gallery, cover flow, flip cards              | Card stack, Flip on hover |
| Backgrounds  | Particles and flowing WebGL gradients, liquid pictures, frost, water | Liquid gradient           |
| Physics      | Drag and throw, springy switches and presses, pull to reveal         | Squishy press             |
| Shapes       | SVG line drawing, shape morphing, blobs and waves                    | Draw the lines            |
| Cursor       | A "View" label or a trail of sparkles over one element               | “View” cursor             |
| Marquee      | Endless rows that speed up when people scroll                        | Scroll-powered row        |
| Loaders      | Shimmers, spinners and notifications                                 | Loading shimmer           |
| Page changes | Morphing an element from one page to the next                        | Morph between pages       |

There are also ready-made animated elements in the Insert panel: **Magnetic button**,
**Card stack**, **3D gallery**, **Scrolling row**, **Counter row**, **Switch**, **Round
menu** and **Notification**. They start with their effects, which you can change or remove.

## Motion across the whole site

With nothing selected, the Animate tab shows **Motion across the site**:

- **Page transition**: fade, slide, wipe or zoom between pages of your site.
- **Cursor**: a dot, a ring or an inverting circle instead of the arrow, with an optional
  trail. Only for a mouse or trackpad; fields keep the normal cursor for typing.
- **Intro**: a curtain, a counter or your name, shown once per visit for at most three
  seconds. Visitors can skip it, and it never shows to anyone without JavaScript.

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
