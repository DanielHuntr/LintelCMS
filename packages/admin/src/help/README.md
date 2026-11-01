# Help

The "?" button at the top right of every admin screen, the help panel it opens, and the
Help section (`/help`). The pages are the "Using Lintel" docs from `packages/docs`, bundled
into the admin at build time through `@lintel/docs/help`, so help works without an internet
connection and never disagrees with the docs.

| File                    | What it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `HelpLauncher.tsx`      | The "?" button; loads the panel lazily and preloads it when idle    |
| `HelpPanel.tsx`         | The panel beside the page: back, all topics, link to the full docs  |
| `HelpArticle.tsx`       | One page's HTML; links to other help pages open in place            |
| `HelpTopicList.tsx`     | Every help page, in the docs' order                                 |
| `HelpPage.tsx`          | The Help section; the open topic is in the address (`?topic=`)      |
| `helpTopics.ts`         | Which page each screen opens                                        |
| `renderHelpMarkdown.ts` | Markdown to HTML: in-panel links, bundled screenshots, heading ids  |
| `docsLinks.ts`          | Links to the full docs (`VITE_DOCS_URL`, or the Markdown on GitHub) |
| `helpArticle.css`       | Reading styles for the rendered Markdown, from the design tokens    |

## Adding a screen

Add its address to `helpTopics.ts`, pointing at the docs page that explains it (write one in
`packages/docs/src/content/docs/using` if there isn't one). `helpTopics.test.ts` fails if a
topic points at a page that doesn't exist.

## Accessibility

The panel isn't modal, so people can read and keep working. It is a labelled
`complementary` region; opening it, or a new page in it, moves focus to the page's
heading. Escape closes it and puts focus back on the "?" button, which says whether the
panel is open (`aria-expanded`). Links that leave the admin say they open a new tab.

The Markdown is from this repository and bundled at build time, never fetched, so it is
rendered as trusted HTML.
