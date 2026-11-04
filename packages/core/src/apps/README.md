# Apps

External apps: programs on their own servers, in any language, that extend Lintel without
touching its code. (Plugins and add-ons, in `src/plugins` and `src/addons`, are the other
way: code that runs inside Lintel with full access. The admin lists them side by side, in
Build → Add-ons and Build → Apps.) The reasoning is in `docs/decisions/0058-external-apps.md`;
developers start with the docs page "Building an app".

## How an app gets in

1. An admin opens Build → Apps → Add an app, and gives the address of the app's
   `lintel-app.json` or pastes its contents. `POST /apps/preview` reads and checks it
   (`app-manifest-reader.ts`, `app-manifest.schema.ts`) and installs nothing.
2. The admin shows what the app asks for in plain English and the admin approves.
   `POST /apps` reads the manifest again and stops with 409 `APP_SCOPES_CHANGED` if it now
   asks for anything other than what was approved, and with 409 `APP_NEEDS_FEATURES` if a
   scope needs a plugin that is off (the shop for orders, forms for form entries); the
   preview lists those as `missingFeatures`.
3. Lintel keeps the approved copy, makes a **client id** and **client secret**
   (`app-credentials.ts`) and adds the app's webhook subscriptions. The secret is shown once.
4. Uninstalling (`DELETE /apps/:id`) deletes the row; its webhooks and their delivery log go
   with it (`webhooks.app_id` cascades), the secret stops working, and its parts leave the
   admin. Deleting the installer's account uninstalls their apps too.

## What an app can do

- **Call the API** with `Authorization: Bearer <client secret>`. `api-token-auth.ts` (in
  `src/api-tokens`) recognises the `lintelapp_` prefix and hands over to `authenticateApp`, so
  every guarded route, the delivery API and GraphQL work with it. The app acts for its
  installer, with only its scopes' permissions that the installer also has (`app-scopes.ts`),
  checked on every request. No scope reaches settings, users, roles, webhooks, apps or a
  page's design (`builder:design`), so apps are content-only, like API tokens. An app whose
  installer is deactivated stops working, and stops being sent events. It is only sent an
  event its installer may see (`app-events.ts`). `read_orders` and `write_orders` map to the
  narrow `commerce:read-orders` and `commerce:handle-orders`, which only the orders routes
  accept.
- **Be limited**: `app-rate-limit.ts` counts each app's requests, 240 a minute by default
  (`buildServer({ appRequestsPerMinute })`), and answers 429 `APP_RATE_LIMITED` with
  `Retry-After`. Each app request is written to the server log with the app's id.
- **Hear about events**: its webhook subscriptions are ordinary webhooks signed with the
  client secret, sent by `src/webhooks`. They are kept out of Settings → Webhooks.
- **Show pages in the admin**: a sidebar page (for the roles it names, or everyone but clients
  and Viewers; see `app-page-audience.ts`), dashboard widgets, entry editor panels (for
  some or all collections) and a settings page, each drawn in a sandboxed frame. The admin
  gets a short-lived **session token** for each frame from `POST /apps/:id/session-token`
  (`app-session-tokens.ts`): an HS256 JWT signed with the client secret, naming the app, the
  person and what the app may do for them, valid for five minutes.

## Development mode

`app-development-mode.ts`. While someone builds an app on the same computer, Build → Apps
can turn on development mode (the `appDevelopmentMode` setting), and then manifests and
the app's webhooks may use this computer's addresses (localhost, 127.x.x.x, ::1) and
nothing else private (`allowLoopbackAddresses` in `src/webhooks/webhook-sender.ts`). The
server must allow it: `buildServer({ appDevelopmentModeAvailable })`, from
`APPS_DEVELOPMENT_MODE` (allowed by default only when `NODE_ENV=development`). Deliveries
ask before each send to an app (`appsMayUseLoopback`), so switching it off applies at once.

## Endpoints

| Method and path                | Permission           | Body                                | Success                                                        |
| ------------------------------ | -------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `GET /apps`                    | `settings:read`      | none                                | 200 `{ apps: [App] }`                                          |
| `POST /apps/preview`           | `settings:update`    | `{ manifestUrl }` or `{ manifest }` | 200 `{ manifest, manifestUrl, alreadyInstalled }`              |
| `POST /apps`                   | `settings:update`    | the same, plus `approvedScopes`     | 201 `{ app, clientSecret }`                                    |
| `GET /apps/:id`                | `settings:read`      | none                                | 200 `App`                                                      |
| `DELETE /apps/:id`             | `settings:update`    | none                                | 204                                                            |
| `GET /apps/extensions`         | signed in            | none                                | 200 `{ apps: [{ id, handle, name, iconUrl, origin, admin }] }` |
| `POST /apps/:id/session-token` | signed in (a person) | none                                | 200 `{ token, expiresAt }`                                     |
| `GET /apps/development-mode`   | `settings:read`      | none                                | 200 `{ available, on }`                                        |
| `PUT /apps/development-mode`   | `settings:update`    | `{ on }`                            | 200 `{ available, on }`, 409 where the server doesn't allow it |

## Files

| File                      | What it does                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| `apps.table.ts`           | The `apps` table                                                         |
| `app-manifest.schema.ts`  | `lintel-app.json`, checked                                               |
| `app-manifest-reader.ts`  | Reading a manifest from its address, safely                              |
| `app-scopes.ts`           | The scopes, the permissions behind each and the plugins some need        |
| `app-development-mode.ts` | Apps on this computer, while someone builds one                          |
| `app-credentials.ts`      | Making and recognising client ids and secrets                            |
| `app-session-tokens.ts`   | Signing and verifying session tokens (`@lintel/core/app-session-tokens`) |
| `app-events.ts`           | Which apps may be told about an event                                    |
| `app-rate-limit.ts`       | Each app's requests a minute                                             |
| `apps.schema.ts`          | Zod schemas for requests and responses                                   |
| `apps.routes.ts`          | The endpoints                                                            |
| `apps.service.ts`         | Installing, uninstalling, tokens and recognising apps                    |
| `apps.repository.ts`      | Database reads and writes                                                |
| `apps.errors.ts`          | Named errors with the messages people see                                |
