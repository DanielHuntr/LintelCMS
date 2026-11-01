# Apps

External apps: programs on their own servers, in any language, that extend Lintel without
touching its code, the way Shopify apps do. (Plugins, in `src/plugins`, are the other way:
trusted TypeScript built into Lintel.) The reasoning is in `docs/decisions/0012-external-apps.md`;
developers start with the docs page "Building an app".

## How an app gets in

1. An admin opens Settings → Apps → Add an app, and gives the address of the app's
   `lintel-app.json` or pastes its contents. `POST /apps/preview` reads and checks it
   (`app-manifest-reader.ts`, `app-manifest.schema.ts`) and installs nothing.
2. The admin shows what the app asks for in plain English and the admin approves.
   `POST /apps` reads the manifest again and stops with 409 `APP_SCOPES_CHANGED` if it now
   asks for anything other than what was approved.
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
  checked on every request. No scope reaches settings, users, roles, webhooks or apps.
- **Be limited**: `app-rate-limit.ts` counts each app's requests, 240 a minute by default
  (`buildServer({ appRequestsPerMinute })`), and answers 429 `APP_RATE_LIMITED` with
  `Retry-After`. Each app request is written to the server log with the app's id.
- **Hear about events**: its webhook subscriptions are ordinary webhooks signed with the
  client secret, sent by `src/webhooks`. They are kept out of Settings → Webhooks.
- **Show pages in the admin**: a sidebar page, dashboard widgets, entry editor panels (for
  some or all collections) and a settings page, each drawn in a sandboxed frame. The admin
  gets a short-lived **session token** for each frame from `POST /apps/:id/session-token`
  (`app-session-tokens.ts`): an HS256 JWT signed with the client secret, naming the app, the
  person and what the app may do for them, valid for five minutes.

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

## Files

| File                     | What it does                                                             |
| ------------------------ | ------------------------------------------------------------------------ |
| `apps.table.ts`          | The `apps` table                                                         |
| `app-manifest.schema.ts` | `lintel-app.json`, checked                                               |
| `app-manifest-reader.ts` | Reading a manifest from its address, safely                              |
| `app-scopes.ts`          | The scopes and the permissions behind each                               |
| `app-credentials.ts`     | Making and recognising client ids and secrets                            |
| `app-session-tokens.ts`  | Signing and verifying session tokens (`@lintel/core/app-session-tokens`) |
| `app-rate-limit.ts`      | Each app's requests a minute                                             |
| `apps.schema.ts`         | Zod schemas for requests and responses                                   |
| `apps.routes.ts`         | The endpoints                                                            |
| `apps.service.ts`        | Installing, uninstalling, tokens and recognising apps                    |
| `apps.repository.ts`     | Database reads and writes                                                |
| `apps.errors.ts`         | Named errors with the messages people see                                |
