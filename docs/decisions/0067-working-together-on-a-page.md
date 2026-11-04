# 0067: Working together on a page

Date: 4 November 2026. Status: accepted. Builds on decisions 0006, 0011, 0048 and 0053.

## Context

Two people working on a site at once could overwrite each other without knowing: the second
save simply won. Agencies and their clients work on the same pages, so people need to see each
other and must not lose work.

Lintel is self-hosted. This has to run behind one Node process, on the built-in database and on
Postgres, with no outside service, and it has to do no harm on hosting that blocks WebSockets.

## Decision

Three layers, each useful alone.

### Who is here

One WebSocket per browser, `GET /live`, on Lintel's own server. One tab holds it, under a Web
Lock, and the others talk through it over a BroadcastChannel. Where those aren't offered (a
page on plain HTTP) each tab opens its own.

Who is where is held in memory. It only means anything while people are connected, and Lintel is
one process, so there is no table for it and nothing to clean up after a crash.

A plain WebSocket rather than Server-Sent Events: browsers allow six connections to an address
over HTTP/1.1, which tabs would use up, and editing needs messages both ways.

### Safe saving

`entries` has a `version` that goes up with every change, set by `$onUpdate` so all eighteen
places that update an entry count without being changed. A save may send `baseVersion`, and is
refused with 409 `ENTRY_CHANGED` if the entry has moved on. The write itself is conditional
(`where version = ?`), so two saves at the same moment can't both pass the check.

- **Nothing clashes:** the admin fetches the entry, merges, and saves again. Nobody is asked.
- **Both changed the same thing:** saving stops and asks, naming the person and what they both
  changed. "Keep mine" saves over theirs, which stays in History. "Use theirs" puts this person's
  version in History first, as a `kept` revision, so nothing is lost either way.

Saves that send no `baseVersion` work as before, so API clients aren't affected. They also read
again if they lose a race, rather than putting back what they read: two people saving different
fields at the same moment no longer lose one of them.

A/B versions (`baseUpdatedAt`) and the site's navigation and footer (`baseRevisions`, per
section) get the same check. Site styles already had it.

### Live editing

**A server-ordered list of small steps, not a CRDT.** Pages are trees of elements with ids that
never change, which is what makes this simple:

- A change is a list of steps (`set`, `text`, `insert`, `move`, `remove`) naming element ids.
  `diffPages` works them out from two versions of a page, so none of the builder's commands
  changed. `applyPageChanges` is pure, and a step about something gone does nothing.
- The server applies everyone's steps one at a time, in one order, and passes them on.
- Each browser keeps two layers: what the server confirmed, and its own unconfirmed edits on top.
  Everyone applies the same steps in the same order, so everyone ends with the same page.
- Two people changing the same value: the later one stands, on every screen, as with any
  shared document. Words are the exception: `text` steps carry the words before and after, so
  edits in different parts of a sentence are both kept.

**Why not Yjs.** It was the obvious choice, and is MIT licensed. It doesn't fit here:

- **The server has to be able to say no.** A client may change words but not design, and the
  server has to enforce that on every message. A CRDT update can't be refused: it is already
  applied on the sender's side, and taking it back means another update and a way to tell the
  client. Here refusing is just not applying a step, and saying so.
- **Moving elements.** Yjs has no move: moving is delete and insert, so two people moving one
  section can make two copies of it. Here `move` names the element, and the second one wins.
- **Validity.** A page must pass `validatePageDocument`. With merges happening in each browser,
  an invalid page can only be found after everyone has it. Here it's checked before anyone does.
- **What it buys isn't needed.** Peer-to-peer and long offline work are why a CRDT is worth its
  weight. Lintel always has one server, and that server is the place to put things in order.

**Saving.** While a design is live, the server stores it: a second after the last change, at
least every five seconds, before anything reads it (publishing, a save, a restore), when the last
person leaves and when the server stops. Browsers keep what isn't confirmed stored, and send it
again if the server restarted before storing it.

**Permissions.** Every `changes` message goes through what a save goes through
(`validateForCollection`, with `findDesignChanges` for clients and the code rule), with that
person's permissions as they are now. Storing doesn't ask again: each step was checked against
the person who made it, and a client storing a page isn't holding a designer's changes against
themselves. What someone may do is read again every five seconds at most.

**Undo stays per person.** Undo in the builder keeps whole pages. Other people's steps are applied
to every page in the history too, so undoing takes away this person's change and nothing of
anyone else's: what someone added stays, what they removed stays gone, and an element this person
deleted comes back with what was done to it meanwhile.

**History.** People editing together share a line in History for five minutes, under the name of
the first of them, rather than a line for each store.

### What stays as it was

- **Publishing** is unchanged. It stores what's open first, then copies the saved values, so it
  includes what everyone has done so far and nothing goes live without someone pressing Publish.
- **A/B versions** aren't live. A version saves as it did, with the check above, and the original
  carries on merging in the background while someone is on a version.
- **The site's navigation and footer** aren't live either (decision 0048): they save as a draft
  of their own, with the check above. Steps are about the page without them, and the builder puts
  them back around each update.
- **Components' variants** are props, so they merge like any other prop, and clients may change
  them only where the component allows.

### Not a plugin

Safe saving protects every save, so it can't be switched off. Presence and live editing are the
same connection and the same save path, and they already turn themselves off when the connection
is blocked, so a switch would add a setting for nobody.

### When the connection is blocked

Nothing depends on it. The page opens, waits up to four seconds, and saves through the API as it
always has, with safe saving. Nobody appears on pages and nothing says so. If the connection drops
part way, edits are held on the screen and merged on its return; after twenty seconds saving goes
through the API instead, which is safe because of `baseVersion`.

## Consequences

- Words typed on the canvas reach others when typing ends, not letter by letter, because that is
  when the builder hears about them. Others see the element selected meanwhile.
- A change made to something someone else has just removed does nothing. Undoing the removal
  brings it back.
- Live editing needs one process. Two Lintel processes behind a load balancer would each hold
  their own rooms. Saves stay safe, because of `baseVersion`, but stores from two processes would
  be refused or merged as if from two people. Lintel doesn't run that way today.
- Only the first selected element is shown to others.
- Blocks, menus, global settings, forms and media aren't covered: they still save the last
  change, as they always have.
