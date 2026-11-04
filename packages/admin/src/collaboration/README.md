# Working together

The admin's end of the live connection (see `packages/core/src/collaboration`) and the screens'
ways of using it.

| File                      | What it is                                                         |
| ------------------------- | ------------------------------------------------------------------ |
| `liveSocket.ts`           | The WebSocket: keeps it alive, reopens it, gives up politely       |
| `sharedLink.ts`           | One connection per browser: one tab holds it, the others use it    |
| `LiveClient.ts`           | This tab's end: what to say again after reconnecting, who is where |
| `useLiveClient.ts`        | The client for the person signed in                                |
| `usePeople.ts`            | `usePeopleHere`, `usePeopleOnPage`, `useWatchSite`                 |
| `PeopleHere.tsx`          | Avatars for the top bar and tree rows                              |
| `personColour.ts`         | Each person's colour                                               |
| `collaborationStrings.ts` | The words                                                          |

## When the connection is blocked

Some shared hosting doesn't pass WebSockets on. The admin tries a few times, then only every
five minutes, and shows nothing about it: nobody appears on pages, and saving works through the
API as it always has. Nothing on a screen waits for the connection.
