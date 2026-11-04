# Collaboration

Two people working on a site at once: seeing each other, and not overwriting each other. See
`docs/decisions/0067-working-together-on-a-page.md`.

One WebSocket per browser, `GET /live`, on Lintel's own server. Nothing goes through another
service, nothing here needs a second process, and the built-in database and Postgres work the
same, because who's where is held in memory. If the connection is blocked, the admin carries
on without it (see `packages/admin/src/collaboration`).

| File                        | What it is                                                 |
| --------------------------- | ---------------------------------------------------------- |
| `collaboration.routes.ts`   | `GET /live`: who may connect                               |
| `register-collaboration.ts` | Sets the hub up on the server                              |
| `collaboration-hub.ts`      | Everyone connected, and what each message does             |
| `live-connection.ts`        | One browser: limits, message order, re-reading permissions |
| `live-presence.ts`          | Who is on which page                                       |
| `live-design-rooms.ts`      | The designs open now                                       |
| `live-design-room.ts`       | One design: puts everyone's steps in one order             |
| `live-design.service.ts`    | Reading, checking and storing a design                     |
| `live-limits.ts`            | How much one browser may ask for                           |
| `message-budget.ts`         | Counts messages and bytes against those limits             |

The messages are in `packages/builder-model/src/live-editing/live-messages.ts`, shared with
the admin. Every message is parsed against those schemas before it is read.

## Who may connect

- **Signed in, in a browser.** The session cookie, as the admin uses; API tokens aren't accepted.
- **From the admin.** `Origin` must be the admin's or the API's. Browsers send cookies with a
  WebSocket from any website, so this is what stops another site using someone's session. A
  request with no `Origin` is refused too.
- **Two-factor set up**, if their role requires it.

## On every message

- It is counted (`MessageBudget`). Too many, and it is refused; twenty refusals close the
  connection (close code 4408).
- It is parsed. A message over 1 MiB closes the connection.
- What the person may do is read again when what we hold is over 5 seconds old, and on every
  sweep (20 seconds), for quiet connections. A session that ended closes the connection (4401);
  someone who lost access to a site is taken off its pages.
- It is checked against that: being on a page needs `entries:read`, the entry's site and the
  person's own tenant. A page out of reach reads the same as one that doesn't exist.

People appear by name and picture. Email addresses aren't sent.

## Editing a design together

A room opens with the first person to open a design and closes with the last. It holds the design
and applies each person's steps one at a time, so there is one order for everyone (see
`packages/builder-model/src/live-editing`). Each message goes:

1. `changes` arrives. The person must be on the page, in the room, and able to edit the entry.
2. The steps are applied to a copy, and the result goes through what a save goes through, with that
   person's permissions: `validateForCollection`, which holds a client to their designer's rules
   and keeps code from people who may not add it.
3. Refused: `changesRefused` with the reason, and nobody else hears a thing.
4. Accepted: everyone else gets `designChanged`, and the sender `changesAccepted`.

A batch is remembered by its id, so one sent twice around a dropped connection counts once.

**Storing.** The entries table stays the truth. A room stores about a second after the last change,
at least every five seconds, and before anything reads or replaces the saved design: `PATCH`,
publishing and restoring all call `storeOpenDesigns` first. A room also stores when its last person
leaves and when the server stops. Storing doesn't ask what the person may change: each step already
answered that. A save made some other way comes back through `entryChanged` and is merged in.
