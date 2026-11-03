---
title: Animating your pages
description: Making things fade, slide and move with ready-made animations, and fine-tuning them.
since: "0.1"
sidebar:
  label: Animation
---

Lintel's animation studio lets you add movement to any part of a page: a heading that
rises into place as you scroll to it, cards that lift when the pointer is over them, a
bar that fills as the reader moves down the page. You don't need to know any code, and
every animation already works for people who prefer less motion.

You'll find the studio in the page builder: select something on the page, open
**Animate**, press **Add motion** and choose a moment, then **More settings**.
[Animating in the builder](/using/animating-in-the-builder/) shows the quicker way most
people add motion. How one page gives way to the next is set once for the site: see
[Motion across the site](/using/site-motion/).

## Start from a preset

The studio opens on **Presets**: more than forty ready-made animations, each with a short
description. Move the pointer over one, or move to it with the Tab key, and its preview
plays.

Use the buttons along the top to see one kind at a time:

| Kind                | What it's for                                                         |
| ------------------- | --------------------------------------------------------------------- |
| **Entrances**       | How something arrives as it scrolls into view: fades, slides, reveals |
| **Scroll**          | Movement that follows the scroll position, forwards and backwards     |
| **Hover**           | Small responses to the pointer, so things feel clickable              |
| **Attention**       | A brief pulse or shake to draw the eye after something happens        |
| **Section reveals** | How sections open and uncover                                         |

Choose one and the studio switches to **Simple**.

## Adjust it in Simple

Simple shows the preset you picked, a preview and a few sliders:

- **Starts when** says what plays the animation, in plain words: _It scrolls into view_,
  _The page opens_, _The pointer is over it_, _It's clicked_ and so on.
- **Speed** makes it slower or faster than the preset.
- **Distance** makes the movement subtler or more dramatic. It only appears when the
  animation moves something.
- **Wait before starting** adds a pause, handy for making things arrive one after another.
- **Gap between items** appears for animations that move several things, such as each word
  of a heading or each card in a row.

Press **Replay** to see it again. The sliders always start from the preset, so you can't
drift too far: drag back to the middle and you're back where you started.

## People who prefer less motion

Some people set their phone or computer to reduce motion, because movement on screen can
make them feel unwell. Lintel respects that setting for every animation. Under **For
people who prefer less motion** you choose what they see instead:

- **Just fade** keeps fades and colour changes and leaves out any movement. The default.
- **Show the end straight away** skips to how things look once the animation has finished.
- **Don't animate** leaves the element exactly as you designed it. Best for decoration.

To check, tick **Preview with reduced motion** under the preview.

## Fine-tune in Advanced

**Advanced** opens the timeline, for when you want full control. Each row is one thing
that changes, such as **Fade**, **Move down** or **Blur**, and each diamond on a row is a
_keyframe_: a moment where that thing has a value you chose.

- Drag a diamond to change when it happens, or select it and use the arrow keys (hold
  Shift to move further).
- Double-click a row to add a keyframe, or press **+** beside its name to add one where
  the playhead is.
- Select a keyframe to change its value and how it eases into the next one.
- Drag along the ruler, or press **Play**, to watch any moment in the preview. Hold Ctrl
  (Cmd on a Mac) and scroll to zoom in.
- **Add a property** adds another row.

Below the timeline you'll find the trigger, what moves (the whole element, each item
inside it, or each word or letter of its text), timing and repeats.

### Easing

Easing is how a change speeds up and slows down. Real things rarely move at a steady
speed, so easing is what makes an animation feel natural. Pick a named curve such as
**Slow down** or **Overshoot, then settle**, drag the handles of your own **Curve**, or
choose **Spring** for movement that settles like a real object. A spring shows how long it
takes to settle; press **Use this as the length** to match the animation to it.

### Scroll scenes

When an animation follows the scroll position, the studio draws the screen with a green
**Start** line and a red **End** line. The animation runs from "this part of the element
reaches this part of the screen" to another such moment. Drag the lines, or use the
sliders beside them.

**Hold it on screen while scrolling** keeps the section in place while the page scrolls
past, for sticky reveals and sections that scroll sideways.

## Undo

Every change can be undone with the arrow buttons at the top right, or with Ctrl+Z
(Cmd+Z on a Mac). Ctrl+Y or Shift+Cmd+Z redoes.

## Good habits

- Animate a few things well rather than everything. Movement should point to what matters.
- Keep entrances short: under a second for most things.
- Use **Attention** presets only after something has happened, such as an item going into
  the cart.
