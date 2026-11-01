# Timeline

The Advanced view. `TimelineEditor.tsx` lays out the ruler (`TimeRuler.tsx`, with the playhead
slider) and a row per track (`TrackRow.tsx`, with draggable, keyboard-movable keyframes).
`KeyframeInspector.tsx` edits the selected keyframe; `AnimationSettings.tsx` the whole
animation. Every change goes through the pure functions in `editSpec.ts`.
