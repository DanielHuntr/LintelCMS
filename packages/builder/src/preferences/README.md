# Preferences

What the builder remembers about the person using it, on their device: `skillLevel`,
`tourSeen`, `dismissedTips`, and how they left the panels: which Insert segment they use
(`insert.kind`), what they inserted recently (`insert.recent`), and which collapsible groups
are open (`insert.sectionGroups.open`, `insert.elements.open`, `style.simple.open`,
`style.advanced.lastUsed`, `content.open`, `animate.open`).

`browserPreferenceStore` keeps them in local storage (prefixed `lintel.builder.`);
`createMemoryPreferenceStore` is for tests. Hosts can pass their own store to `PageBuilder` as
`preferences`; panels read it through `usePreferenceStore()`.

`open-sections.ts` has the two ways a panel remembers its groups:

- `useRememberedOpenSections`: what was left open is open next time (Insert, Simple styles,
  Content, Animate), starting from a few sensible defaults.
- `useLastUsedOpenSections`: everything starts closed except the group used last (Advanced
  styles, where there are many).
