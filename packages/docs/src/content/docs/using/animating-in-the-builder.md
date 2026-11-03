---
title: Animating in the builder
description: Making parts of your page move, seeing it on the page as you go, and how your visitors see it.
since: "0.1"
sidebar:
  label: Animating in the builder
---

Any part of a page can move: a heading that rises into place as visitors scroll to it,
cards that arrive one after another, a button that presses in when it's clicked. You do
it all in the page builder, on your own page, without any code.

## Add an animation

1. Select what should move: click it on the page, or pick it in **Layers**. It can be a
   single heading or picture, or a whole section.
2. Open **Animate**, on the right.
3. Pick one of the ready-made animations. It plays straight away **on your page**, on the
   element you selected, so you see exactly what visitors will see.
4. Adjust it with the friendly sliders under **Speed and timing**: **Speed**, **Distance**,
   **Wait before starting** and, for groups of things, **Gap between items**. Each change
   plays on the page again. **When it plays** and **For less motion** sit in their own
   groups; a closed group says what's chosen in it.
5. Press **Play on the page** whenever you want to see it once more.

Animations are saved with the page, like any other change. **Undo** takes back an
animation too. To take one off, press **Remove animation**.

[Animating your pages](/using/animating/) describes every part of the animation studio,
including what starts an animation (scrolling to it, hovering, clicking and more).

## The timeline

Open an animation and choose **Advanced** for the timeline, where you can drag keyframes,
change the easing curve and build scroll scenes (see
[Getting around the builder](/using/getting-around-the-builder/)). The presets and sliders
in **Simple** are enough for almost everything.

## On your website

When you publish, the page moves exactly as it did in the builder.

- **Only pages that move load anything extra.** A page with animations loads one small
  file (about 8 kB) that plays them; a page without animations loads no script at all.
- **Nothing is hidden for good.** Things that animate in are hidden only until their
  animation is ready. If the script can't load, they appear anyway after a moment, and
  visitors without JavaScript see the page as designed.
- **People who prefer less motion are respected.** If a visitor has asked their phone or
  computer to reduce motion, they see what you chose under **For people who prefer less
  motion**: just a gentle fade (the default), the end straight away, or no animation.

## Tips for tasteful movement

- Animate the few things that matter: the main heading, a row of cards, the button you most
  want pressed. If everything moves, nothing stands out.
- Keep entrances short. Most of the ready-made ones take well under a second.
- Use **Wait before starting** to make things arrive in order: the heading first, then the
  words under it, then the button.
- The templates' pages already have gentle animations. Look at them in **Animate** for ideas.
