# @lintel/motion-editor

The animation studio, as React components the page builder embeds: a preset gallery with
live previews, a Simple panel of friendly sliders, and an Advanced timeline with draggable
keyframes, a zoomable ruler, a scrubbing playhead, an easing editor (curves, presets,
springs, steps), a trigger picker and a scroll-scene editor. Undo and redo cover every change,
and everything works by keyboard.

```tsx
import { MotionStudio } from "@lintel/motion-editor";

<MotionStudio initialSpec={spec} initialPresetId="fade-up" onChange={save} translate={t} />;
```

- `onChange(spec, presetId)` is called with every valid change. Invalid states (such as an
  empty list of element ids) show a message instead.
- Text comes from `motionEditorStrings`; pass the host's `translate` to use its own copy.
  The admin spreads these strings into `packages/admin/src/i18n/strings.ts`.
- Styles are Tailwind classes using the admin's tokens, so a host must include
  `packages/motion-editor/src` in its Tailwind sources (the admin's `styles.css` does, with `@source`).
- Previews mount the runtime in manual mode and follow reduced motion.

Try it at `/design-system/motion` in a development admin.

## Where things live

| Folder              | What it does                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `src/studio`        | `MotionStudio`: the views, undo and redo, the preview stage                |
| `src/gallery`       | The preset gallery and its cards                                           |
| `src/simple`        | The Simple panel and the sliders' maths (`adjustSpec.ts`)                  |
| `src/timeline`      | The timeline, inspector, settings and the pure edits (`editSpec.ts`)       |
| `src/easing-editor` | Curve, spring and steps editors                                            |
| `src/trigger`       | The trigger picker and the scroll-scene editor                             |
| `src/preview`       | Sample elements and the hook that plays a spec on them                     |
| `src/history`       | Undo and redo, as a pure reducer                                           |
| `src/controls`      | The few base controls the studio needs, matching the admin's design system |
| `src/strings`       | Every word the studio shows, and the translate context                     |
| `src/testing`       | Test setup: stand-ins for what jsdom lacks                                 |
| `src/browser-tests` | Pointer drags and scrubbing in a real Chromium, through Playwright         |

## Effects

`src/effects` holds the Effects tab: `EffectsPanel`, `EffectsGallery`, `PageWeightMeter` and
`SiteMotionSettings`. See its README.
