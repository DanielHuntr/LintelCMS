# Triggers

`attachTrigger.ts` is the one list of triggers. Each file wires one kind to a playback:
`interactionTriggers.ts` (load, hover, click, focus, custom events, page exit),
`inViewTrigger.ts` (IntersectionObserver), `scrollTrigger.ts` (scroll-driven animations, or a
read-then-write fallback) and `pointerTrigger.ts` (follows the pointer, writing styles once per
frame). Manual mode, used by editor previews, listens to nothing.
