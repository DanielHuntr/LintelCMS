# The editor

What the builder can do to a page, kept apart from how it looks.

| File                       | What it does                                                |
| -------------------------- | ----------------------------------------------------------- |
| `editor-state.ts`          | What undo covers: the page, the selection and the history   |
| `useBuilder.ts`            | The hook the builder's screens use                          |
| `commands.ts`              | Everything that changes a page, as steps in the history     |
| `design-commands.ts`       | Free layouts, stacking, background videos, fonts and styles |
| `draft-commands.ts`        | Puts drafted sections on the page as one step               |
| `site-section-commands.ts` | The site's navigation and footer                            |
| `multi-selection.ts`       | Several elements selected at once                           |
| `clipboard.ts`             | Copying and pasting elements                                |
| `shortcuts.ts`             | The keyboard shortcuts, in one list                         |

A command checks that it is allowed, then gives back the change or a plain reason it can't
happen, which the editor announces. Each one is a single step, so Undo takes it away whole. Hover,
the screen size being edited and open panels aren't part of the state: undo only changes the page.
