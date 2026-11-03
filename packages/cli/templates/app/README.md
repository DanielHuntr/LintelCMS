# **APP_NAME**

An app for Lintel, in plain Node with no framework and nothing to build. It runs on its
own server and only gets the access it asks for in `src/manifest.js`.

| File                        | What it does                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `src/manifest.js`           | The app's `lintel-app.json`: its name, scopes, webhooks, page  |
| `src/server.js`             | The app's server: the manifest, the page, its API and webhooks |
| `src/session-tokens.js`     | Checks the token the admin gives the page, before trusting it  |
| `src/webhook-signatures.js` | Checks that a webhook really came from Lintel                  |
| `public/page.js`            | The page shown inside Lintel, using `@lintel/app-bridge`       |
| `test/app-checks.js`        | Tests for all of the above (`npm test`)                        |

## Try it on your computer

1. `npm install`, then `npm start`. The app runs at http://localhost:3200.
2. In Lintel, open **Build → Apps** and turn on **Development mode**, so Lintel may reach
   an app on this computer. (It's only offered while Lintel runs in development.)
3. Press **Add an app** and give `http://localhost:3200/lintel-app.json`.
4. Lintel shows a client ID and a client secret once. Copy `.env.example` to `.env`, put
   them in, and start the app again. Its page is now in Lintel's sidebar.

Turn development mode off when you've finished. On a real server, the app needs an
`https://` address.

## Settings

| Variable               | Default                 | What it is                         |
| ---------------------- | ----------------------- | ---------------------------------- |
| `PORT`                 | `3200`                  | Where the app listens              |
| `APP_URL`              | `http://localhost:3200` | Where Lintel and browsers reach it |
| `LINTEL_ADMIN_URL`     | `http://localhost:5173` | The admin that may show its page   |
| `LINTEL_API_URL`       | `http://localhost:4000` | The API it calls                   |
| `LINTEL_CLIENT_ID`     | none                    | From Lintel, when installed        |
| `LINTEL_CLIENT_SECRET` | none                    | From Lintel, when installed        |

Changing the scopes or webhooks in `src/manifest.js` changes nothing until the app is
installed again: Lintel keeps the copy the person approved.
