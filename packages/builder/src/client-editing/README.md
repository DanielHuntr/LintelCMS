# Client editing

The builder's half of content-only editing (docs/decisions/0053-content-only-editing-for-clients.md).

- `ClientAccessSection.tsx`: "What clients can change" in the Content tab, for designers:
  Words, Pictures, Links (only those the element has) or Nothing, and "Clients can add more
  of these" on lists and repeated items. Closed until opened.
- `ContentEditingScreen.tsx`: the builder for people who may change content but not the
  design (`contentOnly` on `PageBuilder`). The page as it looks, words typed in place (only
  where allowed: `mayEditText` in `renderPage`), a click on a picture opens the media
  library, nothing is dragged (`canMove` on the canvas). Undo, History and its own short
  tour (`clientTourSteps`).
- `ClientContentPanel.tsx`: its right-hand panel: the fields a client may change
  (`clientEditableFields` from the model), "Add another" and "Remove this one" where the
  designer allows, and a calm note on parts of the design.

The rules live in `@lintel/builder-model` (`client-editing/`), and the server checks every
save against them, so this view is a convenience, not the safeguard.
