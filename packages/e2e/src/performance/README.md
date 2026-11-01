# Performance budgets

`budgets.ts` holds every budget; `measure.ts` how each is measured:

- **Initial JavaScript and CSS**: gzipped size of what the built admin's `index.html` loads
  straight away (lazy chunks such as the entry editor are not counted).
- **Largest Contentful Paint**: from the browser's own timing, for the dashboard and the entry
  editor, loading from the local test server.
- **API p95**: 40 requests one after another to each list endpoint, with 1,000 posts in the
  collection, after 3 warm-up requests.

Change a budget only on purpose, in its own commit, saying why.

Sizes are always enforced. Timings depend on the machine, so they fail the test only in CI
(or with `LINTEL_E2E_TIMING_BUDGETS=enforce`); elsewhere they are reported on the test and
as a warning. `LINTEL_E2E_TIMING_BUDGETS=record` stops enforcing them in CI, and
`LINTEL_E2E_TIMING_SCALE=2` doubles every timing budget for a slower runner.
