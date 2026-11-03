# Motion panel

Everything that makes the selected element move, in one place. It replaces the builder's separate Animation and Effects tabs, which asked people to know the difference.

- **The list:** what the element has, its animation and its effects, each named by what it does and when it moves ("Scramble · When it appears"). Point at a row to watch it on the page.
- **Add motion:** choose _when_ first (Appears, Hover, Click, Scroll, Always), then pick from plain groups ("Words", "Depth and 3D"), or search everything at once. Only effects that suit the element are offered. Point at a choice to watch it on the page before adding it.
- **Editing:**
  - an animation opens in the studio's Simple view, with the timeline as "Advanced" when the host offers it;
  - an effect shows its settings in plain words.

`motionChoices.ts` holds the sorting: which moment and group every preset and effect belongs to. Page exits, cursors and page transitions are left out, because they belong to the whole site (`SiteMotionSettings`).

For now an element has one animation, so choosing another animation replaces it, and the panel says so. It can have up to `maxEffectsPerElement` effects.
