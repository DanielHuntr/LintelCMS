# Page drafts

"Draft a page for me" and "Rewrite this". The builder never talks to the server: the app
passes a `PageDrafting` (`page-drafting.ts`) as the `pageDrafting` prop, and without it
neither is shown. The admin's is in `packages/admin/src/page-drafts`.

- `DraftPageButton.tsx`: the button, on the empty page and at the top of Insert → Sections.
- `DraftPageDialog.tsx`: the short form (what the page is for, who it is for, tone, which
  sections), then progress with Stop. The plan is added with
  `actions.insertDraftedSections` (`editor/draft-commands.ts`) as one change, so one Undo
  takes it away. Nothing is published.
- `RewriteText.tsx`: Shorter, Friendlier and More formal under a heading's or paragraph's
  words in the Content tab, once the model is installed.
- `page-drafts.test.tsx`: the form, inserting with one Undo, Stop, failures, and rewriting.
