# Publishing Log: a reference Lintel app

A small app in plain Node (`node:http`, no framework) that shows every part of the app
model, so it can be read top to bottom or copied into another language:

- `lintel-app.json`, served at `/lintel-app.json` (built in `src/config.ts`): one scope
  (`read_content`), two webhooks, a sidebar page, a dashboard widget, an editor panel and a
  settings page.
- **Session tokens** (`src/session-tokens.ts`): checking the token the admin hands the page,
  with `node:crypto` only.
- **Webhooks** (`src/webhook-signatures.ts`): checking `Lintel-Signature` on the raw body.
- **Calling Lintel** (`countCollections` in `src/server.ts`): `Authorization: Bearer <client secret>`.
- **The embedded page** (`public/page.js`): `@lintel/app-bridge` served as plain files, the
  page asking its own server for data with `lintel.fetch`, resizing, a toast and navigation.
- **Framing rules**: every admin page is sent with `Content-Security-Policy: frame-ancestors
<the Lintel admin>`, so no other site can embed it.

The tests (`src/app.test.ts`) use Lintel's own signing code to check that the app's checks,
written without Lintel, agree with what Lintel sends.

## Try it

```bash
pnpm --filter example-app-node start          # http://localhost:3100
```

1. Start Lintel with `WEBHOOKS_ALLOW_PRIVATE_ADDRESSES=true`, so it may read the manifest and
   send webhooks to localhost (leave that off on a real server).
2. In the admin, open Settings → Apps → Add an app, and give
   `http://localhost:3100/lintel-app.json`.
3. Approve it, then start the app again with the values Lintel shows:

```bash
LINTEL_CLIENT_ID=app_... LINTEL_CLIENT_SECRET=lintelapp_... pnpm --filter example-app-node start
```

| Variable               | Default                 | What it is                         |
| ---------------------- | ----------------------- | ---------------------------------- |
| `PORT`                 | `3100`                  | Where the app listens              |
| `APP_URL`              | `http://localhost:3100` | Where Lintel and browsers reach it |
| `LINTEL_ADMIN_URL`     | `http://localhost:5173` | The admin that may embed it        |
| `LINTEL_API_URL`       | `http://localhost:4000` | The API it calls                   |
| `LINTEL_CLIENT_ID`     | none                    | From Lintel, when installed        |
| `LINTEL_CLIENT_SECRET` | none                    | From Lintel, when installed        |

The same checks in C# and Python are in the docs page "Building an app".
