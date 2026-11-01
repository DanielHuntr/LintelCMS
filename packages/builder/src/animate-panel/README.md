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
saved as the element's animation instead. With nothing selected, the tab shows the
site-wide `SiteMotionSettings` when the host passes `siteEffects`. The meter adds up every
effect on the page with `measurePageWeight`.
