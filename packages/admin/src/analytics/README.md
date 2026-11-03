# Visitors (admin)

The admin half of the Visitors plugin (`packages/core/src/analytics`), shown only while it
is on and to people with `analytics:read`.

- **Visitors** in the sidebar (`VisitorsPage.tsx`): Today, 7 days, 30 days or a custom
  range; four headline figures compared with the period before (`StatTiles.tsx`); visitors
  each day as bars or a table (`VisitorsChart.tsx`); top pages, where people came from,
  devices, countries, goals, and campaigns, events and links to other sites when there are
  any (`BreakdownCard.tsx`, real tables). Export downloads a CSV. Settings
  (`VisitorSettingsDialog.tsx`, for `settings:update`): count only after consent, and how
  long single visits are kept.
- **A dashboard card** (`VisitorsWidget.tsx`) on new dashboards: this week's visitors.
- **An editor panel** (`EntryVisitorsPanel.tsx`): the page's last seven days.
- **The builder's toolbar** (`BuilderVisitorsLine.tsx`, used by `PageDesignPage.tsx`):
  "128 visitors this week".

Words are in `analyticsStrings.ts`; labels for keys (devices, countries, goals) in
`visitorLabels.ts`.
