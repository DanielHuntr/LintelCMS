---
title: Contributing
description: How code and docs are written here, and the checks every change passes.
since: "0.1"
---

The full rules are in
[CONTRIBUTING.md](https://github.com/DanielHuntr/lintelcms/blob/main/CONTRIBUTING.md). In
short:

- **Folders by feature**, with routes, then service, then repository. See
  [Feature folders](/building/feature-folders/).
- **Plain, full names**: `refundOrder(orderId, amount)`, never `procRef(o, a)`.
- **Strict TypeScript**, no `any`. One Zod schema per entity; types are inferred from it.
- **A README in every feature folder.** Comments explain why, not what.
- **Errors are named and human**, with a message an editor could understand.
- **Admin text goes through `t()`**, every input has a visible label, and everything works
  by keyboard, in light and dark, with reduced motion respected.
- **Big decisions get a record** in `docs/decisions/`.

## Before you push

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

CI runs the same, plus `pnpm build`. A pre-commit hook runs ESLint and Prettier on the
files you change.

## Writing docs

These docs are Markdown in `packages/docs/src/content/docs`. Every page has an
**Edit this page** link to its file on GitHub.

- Keep pages short and in plain English. "Using Lintel" pages are for people who have
  never seen code: name buttons as the admin shows them, in **bold**.
- Give each page a `title`, a one-line `description` and `since` (the Lintel version that
  introduced it).
- Screenshots go in `packages/docs/src/assets/screens`, taken from a real admin in light
  mode at 1440 × 900.
- Add new pages to `src/sidebar.ts`. `pnpm --filter @lintel/docs test` checks that every page
  is listed, and that links and images point at something real.

The admin's **?** button shows the "Using Lintel" pages, bundled into the admin so they work
offline. Which page each screen opens is set in
`packages/admin/src/help/helpTopics.ts`; update it when you add a screen.

Run the docs locally with `pnpm --filter @lintel/docs dev`.
