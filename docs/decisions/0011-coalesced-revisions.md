# 11. Autosaves gather into one revision per person

Date: 2026-11-01

## Decision

Revisions have a `kind`: `edited`, `published`, `unpublished`, `scheduled` or `restored`.
Autosaves don't each write a revision. One person's run of edits goes into a single open
`edited` revision that is updated in place, keeping the latest values and moving its
`updatedAt` on. A new revision starts when:

- someone else edits the entry;
- the open revision is 30 minutes old;
- the person presses Save version (Cmd/Ctrl+S), which closes the revision it saves into;
- the entry is published, unpublished, scheduled or restored. Each of those gets a
  revision of its own and closes any open one.

A restored revision records when the revision it brought back was made
(`restoredFromAt`), so History can say "Restored from 2 Nov, 14:05".

This replaces the "every save writes a revision" part of decision 0006.

## Why

The editor saves a second or so after someone stops typing. With a revision per save,
filling in a few fields filled History with identical "Saved" lines, burying the moments
that matter (publishing, someone else's change, a version someone chose to keep). Thirty
minutes is long enough to cover one sitting and short enough that a morning's work and an
afternoon's stay separate.

Only the latest revision can be joined, so history is never rewritten behind an event:
once something is published, the edits before it stay exactly as they were.

## Alternatives considered

- **Pruning old autosave revisions in a background job**: History would still flood
  between runs, and deleting rows is harder to reason about than never writing them.
- **Revisions only on explicit save**: simple, but people who never press Cmd+S would have
  no history at all.
