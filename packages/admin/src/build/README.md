# Build

`/build`: how the site is put together, for whoever built it. Content types, Features, Websites and domains, Admin branding, API access, Webhooks, and Import and export each keep their own feature folder; this page lists them.

They used to be in Settings, beside the things a website owner changes. Only people allowed to change the site's structure see Build in the sidebar (`navigation/sections.ts`, any of `blueprints:update`, `settings:update`, `branding:update` or `content:transfer`), so a client editor doesn't.

Their old `/settings/...` addresses still work: `navigation/movedPages.ts` sends them on, and Settings search says where each one went.

| File              | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `BuildPage.tsx`   | The list, in three groups, each row gated by its own permission |
| `buildStrings.ts` | Its words                                                       |
