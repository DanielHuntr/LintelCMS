# The example add-on: swatches and opening hours

A small, complete Lintel add-on, with one of each thing an add-on can add. Read it with the
docs page "Building add-ons"; `lintel addons new` makes a smaller one to start from.

| Part                         | Where                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| A **Colour swatch** field    | `src/server/swatches.ts` (checks, delivery), `src/admin/SwatchEditor.tsx` |
| Liquid tags and filters      | `liquid` in `src/server/index.ts`                                         |
| A builder element            | `blocks` in `src/server/index.ts`                                         |
| Settings (the opening hours) | `src/server/opening-hours.ts`; the Add-ons screen draws their form        |
| A sidebar screen and widget  | `src/admin/OpeningHoursPage.tsx`, `src/admin/OpeningHoursWidget.tsx`      |
| An event handler and a job   | `events` and `jobs` in `src/server/index.ts`                              |
| A terminal command           | `commands`: `pnpm lintel example:hours`                                   |

## Trying it in a site

```bash
pnpm --filter @lintel/addon-example build      # bundles dist/server.js and dist/admin.js
pnpm lintel addons link packages/addon-example # from the repository root
pnpm dev                                       # it is switched on at start
```

Then open Build → Add-ons. `pnpm lintel addons unlink example` takes it out again.

## Tests

`pnpm --filter @lintel/addon-example test` runs `src/server/example.test.ts` on a real
Lintel with a database in memory (`@lintel/core/plugin-testing`).

## Files

| File                               | What it does                                      |
| ---------------------------------- | ------------------------------------------------- |
| `src/server/index.ts`              | The server half: `definePlugin`                   |
| `src/server/swatches.ts`           | The Colour swatch field type and its chip         |
| `src/server/opening-hours.ts`      | The opening hours settings and how they are drawn |
| `src/server/example.test.ts`       | Tests                                             |
| `src/admin/index.tsx`              | The admin half: `defineAdminPlugin`               |
| `src/admin/SwatchEditor.tsx`       | The field's editor                                |
| `src/admin/OpeningHoursPage.tsx`   | The sidebar screen                                |
| `src/admin/OpeningHoursWidget.tsx` | The dashboard widget                              |
| `src/admin/openingHours.api.ts`    | Reading the hours from the add-on's settings      |
| `src/admin/strings.ts`             | Its words                                         |
