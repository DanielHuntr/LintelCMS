# Settings

`/settings` is an index of every area of settings, laid out like iOS Settings with
`GroupedList`. Each row links to its own screen, owned by the feature it configures:

- **Content types** (`/settings/content-types`) lives in `src/content-types`.

Add a row here when a new settings screen is built, and hide it with `useCan` when the
signed-in person can't use it.
