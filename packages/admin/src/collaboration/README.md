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
| `useLiveDesign.ts`        | A design edited live: connects `LiveDocument` to the connection    |
| `useLiveActivity.ts`      | Pointers, selections and which field someone is in                 |
| `useEntryLiveUpdates.ts`  | A page's Content view taking in what others save                   |
| `FieldPeople.tsx`         | "Sam is editing this" on a field                                   |
| `ConflictDialog.tsx`      | The question when two people changed the same thing                |
| `describeClashes.ts`      | Says what clashed, in the words people know it by                  |
| `collaborationStrings.ts` | The words                                                          |

## When the connection is blocked

Some shared hosting doesn't pass WebSockets on. The admin tries a few times, then only every
five minutes, and shows nothing about it: nobody appears on pages, and saving works through the
API as it always has, with its saves still checked. Nothing on a screen waits for the connection.

## When it drops part way

The designer says **Reconnecting…** and edits stay on screen, held by `LiveDocument`. On its return
the tab says again what it wants, the server sends the page as it is now, and the waiting edits go
on top. After 20 seconds without it, saving goes through the API instead.
