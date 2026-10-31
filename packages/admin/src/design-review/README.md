# Design review page

`/design-system` shows every base component from `src/design`, once in light and once in dark,
so changes to the design system can be reviewed in one place. It is not in the sidebar.

It only exists in development (`pnpm dev`). To include it in a production build for a review,
build with `VITE_DESIGN_REVIEW=true pnpm build`. The page loads lazily, so normal builds don't ship it.

Each column sets `data-color-scheme`, which forces that scheme's tokens whatever the device's
setting (see `src/design/README.md`).

When you add a component to `src/design`, add a specimen to `ComponentSpecimens.tsx`.
