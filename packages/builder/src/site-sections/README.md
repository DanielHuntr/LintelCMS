# Site sections in the builder

The site's navigation and footer (see `site-sections/` in `@lintel/builder-model`), edited
from any page.

- `useSiteSections.ts`: opens the page with them in it, and splits each change: the page
  goes to `onChange` without them, a section that changed goes to the app's
  `siteSections.onChange` on its own (only the slots that changed, so a page opened earlier
  never takes away a navigation another page added). Without permission to change them they
  open locked.
- `SiteSectionControls.tsx`: the strip above the canvas while one is selected
  ("Navigation · on every page", Hide on this page), the page's switches in the Content tab
  with nothing selected, "Navigation and footer" under a top-level section (use it as the
  site's navigation or footer, or as this page's own navigation), and the notes at the foot
  of the canvas (the automatic header has gone; this page starts with its own menu).

The commands are in `editor/site-section-commands.ts`. Insert's Navigation and Footer
groups go through `insertSiteSection`; deleting one of them hides it on this page instead.
