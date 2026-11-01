# Studio

`MotionStudio.tsx` holds the views (Presets, Simple, Advanced), the undo history and the
keyboard shortcuts, validates every change with the schema and reports valid specs.
`studioState.ts` is what undo steps through: the spec, the preset's base spec and the Simple
sliders' adjustments to it. `StudioPreview.tsx` is the large preview with a reduced-motion switch.
