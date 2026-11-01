# Animate panel

**Animate**, beside Style and Content: the animation studio from `@lintel/motion-editor`
for the selected element. Choosing a preset or moving a slider saves the animation on the
element (`node.animation`: the spec and the preset it came from) as one undoable change,
and plays it on the canvas, on the real element, through the canvas frame's copy of the
motion runtime (`previewMotion` in `canvas/canvas-messages.ts`). Beginners get the gallery
and the Simple sliders; Designers and Developers also get the timeline.

On the published page the website loads the runtime only when the page has animations
(see `render/page-animations.ts` and `packages/core/src/website`).
