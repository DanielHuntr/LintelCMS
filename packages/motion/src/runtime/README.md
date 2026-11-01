# Runtime

`mountMotion.ts` is the entry point: it reduces the spec if needed, resolves targets, creates
the animations (`createAnimations.ts`) and attaches the trigger, and rebuilds everything when
the device's reduced-motion setting changes. `playback.ts` controls a set of animations as one.
`environment.ts` checks what the browser can do without touching the DOM on import.
`scrollScene.ts` is the maths of scroll markers and pinning. `mountMotionList.ts` mounts a whole
page by node id; `cloak.ts` is the CSS that avoids a flash before scripts run.
