# Server check

Settings → This server (`/settings/server`): the report from `GET /system/server-check`
(see `packages/core/src/server-check`). Each check is shown as fine, worth knowing or
needs fixing, with the server's own plain-English detail; when something needs the hosting
company, the questions to ask are gathered into one message to copy. The check runs when
the page opens and when "Check again" is pressed, never in the background: it tries the
internet and the database each time.

Shown to people with `updates:read`, the same people who see Updates.

| File                     | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `ServerCheckPage.tsx`    | The page                                       |
| `serverCheck.api.ts`     | The request and its types                      |
| `serverCheck.queries.ts` | The query, run on request                      |
| `serverCheckStrings.ts`  | The page's words                               |
| `serverCheckRoutes.tsx`  | The route, added under the admin in router.tsx |
