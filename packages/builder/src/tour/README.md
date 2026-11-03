# Tour and tips

- `GuidedTour.tsx`: the first-time tour, the same for everyone, eight steps: Insert and
  Layers, the canvas (select and type), Style and which look, Site styles and shared styles,
  Layout, Animate, screen sizes and History, Publish and View page. Each step dims the screen except
  its part (a spotlight) and explains it in a modal card with Next, Back, Skip and a row of
  progress dots. Focus moves to each step's title and stays in the card; Escape or Skip ends
  it and focus goes back. Movement is for people who haven't asked for less.
- `tour-steps.ts`: the steps, their CSS selectors (`data-tour="..."` on the screen-size
  switcher, History, the right panel and the empty page or canvas; the host puts
  `data-tour="publish"` around Publish and View page). Also where the card goes
  (`placeCard`).
- The tour shows once per person on their device (`tourSeen` in `preferences/`; Lintel has
  no server-side preferences yet), and **Help and tips** replays it.
- `Tip.tsx` and `useTips.ts`: short tips in the panels that can be closed and brought back:
  `styleHowTo` and `animateHowTo` show the first time Style and Animate open.
- `HelpMenu.tsx`: **Help and tips** in the toolbar.
