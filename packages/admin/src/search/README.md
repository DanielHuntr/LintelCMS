# Search

The command palette: one search for the whole admin, opened with Cmd+K (Ctrl+K on Windows
and Linux) or the Search button at the top of the sidebar. It is mounted once, in
`src/layout/AdminLayout.tsx`.

- "Go to" lists the admin's own pages as you type, straight away: the sidebar sections the
  person may see (`visibleSections`), settings screens that aren't in the sidebar, and each
  collection. `paletteItems.ts` holds that list and the matching (every word typed has to
  start a word: "con ty" finds "Content types").
- "Actions" lists things to do that match what was typed (`paletteActions.ts`): "New page",
  "New entry in <collection>", "Upload media", "Open Settings", "Open Build", "Invite
  someone", "Switch to dark mode" (or light, and "Match my device’s light or dark setting"
  once someone chose) and "Sign out". Each has a few other words it answers to ("log out",
  "theme"), and shows only when the person may do it, by the same permissions as the screens
  it leads to. Upload and Invite open their screens with `?upload=true` and `?invite=true`,
  which open the file chooser and the invitation straight away. The scheme is
  `src/appearance`. Rows come in this order: places to go, actions, then content and media;
  a "Go to" row that leads where an action does ("Settings") is left out.
- Content and Media come from `GET /search` (core's `src/search`), asked for 150ms after
  typing pauses. The API only searches what the person may see.
- Picking an entry opens the editor; picking a file opens it in the media library
  (`/media?asset=<id>&search=<file name>`).

It follows the ARIA combobox pattern: focus stays in the text box, the arrow keys move the
highlighted option (`aria-activedescendant`), Enter opens it, Escape closes the palette and
focus goes back where it was. The line at the bottom says how many results there are, for
screen readers too.
