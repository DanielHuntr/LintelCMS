# 46. One builder for everyone, and one control for how things are arranged

Date: 2026-11-03

Fixes LINTEL-UX-060 and LINTEL-UX-061.

## The problem

The page builder had three skill levels (**Tools: Beginner / Designer / Developer**). Each
hid part of the builder: Beginners had no Advanced styles and no animation timeline, and only
Developers saw the Code tab. People had to know which level they were before they knew the
builder, the tour said different things to each, and a setting someone saw in a guide could
be missing from their screen.

Sections, boxes and containers also had two stacked controls for nearly the same question:
**Arrange → Place things: In order / On a grid / Anywhere** and **Layout → Arrange what's
inside: Stack / Row / Grid / Normal**. "Normal" meant nothing to most people.

## Decision

**One builder for everyone.** The skill levels, the Tools menu and the `skillLevel`
preference are gone. Everyone gets every setting; the builder stays calm by folding
things away rather than by hiding them per person:

- The Style panel keeps its **Simple / Advanced** switch, inside the panel. Simple shows
  the groups people change most (Layout, Spacing, Text open the first time); Advanced shows
  every property. We kept the switch rather than a "More options" link at the foot of each
  group because it is one control, at the top, that is already familiar, and it keeps
  Simple short.
- Animate's **Advanced** (the timeline) is always on offer.
- A stored `skillLevel` is ignored. No migration is needed: it lived only on the device.

**No Code tab.** The builder's Code tab (the HTML and CSS of the selection, editing an
element as HTML, converting to code and pasting HTML into a box) is removed. Developers work
on Liquid templates in their own editor with `lintel templates init` and `lintel templates
sync`. The **Code element** stays, gated by the `builder:code` permission as before: with
it, people can insert one and edit its HTML, CSS and JavaScript in **Content**. Pasting HTML
onto the page still makes elements.

**One tour.** Eight short steps: Insert (with navigation and footers) and Layers; selecting
and typing; Style and which look you're changing; Site styles and shared styles; Layout;
Animate and Add motion; screen sizes, Undo and History; Publish. It can be skipped and is
replayed from **Help and tips**. Deeper help is a first-time tip in Style and in Animate,
closed with **Got it** and brought back from Help and tips.

**One control for how things are arranged.** Layout has one choice, **How things are
arranged**: One under another, Side by side, On a grid, and (on sections, boxes and
containers) Anywhere. The details for the chosen one sit under it: where things sit and the
space between; wrapping for side by side; columns for a grid, and **Place each thing on the
grid yourself** for a placed grid (its columns and phone setting); for Anywhere, whether
phones put things one under another. Where an element sits inside its parent (its place on
a placed grid or in a free layout, and stacking) moves to its own group, **Where it sits**,
shown only when it applies.

Stored pages are read, not rewritten:

| Stored                              | Shows as                                       |
| ----------------------------------- | ---------------------------------------------- |
| `freeLayout`                        | Anywhere                                       |
| `placedGrid`                        | On a grid, with "Place each thing yourself" on |
| `display: grid` (or `inline-grid`)  | On a grid                                      |
| `display: flex`, direction row      | Side by side                                   |
| `display: flex`, otherwise          | One under another                              |
| no `display`, or `block` ("Normal") | One under another, left as it is               |
| anything else (`none`, inline, ...) | nothing chosen; Advanced shows the value       |

Block layout already puts things one under another, so it shows as that choice and nothing
is written until someone changes one of its details; then it becomes `display: flex;
flex-direction: column` with the change. Every existing page renders exactly as before.

## Consequences

- Fewer things to explain: guides and the tour describe one screen.
- People who used to be Beginners now see the Simple/Advanced switch and the timeline. Both
  start on their simpler view.
- Switching between Anywhere or a placed grid and the other arrangements is two steps in
  History (the layout, then the arrangement); undo takes them back one at a time.
- The developer folder (HTML view, HTML editing and convert-to-code) is deleted; the Code
  element's editor is in `packages/builder/src/code-block`.
