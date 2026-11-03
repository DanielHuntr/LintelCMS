# 58. External apps: manifests, scoped credentials and sandboxed frames

Date: 2026-11-01

## Decision

Besides plugins (trusted TypeScript built into Lintel, see 0011), Lintel can be extended by
**apps**: programs on their own servers, in any language, that never touch Lintel's code.

- **A manifest.** An app describes itself in `lintel-app.json`: name, handle, icon,
  description, its own address (`appUrl`), the scopes it wants, webhook subscriptions, and
  admin pages (a sidebar page, dashboard widgets, editor panels for chosen collections, a
  settings page). An admin adds it in Build → Apps from the file's address or pasted in,
  sees what it asks for in plain English, and approves. Lintel keeps the copy that was
  approved and reads it again on install, refusing if the scopes changed in between.
- **Scopes, not permissions.** Five scopes (`read_content`, `write_content`,
  `publish_content`, `read_media`, `write_media`), each a fixed set of permissions. None
  reaches settings, users, roles, webhooks or apps. An app acts for the admin who
  installed it and gets its scopes' permissions _that admin also has_, worked out on every
  request, like API tokens.
- **One credential.** Installing makes a client id (public) and a client secret
  (`lintelapp_…`, shown once). The app sends the secret as `Authorization: Bearer`, through
  the same door as API tokens, so every guarded route, the delivery API and GraphQL work
  without changes. The same secret signs the app's webhooks and its session tokens, so a
  developer handles one secret. Requests are limited per app (240 a minute by default)
  and logged with the app's id.
- **Frames, with a short-lived token.** App pages are drawn in sandboxed iframes inside the
  admin's existing extension points: each installed app becomes an admin plugin definition
  in a second, always-on list. When the page says it is ready (`@lintel/app-bridge`), the
  admin fetches a session token (HS256 JWT: app id, user id, the app's permissions for that
  person, five minutes) and posts it to the app's origin only. The app's page sends it to
  its own server, which verifies it with the client secret.
- **Uninstalling takes everything back at once.** The app row goes; its webhooks
  (`webhooks.app_id`, cascading) and their log go with it; the secret stops working on the
  next request; its pages leave the admin.

## Why

- **Any language.** The contract is HTTP, JSON, HMAC-SHA256 and a standard JWT. A C# or
  Python app needs nothing from us; the docs show both. The reference app does it with
  `node:crypto` only, and its tests check it against Lintel's own signing code.
- **Least access, decided by a person.** Scopes are few and worded for the person
  approving them. Capping by the installer's permissions means an app can never be a way
  round someone's role, and re-reading the manifest on install means it can't change
  between "Review" and "Install".
- **Frames isolate code we don't trust.** Unlike a plugin, an app's front end never runs
  in the admin's origin. Messages are accepted only from the app's origin _and_ from that
  frame's window, and only in the bridge's exact shapes; tokens are posted only to the
  app's origin. The sandbox allows scripts, forms, popups and downloads, and
  `allow-same-origin` so the app keeps its own cookies. That last flag would undo the
  sandbox if the frame shared the admin's origin, so apps on Lintel's own addresses are
  refused when installing and again when framing. No `allow-top-navigation` and no browser
  features (`allow=""`): an app opens admin screens through the bridge, which only accepts
  paths inside the admin.
- **Session tokens rather than cookies.** Third-party cookies in frames are unreliable and
  being removed from browsers. A token passed by `postMessage` works everywhere, says
  exactly who is looking, and expires in five minutes; the bridge asks for a fresh one.
  This is the one place Lintel uses JWTs (0004 keeps admin sessions server-side): the
  receiver is someone else's server, and JWT is what every language can verify.

## Trade-offs

- **The client secret is stored as it is**, like a webhook's secret, because Lintel signs
  with it; its SHA-256 hash is what requests are matched by. A copy of the database is
  enough to act as an installed app. Encrypting secrets at rest would need a server key
  that installs don't have today; when one exists, this column should use it.
- **Session tokens can't be recalled.** After uninstalling, a token already handed out
  stays valid for up to five minutes on the app's side. It opens nothing in Lintel.
- **The rate limit is per server process**, in memory. Behind a load balancer each server
  counts on its own; it is there to stop runaway loops, not to meter use.
- **No separate security log** exists yet; app requests go to the server log with the
  app's id, and "last used" is shown on the app's page. When a security log arrives, the
  app branch of `api-token-auth.ts` is where to write to it.
- **The admin sends no Content-Security-Policy of its own.** If a host adds one, its
  `frame-src` must allow installed apps' origins. Apps should send `frame-ancestors` with
  the admin's origin (the reference app does), so no other site can frame them.

## Alternatives considered

- **OAuth 2 authorisation-code installs**, as Shopify does for public apps: right for an app
  store, where one app is installed on thousands of sites. A self-hosted Lintel installs a
  handful of apps it chose; copying a client id and secret is simpler and has fewer moving
  parts. The manifest and scopes would carry over if an app directory is added later.
- **Separate API keys and signing secrets**: one more secret for every developer to keep,
  for no gain while the app is the only holder of both.
- **Running app front-ends in the admin (like plugins)**: fastest, but the app's code would
  run with the signed-in person's session. Plugins are for code you would build into
  Lintel; apps are for code you wouldn't.
