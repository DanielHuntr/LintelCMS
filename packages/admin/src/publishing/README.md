# Publishing

Settings → Publishing (`/settings/publishing`): hosting the website is published to as
ordinary files, for people whose host can't run Lintel (PHP-only shared hosting, plain
cPanel, any FTP space). The server side is `packages/core/src/publishing`, with the export
in `packages/core/src/static-site` and the PHP companion in `packages/core/src/bridge`.

| File                      | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `PublishingPage.tsx`      | The list of destinations, and the guided empty state                  |
| `PublishTargetCard.tsx`   | One destination: what works there, Test, Publish (with progress), ZIP |
| `PublishTargetDialog.tsx` | Adding or changing one; passwords are sent, never shown               |
| `PublishHistory.tsx`      | The last publishes, in plain words                                    |
| `publishing.api.ts`       | Calls to `/publishing/...`                                            |
| `publishing.queries.ts`   | TanStack Query hooks; runs are followed every second while they run   |
| `publishingStrings.ts`    | Every word on these screens, spread into `t()`                        |

The "What works on this hosting" list is worked out from the destination and the plugins
that are switched on: pages and search always; forms through the PHP companion or straight
to Lintel; the shop only through the companion with payments connected; member logins never.
More deletions than a destination's limit are held back and shown for confirmation.
