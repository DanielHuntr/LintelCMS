# @lintel/admin

The control panel: a React app that talks to `@lintel/core`.

## Where things live

| Folder           | What it does                                         |
| ---------------- | ---------------------------------------------------- |
| `src/layout`     | The frame around every screen: sidebar and page area |
| `src/navigation` | The main sections and who can see them               |
| `src/dashboard`  | The home screen                                      |
| `src/sign-in`    | The sign-in screen                                   |
| `src/sections`   | Placeholders for sections not built yet              |
| `src/i18n`       | Every word the admin shows (`t("key")`)              |

Rules for screens:

- No hard-coded text. Add a key to `src/i18n/strings.ts` and call `t()`.
- Every input has a visible label; every page has one `h1`.
- Use brand tokens (`bg-brand`, `bg-brand-soft`) instead of fixed colours, so agencies can rebrand.

## Commands

```bash
pnpm dev     # http://localhost:5173
pnpm test
pnpm build
```
