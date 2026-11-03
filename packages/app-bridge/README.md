# @lintel/app-bridge

The part of a Lintel app that runs in the app's own page, inside the Lintel admin's frame.
It has no dependencies and works with any framework, or none, whatever language the app's
server is written in.

```html
<script type="module">
  import { createAppBridge } from "/assets/app-bridge/index.js";

  const lintel = createAppBridge();
  const { context } = await lintel.ready(); // who is looking, and where
  lintel.autoResize(); // the frame follows the page's height

  // Calls to the app's own server carry a fresh session token, which the server verifies
  // with the app's client secret (HS256 JWT) before trusting anything in it.
  const stock = await (await lintel.fetch("/api/stock")).json();

  lintel.toast("Stock updated", { tone: "success" });
  lintel.navigate("/content/products"); // opens an admin screen
</script>
```

## What it guarantees

- It only sends to the Lintel admin's origin (never `"*"`), and only listens to messages
  from that origin, sent by the window that embeds the page.
- It only accepts session tokens made for that admin (the token's `dest` claim). The app's
  server must still verify every token; the bridge's checks are a first filter, not proof.
- The admin's origin comes from the `lintelOrigin` query parameter the admin adds to the
  frame's address, unless you pass `lintelOrigin` yourself, which is better when the app is
  only ever installed on one Lintel.

## The messages

`src/protocol.ts` is shared with the admin, which reads messages with the same functions.
Each is `{ protocol: "lintel-app-bridge", version: 1, type, ... }`:

| From  | `type`                  | Fields                                     |
| ----- | ----------------------- | ------------------------------------------ |
| app   | `ready`                 | none                                       |
| app   | `resize`                | `height` (CSS pixels, up to 10,000)        |
| app   | `toast`                 | `message` (up to 200 characters), `tone`   |
| app   | `navigate`              | `path`, inside the admin (starts with `/`) |
| app   | `request-session-token` | `requestId`                                |
| admin | `context`               | `context`, `sessionToken`, `expiresAt`     |
| admin | `session-token`         | `requestId`, `sessionToken`, `expiresAt`   |
| admin | `session-token-failed`  | `requestId`, `message`                     |

## Files

| File                | What it does                          |
| ------------------- | ------------------------------------- |
| `src/app-bridge.ts` | `createAppBridge`, the app's side     |
| `src/protocol.ts`   | The messages, and reading them safely |
| `src/index.ts`      | What the package exports              |
