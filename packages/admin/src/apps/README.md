# Apps (admin)

Settings → Apps, and installed apps' pages inside the admin. The server half, and what an
app may do, is in `packages/core/src/apps`; developers start with the docs page "Building
an app".

## Installing and removing

- `AppsPage` (`/settings/apps`) lists installed apps and opens `AddAppDialog`.
- `AddAppDialog` takes the app's `lintel-app.json` address, or the file pasted in, asks the
  server to check it (`POST /apps/preview`), shows `AppAccessSummary` (what it may do, what
  it is told about and what it adds, in plain English), installs it with the scopes the
  person saw, and shows the client id and secret once.
- `AppDetailPage` (`/settings/apps/$appId`) shows the same summary, the client id, and
  uninstalls.

## Pages, widgets and panels

`InstalledAppsProvider` (around the admin, in `router.tsx`) loads `GET /apps/extensions` and
turns each app into an admin plugin definition (`installedAppPlugins.tsx`). So an app's
sidebar page, dashboard widgets, editor panels and settings page are drawn by the same code
as plugins' (`useVisibleContributions`, `visibleSections`, `availableWidgets`), from a second
list that is always on (`visibleExtensions` in `src/plugins/pluginContributions.ts`).

| From the manifest        | Shown as                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| `admin.page`             | A sidebar item and a screen at `/apps/<handle>`                       |
| `admin.dashboardWidgets` | Widgets in the dashboard gallery, `app-<handle>:<id>`                 |
| `admin.editorPanels`     | Sections of the entry editor's side panel, for the collections listed |
| `admin.settingsPage`     | A row under Settings → Apps and a screen at `/apps/<handle>/settings` |

Each draws an `AppFrame`: a sandboxed iframe of the app's page. `appFrameMessages.ts` holds
the rules, tested on their own:

- **Sandbox**: scripts, forms, popups and downloads; `allow-same-origin` so the app keeps its
  own cookies, which is safe because an app may never be on the admin's origin (checked by
  the server and again here). No top navigation and no browser features (`allow=""`).
- **Messages in**: only from the app's origin _and_ that frame's window, and only well-formed
  bridge messages (`@lintel/app-bridge/protocol`). Navigation stays inside the admin.
- **Messages out**: only to the app's origin, never `"*"`. The page says `ready`; the admin
  fetches a session token (`POST /apps/:id/session-token`) and sends it with the context.
  The page can ask for a new token, resize its frame, show a toast (`AppToasts.tsx`, always
  labelled with the app's name) or open an admin screen.

| File                             | What it does                                       |
| -------------------------------- | -------------------------------------------------- |
| `AppsPage.tsx`                   | Settings → Apps                                    |
| `AddAppDialog.tsx`               | Adding an app, in three steps                      |
| `AppDetailPage.tsx`              | One app, and uninstalling it                       |
| `AppAccessSummary.tsx`           | What an app asks for, in plain English             |
| `AppIcon.tsx`                    | The app's icon, or a plain glyph                   |
| `AppFrame.tsx`                   | An app's page in a sandboxed frame                 |
| `appFrameMessages.ts`            | Checking messages, the sandbox and frame addresses |
| `AppToasts.tsx`                  | Apps' short messages                               |
| `installedAppPlugins.tsx`        | An installed app as an admin plugin definition     |
| `InstalledAppsContext.tsx`       | Loading installed apps for the extension points    |
| `apps.api.ts`, `apps.queries.ts` | Calls to the API, and their queries                |
