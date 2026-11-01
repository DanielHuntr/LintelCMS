# @lintel/e2e

Lintel's browser tests. They drive the real admin (a production build) against the real API
on the built-in database, the way a person would, and keep the product honest as features
land: journeys, accessibility, screenshots and performance budgets.

```bash
pnpm e2e                      # everything, from the repository root
pnpm e2e --project=journeys   # one kind of test: journeys, accessibility, visual, performance
pnpm e2e tests/journeys/media.spec.ts
pnpm e2e:ui                   # Playwright's UI: pick tests, watch them, time-travel through steps
pnpm e2e:update-snapshots     # after an intended visual change; commit the new images
```

The first run installs nothing else: Chromium comes from `pnpm exec playwright install chromium`
(already there on most machines that ran Playwright). The HTML report is in
`playwright-report/` and traces of failed tests in `test-results/`
(`pnpm exec playwright show-trace <trace.zip>`).

## How a test gets a Lintel

`src/global-setup.ts` runs once: it builds the admin (only when its source changed) and makes
two site templates, an empty install and a seeded site. Every test then runs against a copy of
one, in a temporary folder, with its own API and admin on free ports. Nothing touches `.lintel/`.

| `test.use({ site })` | What the test gets                                                       |
| -------------------- | ------------------------------------------------------------------------ |
| `"seeded"` (default) | The seeded site this worker shares with its other tests                  |
| `"private"`          | A seeded site for this test alone: for site-wide settings or signing out |
| `"fresh"`            | A brand new install, showing the setup wizard                            |

The seeded site is a small bakery's blog: an owner and an editor, three posts (two published),
pages built from blocks, two images, the main menu, site settings, and a French translation.
`content` in a test has their ids and titles; `api` and `editorApi` call the API as each
account. Browsers start signed in as the owner; `test.use({ signedInAs: "editor" })` or `null`
changes that.

Tests sharing the seeded site make their own entries (`uniqueTitle("...")`) for anything they
change, so they can run in any order and in parallel.

## Writing a test

- Find things as people do: `getByRole`, `getByLabel`, visible text. No CSS classes or test ids.
- Start from what the person wants ("a post is scheduled to go live later"), then check the
  outcome both on screen and, where it matters, through the API.
- Wait for outcomes (`expect(...).toBeVisible()`), never for time.
- New screen? Add it to `src/accessibility/admin-screens.ts` so axe checks it in light and dark.

## Where things live

| Folder                | What it does                                                 |
| --------------------- | ------------------------------------------------------------ |
| `src/site`            | Running a test site: build, servers, seeding, templates      |
| `src/fixtures`        | The `test` every spec imports, with the site fixtures        |
| `src/screens`         | Steps shared between journeys, such as waiting for autosave  |
| `src/accessibility`   | axe checks, the list of admin screens, keyboard helpers      |
| `src/performance`     | Budgets and how they are measured                            |
| `tests/journeys`      | What people do, start to finish                              |
| `tests/accessibility` | axe on every screen in light and dark, keyboard-only, motion |
| `tests/visual`        | Screenshot comparisons, with baselines in `__screenshots__`  |
| `tests/performance`   | Bundle size, Largest Contentful Paint and API p95 budgets    |

Screenshot baselines are made on Linux in Chromium, as CI runs; other systems skip them.
CI runs the suite in two shards (`.github/workflows/ci.yml`) and keeps the report and traces
when something fails.
