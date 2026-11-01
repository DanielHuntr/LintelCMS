# Tour and tips

- `GuidedTour.tsx`: the first-time tour (select, edit text, style, insert, animate, tools,
  publish). A non-modal dialog that points at each part of the screen (`tour-steps.ts`
  lists the steps and their CSS selectors; the host's Publish button has
  `data-tour="publish"`). Focus moves to each step's title; Escape or Skip ends it. It
  shows once per device, and **Help and tips** replays it.
- `Tip.tsx` and `useTips.ts`: short tips in the panels that can be closed and brought back.
- `HelpMenu.tsx`: **Help and tips** in the toolbar.
