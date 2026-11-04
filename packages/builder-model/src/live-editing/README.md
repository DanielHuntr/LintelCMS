# Live editing

How one page is edited by several people at once. No sockets and no React here: the same code
runs in the browser and on the server, which is why everyone ends up with the same page. The
reasons are in `docs/decisions/0067-working-together-on-a-page.md`.

| File               | What it is                                                                |
| ------------------ | ------------------------------------------------------------------------- |
| `page-changes.ts`  | Steps: `diffPages`, `applyPageChanges`, `findClashes`, and their schema   |
| `merge-text.ts`    | Two people's edits to the same words                                      |
| `live-document.ts` | One person's copy: what the server confirmed, with their own edits on top |
| `live-messages.ts` | Everything said over the live connection, and the schemas that check it   |

## The rules a step keeps

- It names elements by id, never by position, so it means the same after others move things.
- A step about something that has gone does nothing. Applying can't fail.
- Applying is pure and deterministic. Don't read the clock or anything else outside the page.
- It can be applied twice without harm, because a connection can drop after a step was accepted
  and before the browser heard.

## Adding something to a page

A new value on `PageNode` needs nothing here: `diffPages` compares every key, and sends a value it
doesn't look inside as a whole. Teach `compareValues` about it only if two people should be able
to change parts of it at once, as with `props` and `styles`.
