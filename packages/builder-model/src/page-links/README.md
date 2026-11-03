# Page links

Links to a page of the site are stored as the page, not its address: `lintel:page/<entry id>`.
"Choose a page…" (rich text, Link fields and the builder's link inputs) stores this form, and
Lintel puts the page's current address in its place wherever the link is drawn, so moving
or renaming a page never breaks a link to it. Typed addresses are left as they are.

| File            | What it does                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| `page-links.ts` | The stored form, the pages a value links to, and swapping them for addresses |

Core resolves them for websites and the delivery API (`packages/core/src/page-links`). The
reasoning is in `docs/decisions/0032-links-to-pages-by-id.md`.
