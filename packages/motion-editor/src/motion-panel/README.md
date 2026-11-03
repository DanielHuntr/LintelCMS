# Motion panel

Everything that makes the selected element move, in one place. It replaces the builder's separate Animation and Effects tabs, which asked people to know the difference.

- **The list:** what the element has, its animations and its effects, each named by what it does and when it moves ("Scramble · When it appears"). Point at a row to watch it on the page.
- **Add motion:** choose _when_ first (Appears, Hover, Click, Scroll, Always). That puts a good default on the element straight away and plays it on the page: a fade up, a lift, a press, a slow parallax or a gentle pulse. Under it:
  - a few small tiles (`QuickMotion.tsx`, `MotionTile.tsx`) for the main alternatives, each showing the movement itself as a tiny looping drawing (`motionDemos.ts`, plain CSS that stops for people who ask for less motion) with a one- or two-word name. The sentence about it is the tooltip and what screen readers hear;
  - the plain controls: how much, speed, feel (smooth or springy) and, for entrances, when it starts. Only the ones that mean something for the motion show;
  - "More settings" opens the full settings (Simple, and the timeline for designers);
  - "More effects…" opens the full catalogue: every preset and effect in plain groups ("Words", "Depth and 3D"), with search across all of them. Only effects that suit the element are offered. Point at a choice to watch it on the page before adding it. A choice made there takes the place of the default.
- **Choosing again** swaps the motion added on this screen rather than adding more; the moment picker and the tiles are radio groups, so the arrow keys move between them.
- **Editing:**
  - an animation opens in the studio's Simple view, with the timeline as "Advanced" when the host offers it;
  - an effect shows its settings in plain words.

`quickPicks.ts` says which tiles each moment offers (existing presets and animation effects only, so nothing new is saved: the element keeps an ordinary animation spec) and how the plain controls change the spec. Under "Click", eye-catchers that normally wait for a page event play on a click instead.

`motionChoices.ts` holds the sorting: which moment and group every preset and effect belongs to. Page exits, cursors and page transitions are left out, because they belong to the whole site (`SiteMotionSettings`).

An element can have up to six animations (an entrance, a hover, scroll steps...) and up to `maxEffectsPerElement` effects. Choosing an animation adds it; when the element has as many as it can take, the panel says so.
