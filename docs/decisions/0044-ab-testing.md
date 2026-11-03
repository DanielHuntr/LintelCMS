# 44. A/B testing: another version of a page, chosen on the server, counted without tracking

Date: 2026-11-03

## Decision

A/B testing is an optional plugin, **A/B testing** (`experiments`), off until a site switches
it on. While it is off the admin shows nothing of it and the website sends no script, marker
or other version: every page is drawn exactly as published.

- **Versions are made in the designer.** "Try another version" makes Version B as a copy of
  the page, or of one top-level section of it, and opens it on the same canvas; the toolbar
  switches between Original, B and C. At most three versions in all, because every extra
  version needs as many visitors again before a result means anything.
- **Versions live with the test**, not in the page. A whole-page version is a page design of
  its own. A section version is a page design holding just that section, with the original
  section's id, so on the website it replaces that section in the page as it is now, and
  later edits to the rest of the page show in every version.
- **A goal**: a form sent, an order placed, a click on one of the page's buttons or links, or
  reaching a chosen page. **A split**: even by default, changeable in whole percent.
  **Start and pause**; one open test per page.
- **"Make B the page"** saves B as the page's design and publishes it, through the normal
  save and publish rules (so it needs `entries:publish` as well as `experiments:manage`), and
  ends the test. "Keep the original" ends it without touching the page.
- One permission, `experiments:manage`, for everything about tests.

## Choosing the version: on the server, without storing anything

The version is chosen when the page is drawn, so a visitor never sees one version and then
another (no layout flash, no hiding the page while a script decides).

To keep a visitor on the same version without a cookie or any stored identifier, the server
works the choice out afresh on every visit: an HMAC of the visitor's network address, user
agent and `Accept-Language`, keyed with a random secret of the test's own, gives a number
from 0 to 9999, and the split's shares laid end to end say which version that number falls
in. Nothing about the visitor is written down; the address is only an input to that sum.
The same browser on the same network keeps its version; a phone moving from Wi-Fi to mobile
data may get the other one. We accept that: it slightly blurs a result, it never exposes
anyone, and it needs no consent banner.

Not taking part, always the original and never counted:

- search engines, link previews, monitors, command-line tools and headless browsers (by
  user agent; a request with none counts as automated);
- browsers sending **Do Not Track** (`DNT: 1`) or **Global Privacy Control** (`Sec-GPC: 1`).
  The page's script checks `navigator.doNotTrack` and `navigator.globalPrivacyControl` too.

Each version of a page is cached apart (the rendered-pages cache key carries the visitor's
versions), and pages for people taking part are `Cache-Control: private`, so no shared
cache hands one person's version to everyone.

## Counting: one first-party localStorage key, no personal data

To count each browser once as a visitor, and once more if it reaches the goal, the pages of
a site running a test carry a small script that keeps **one first-party localStorage key**,
`lintel-tests`. It holds only `{ "<test id>": { "v": "b", "c": 1 } }`: which version this
browser was counted for and whether it converted. No identifier, nothing about the person,
never sent to anyone but the site itself. Entries for tests that have stopped are removed the
next time the script runs.
Reports go to `POST /_lintel/tests` on the site's own address, which counts them only while
the plugin is on and the test runs, and only from visitors who take part. The answer is
always 204, so it reveals nothing about which tests exist. Counts are plain daily totals per
version (`experiment_counts`); nothing else is stored.

Conversions are credited to the version the browser was counted for (from the stored key),
not recomputed, so a visitor who changes network still converts for what they saw first.

The endpoint can be fed made-up reports by anyone determined to; that is true of every
cookieless counter. Visitors aren't identifiable, so they can't be de-duplicated on the
server without storing something about them, which this design refuses to do.

## Statistics: Bayesian beta-binomial

Each version's true conversion rate is unknown; with a flat prior, after `n` visitors and `c`
conversions it is Beta(1 + c, 1 + n − c). The chance that a version beats the original is
computed exactly with Evan Miller's closed-form sum (using log-gamma, so large counts don't
overflow), or by the normal approximation once a version has over 5,000 conversions. We
chose it over a two-proportion z-test because its answer is the sentence people want ("about
96% sure B is better") rather than a p-value they would misread, and it behaves sensibly with
small numbers.

The verdicts: **better** or **worse** at 95% or more either way, but only once every version
has at least 100 visitors and the test has at least 20 conversions; before that, **ahead**
or **behind, but too early to be sure**, or **about the same** within 45–55%. The minimums
are shown as a plain warning. "Make B the page" stays available throughout (it is the site
owner's call), with a note when the result isn't sure yet.

## The seam for first-party analytics

The analytics plugin (decision 0042) counts visitors and goals (form submissions, orders,
outbound clicks, custom events) its own cookieless way. A/B testing doesn't depend on it,
but is built to use it once both are merged:

- **`ExperimentMeasurement`** (`packages/core/src/experiments/experiment-measurement.ts`):
  `recordVisit`, `recordConversion` and `readCounts(experimentId)`. The built-in one keeps
  `experiment_counts`. An analytics-backed one is passed as
  `buildServer({ experiments: { measurement } })`. It can record visits as analytics events
  tagged with the test id and version, and read counts back from analytics, so the results
  screen shows analytics' own visitor numbers.
- **Goals.** `goalSchema` is a discriminated union. Adding
  `{ kind: "analytics", goalId }` lets a test use any goal analytics defines; the page's
  script would then leave that goal to analytics, and the measurement reads conversions per
  version from analytics' goal completions for visitors tagged with the version.
- **The version tag.** Pages carry `<template data-lintel-test="<id>" data-lintel-version="b">`;
  analytics' script can read it to tag the page view, with no second assignment.

## Not done (yet)

- Tests of other fields than the page's design, of collection item designs, or of the shop's
  own pages.
- Scheduling a test's end, or ending it automatically when it is sure.
- More than one goal per test, or revenue per visitor.
