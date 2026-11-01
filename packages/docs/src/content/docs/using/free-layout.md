---
title: Free layout
description: Placing things anywhere in a section, overlapping, with snapping, guides and stacking, and keeping it working on phones.
since: "0.1"
sidebar:
  label: Free layout
---

Most sections arrange what's inside them for you: one under another, side by side, or in a
grid. A **free layout** lets you put things anywhere in the section instead, even over each
other, like a poster: a photo between two giant words, a sticker across a picture.

## Switching it on

1. Select a section (or a box) and open **Arrange** in **Style**.
2. Tick **Free layout: place things anywhere**. The section gets room, and anything inside
   that hasn't got a place is fanned out so nothing hides behind something else.

## Placing things

- **Drag** anything in the section to move it. Near the section's edges or middle, or lined
  up with another element, it snaps into place and a pink guide line shows what it lined up
  with. Hold **Alt** while dragging to place it freely.
- **Nudge** it with the arrow keys after clicking it on the page; hold **Shift** to move
  10 pixels at a time.
- In **Arrange**, **From the left**, **From the top** and **Width** show and set its place
  exactly. Places are percentages of the section, so the design scales with the screen.
- **To the front**, **Forward**, **Back** and **To the back** decide what's in front when
  things overlap. The shortcuts are **Ctrl** (or **⌘**) with **]** and **[**, and with
  **Shift** for all the way.

Places are kept per screen size like any other style: choose **Tablet** at the top and drag
things to where they look best on a tablet.

## On phones

**Put things one under another on phones** is on to start with: on phones, everything in the
section stacks in the order it has in **Layers**, which is what most free layouts need. Turn
it off to place things by hand at phone size too.

## Reading order

Wherever things sit on screen, screen readers and keyboards go through them in the order
they have in **Layers**. Arrange that order to make sense when read from top to bottom, and
use **To the front** and **To the back** (not the order in Layers) for what overlaps what.

## How it works

The section is `position: relative` and the things in it are `position: absolute`, with
`left`, `top` and `width` in percent and `z-index` for what's in front. On phones, with
stacking on, they go back to normal flow in a column. It's ordinary CSS, so developers can
read and change it in the **Code** panel.
