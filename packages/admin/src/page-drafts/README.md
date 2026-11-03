# Page drafts (admin)

The admin half of the Page drafting plugin (see `packages/core/src/page-drafts`).

- `PageDraftingSettingsPage.tsx`: Settings → Page drafting. Before anything is downloaded it
  shows the model's name, maker, licence (linked), size, the exact download addresses, the
  folder it is saved in, the memory it needs, and that nothing about the site is sent
  anywhere. Then Download (with progress and Cancel, resumable) or "I'll copy the file in
  myself" (the folder and file names, then Check files). Installed, it shows the same
  details and Remove. Too little memory or disk is explained plainly.
- `usePageDrafting.ts` and `pageDrafts.api.ts`: what the builder is given while the plugin is
  on and the person has `drafts:use`; drafts are followed by asking for the job each second.
- `pageDrafts.adminPlugin.tsx`: the Settings row and screen. `pageDraftsStrings.ts`: the words.
