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
| Page changes | Carrying a picture from one page to the next                         | Carry across pages        |

There are also ready-made animated elements in the Insert panel: **Magnetic button**,
**Card stack**, **3D gallery**, **Scrolling row**, **Counter row**, **Switch**, **Round
menu** and **Notification**. They start with their effects, which you can change or remove.

## Moving backgrounds and picture effects

Select a section, choose **Add motion**, then **Always**: the tiles are quiet moving
backgrounds. **Gradient** drifts two soft colours over the section, **Soft light** is like
sunlight on the bottom of a pool, **Dust** floats specks through the light (best on a dark
section), **Contours** draws a map's contour lines, and **Grain** lays film grain over it.
Each has only a few settings: its colours, its speed and how much. The colours offer your
site's colours first, so the background changes when Site styles do; dust and lines can be
**Same as the words**.

**Keep words readable** (on by default) checks the colour of the words in the section and,
only if they would be hard to read over the background, lays a quiet veil just strong
enough behind them.

For a picture, **Appears** offers **Develop** (it develops out of soft noise as it comes into
view) and **Pixelate** (it sharpens from big blocks), and **Hover** offers **Liquid**,
**Colour split** and **Lens**.

Without WebGL, and for people who ask for less motion, sections show a still version and
pictures show as they are.

## Playful elements

- **Text on a path** puts words around a circle, like a sticker, or along an arc or a
  wave. It takes its font, colour and size from the text's style, so it follows your site's
  text styles; a bigger text size makes a bigger badge. A circle badge can turn slowly or as
  people scroll, and stays still for people who ask for less motion. Screen readers read the
  words once, as ordinary text.
- **Lottie animation** and **Rive animation** play a file from your media library: a
  Lottie `.json` or `.lottie`, or a Rive `.riv`. Upload one in the element's Content panel;
  until you do, it plays a small sample so you can see how it works. Choose when it plays
  (when it comes into view, as soon as the page opens, and for Lottie also while the pointer
  is over it or as people scroll). A Rive animation can respond to the pointer or a click by
  switching its state machine's input. Add a still picture under More options: it shows
  before the animation loads and, instead of the animation, for people who ask for less
  motion. Describe what it shows for screen readers, or leave it empty if it's decoration.
- **Sticker playground** is a box of stickers and badges visitors can pick up and throw;
  they bump into each other and stay inside the box. Put anything inside it. Its **Drag and
  throw these** effect (also in the gallery for any container) chooses how things move:
  float and drift, fall into a pile, or bouncy, and can show a **Tidy up** button. People
  using a keyboard move the focused sticker with the arrow keys. A finger swipe on the
  box's empty space still scrolls the page. Everything goes back to its place when the page
  is opened again, and stays where you put it for people who ask for less motion.

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
