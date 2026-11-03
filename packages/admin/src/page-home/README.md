# A page's home

One place for a page. The page screen (the entry editor, `src/content`) and the designer
(`src/page-design`) are two views of the same page, so they share a top bar: the page's name, its
status in words, the view switch, View page, Preview and one main action.

| File                 | What it is                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| `PageBarParts.tsx`   | The shared parts: view switch, View page, Preview, the main Publish button |
| `pageViews.ts`       | Which views a page offers, and what the main button says                   |
| `useIsBarTight.ts`   | Whether the switch fits in the bar, or sits just under it                  |
| `pageHomeStrings.ts` | The words, spread into `i18n/strings.ts`                                   |

The status is `content-workspace/PageStatus.tsx`, which uses the tree's marks.

## The views

- **Content**: the page screen, with a picture of the design, the fields and the side panel.
- **Design**: the builder, which fills the window. People without `builder:design` see **On the
  page** instead, which opens the same route as their content-only view.
- **Items**: the list under a page such as a Blog page, as `?tab=children`.

A new page has no switch until it's saved (its card has Start designing). A phone has no Design
view, because the builder needs a laptop's width. With fewer than two views there's no switch.

## Moving between them

Both directions save first, then go without the unsaved-changes question. If the save fails,
the question still asks. The builder's download starts when the browser is idle on a page that
can be designed, and again when someone points at the switch, and while the designer loads it
shows the shape of its bar and panels.

## The main button

Publish, Publish changes, or for a live page with nothing waiting just the word Published,
kept as wide as the button so the bar doesn't jump at the first edit. In the designer, shared
navigation and footer changes count as changes. People who can't publish get Save on the page
screen, as before, and clients who must wait for approval get Send for review in both views.
