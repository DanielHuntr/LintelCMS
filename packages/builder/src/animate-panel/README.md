# Animate panel

**Animate**, beside Style and Content: the animation studio from `@lintel/motion-editor`
for the selected element. Choosing a preset or moving a slider saves the animation on the
element (`node.animation`: the spec and the preset it came from) as one undoable change,
and plays it on the canvas, on the real element, through the canvas frame's copy of the
motion runtime (`previewMotion` in `canvas/canvas-messages.ts`). Beginners get the gallery
and the Simple sliders; Designers and Developers also get the timeline.

On the published page the website loads the runtime only when the page has animations
(see `render/page-animations.ts` and `packages/core/src/website`).

Simple's settings sit in three collapsible groups: **When it plays** and **Speed and timing**
open, **For less motion** closed, saying what's chosen. The builder passes the studio an
`openGroups` that remembers them (`animate.open`).

## Effects

The panel's second tab, **Effects**, is `EffectsPanel` from `@lintel/motion-editor`: the
element's effects (`node.effects`, saved by `changeEffects` in `editor/commands.ts`) with
their settings, and the gallery. `element-kinds.ts` says what kind each component is, for
"Suits this element". Trying an effect posts `previewEffect` to the canvas, which imports
the module from the addresses the host passes as `effectModules`. "Animation" effects are
saved as one of the element's animations instead. With nothing selected, the tab shows the
site-wide `SiteMotionSettings` when the host passes `siteEffects`. The meter adds up every
effect on the page with `measurePageWeight`.

## When the pointer is over it

Below the Motion panel, `PointerFields` offers one choice list, **What happens**: Nothing
changes, A word on the cursor (View, Open, Drag, Play, Read or your own, with **Change its
look** folded away), A picture follows it, The cursor grows, The cursor becomes a picture
(with its size and where it points), The cursor hides, or The normal pointer. Only the
chosen option's fields show. They are saved as the element's `cursor-word`,
`hover-picture` or `cursor-over` effects (`listed: false` in `@lintel/motion/effects`, so
the gallery and the Motion panel's list leave them out), which means a page loads their
code only when one of its elements uses them. All are for a mouse or trackpad only.

`cursor-colours.ts` offers the site's own colours, then the theme's, as swatches for the
word's look; `SiteMotionSettingsWithColours` passes them to the site-wide settings too. See
`docs/decisions/0047-designing-the-cursor.md`.
