# A/B testing (experiments)

The **A/B testing** plugin (`experiments`): try another version of a page, or of one section
of it, show each version to a share of visitors, and see which one more often leads to a goal.
It is privacy-first: no cookies, no third parties, nothing stored about a visitor. The
reasoning is in `docs/decisions/0044-ab-testing.md`.

## How it fits together

1. **A version.** In the page designer, "Try another version" makes Version B, a copy of the
   page's saved design (or of one top-level section). Up to three versions in all: the
   original, B and C. B and C are kept in `experiment_versions`, never in the page itself. A
   section version is stored as a page holding only that section, with the original section's
   id, so it is put in the live page's place however the rest of the page changes.
2. **The test.** A goal (`form`, `order`, `click` on a link or button, or reaching a `page`),
   a split (whole percent per version, even by default) and a status: `draft`, `running`,
   `stopped` (paused) or `ended`. A page has at most one test that hasn't ended.
3. **On the website** (`experiment-pages.ts`). While a test runs, each visit's version is
   chosen on the server before the page is drawn (`visitor-assignment.ts`), so nothing
   flickers. Search engines, link previews and other automated visitors, and browsers sending
   Do Not Track or Global Privacy Control, always get the original, uncounted. Each version is
   cached apart (the cache key carries the versions), and pages shown to people taking part
   are `Cache-Control: private`.
4. **Counting.** Pages carry a small script (`tests-script.ts`) and the tested page a marker
   (`<template data-lintel-test>`). The script counts each browser once as a visitor of the
   version it saw and once if it then reaches the goal, remembering that in one localStorage
   key (`lintel-tests`) that holds only test ids and version letters. It reports to
   `POST /_lintel/tests` on the website's own address (`experiment-site.routes.ts`), which
   counts only while the plugin is on and the test runs.
5. **Results** (`experiment-results.service.ts`, `experiment-statistics.ts`). Per version:
   visitors, conversions, the rate and the difference from the original, with a Bayesian
   beta-binomial chance that a version beats the original and a plain verdict. Below 100
   visitors on each version and 20 conversions in all, a result is "too early".
6. **Ending.** "Keep the original" ends the test. "Make B the page" saves B as the page's
   design and publishes it (needs `entries:publish`), then ends the test.

## The measurement seam

`ExperimentMeasurement` (`experiment-measurement.ts`) is where visits and conversions are
recorded and read back. The built-in one keeps daily counts in `experiment_counts`. Pass
another to `buildServer({ experiments: { measurement } })` to count elsewhere, such as the
first-party analytics plugin.

## Endpoints

All need `experiments:manage`. See `experiments.routes.ts` for the bodies.

| Method and path                                    | What it does                                     |
| -------------------------------------------------- | ------------------------------------------------ |
| `GET /experiments`                                 | Every test, newest first                         |
| `POST /experiments`                                | A test of a page (or a section), with Version B  |
| `GET /experiments/for-page/:entryId`               | The page's open test, or null                    |
| `GET`, `PATCH`, `DELETE /experiments/:id`          | One test; its goal and split                     |
| `POST /experiments/:id/versions`                   | Version C, copied from the original or B         |
| `PUT`, `DELETE /experiments/:id/versions/:version` | Save or remove B or C                            |
| `POST /experiments/:id/start`, `/stop`             | Start, or pause                                  |
| `GET /experiments/:id/results`                     | Counts, rates and verdicts                       |
| `POST /experiments/:id/end`                        | `{ version }`: keep the original, or publish B/C |

On the website's server: `POST /_lintel/tests` (always 204) and `GET /_lintel/tests-<hash>.js`.

## Files

| File                             | What it does                                          |
| -------------------------------- | ----------------------------------------------------- |
| `experiments.plugin.ts`          | The plugin: its permission and routes                 |
| `register-experiments.ts`        | `server.experiments`: the measurement in use          |
| `experiments.table.ts`           | Tests, versions and daily counts                      |
| `experiments.schema.ts`          | Request and response shapes                           |
| `experiments.routes.ts`          | The admin endpoints                                   |
| `experiments.service.ts`         | Making versions, goals, splits, starting and pausing  |
| `experiment-results.service.ts`  | Results, and ending a test                            |
| `experiments.repository.ts`      | Database reads and writes                             |
| `experiment-designs.ts`          | Versions as page designs; section swaps               |
| `visitor-assignment.ts`          | Which version a visitor sees; bots and opt-outs       |
| `experiment-statistics.ts`       | How sure a result is                                  |
| `experiment-measurement.ts`      | The counting seam, and the built-in counts            |
| `experiment-pages.ts`            | The website's side: versions, markers, the script tag |
| `experiment-counting.service.ts` | What the script reports, checked and counted          |
| `experiment-site.routes.ts`      | `POST /_lintel/tests` on the website's server         |
| `tests-script.ts`                | The script tested pages carry                         |
| `experiments.errors.ts`          | Named errors                                          |
