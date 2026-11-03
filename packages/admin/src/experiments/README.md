# A/B tests (admin)

The admin half of the A/B testing plugin (`experiments`; the server half is
`packages/core/src/experiments`). Shown only while the plugin is on, to people with
`experiments:manage`.

- **In the page designer** (`useExperimentsInDesigner.tsx`, `VersionSwitcher.tsx`,
  `useVersionEditing.ts`): "Try another version" in the toolbar makes Version B of the whole
  page, or of the section around the selected element. Then the toolbar switches the canvas
  between Original, B and C, adds a version (up to three), and links to the test's settings.
  B and C save to the test as the page saves, shortly after changes stop. A section version
  is drawn in the page as it is now, with the other sections locked.
- **A/B tests** (`ExperimentsPage.tsx`): every test with its state and goal.
- **One test** (`ExperimentPage.tsx`): the results (`ResultsCard.tsx`), what counts as
  success (`GoalCard.tsx`), the versions and their split (`VersionsCard.tsx`), start, pause,
  "Make B the page", "Keep the original" and delete.

Words are in `experimentsStrings.ts`; `experimentText.ts` turns results into sentences
("B is better: about 96% sure.").
