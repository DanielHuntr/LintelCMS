# @lintel/admin

The control panel: a React app that talks to `@lintel/core`.

## Where things live

| Folder              | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `src/design`        | Design tokens and base components (see its README)             |
| `src/layout`        | The frame around every screen: sidebar and page area           |
| `src/navigation`    | The main sections and who can see them                         |
| `src/dashboard`     | The home screen                                                |
| `src/sign-in`       | The sign-in screen                                             |
| `src/content`       | Collections, entry lists and the entry editor                  |
| `src/content-types` | The blueprint builder under Settings                           |
| `src/fields`        | One editor per fieldtype, used by the entry editor             |
| `src/settings`      | The Settings index                                             |
| `src/session`       | Who is signed in; `useCan` for permission checks               |
| `src/api`           | The API client, the query cache and plain-English errors       |
| `src/testing`       | Helpers for component tests                                    |
| `src/sections`      | Placeholders for sections not built yet                        |
| `src/i18n`          | Every word the admin shows (`t("key")`)                        |
| `src/design-review` | `/design-system`: every component in light and dark (dev only) |

Data comes through TanStack Query (`src/api/queryClient.ts`): screens show skeletons while
loading and `LoadError` (with Try again) when something fails.

Rules for screens:

- No hard-coded text. Add a key to `src/i18n/strings.ts` and call `t()`.
- Every input has a visible label; every page has one `h1`.
- Build from the components in `src/design` and use its tokens (`bg-surface`, `text-accent`)
  instead of fixed colours, so agencies can rebrand.

## Commands

```bash
pnpm dev     # http://localhost:5173 (design review at /design-system)
pnpm test
pnpm build
```
