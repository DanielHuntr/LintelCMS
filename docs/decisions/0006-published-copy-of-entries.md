# 6. Entries keep a copy of their published values

Date: 2026-10-31

## Decision

An entry has two sets of values: `data`, the working copy editors save, and
`publishedData`, a copy taken when it was last published. The public delivery API reads
only `publishedData`. Every edit, publish, unpublish and restore also writes a revision (autosaves are gathered; see decision 0011).

## Why

Editors need to fix a live page over several saves without each half-finished save
appearing on the site. With one copy, "save" would mean "publish", or drafts of live pages
would need a second entry. Two columns on the same row keep it simple: delivery has one
filter (`published_data is not null`) that drafts can't slip past, and
`hasUnpublishedChanges` is a comparison of the two values, so saving without changing
anything doesn't claim there is something new to publish.

Scheduled entries publish from an in-process timer that runs on startup and every minute.
Each due entry is claimed in one `update ... where status = 'scheduled'`, so several
servers can run it side by side. A job queue can replace the timer later without changing
how publishing works.

## Alternatives considered

- **Delivering from the latest "published" revision**: no extra column, but every
  delivery request would need a lookup in a table that only grows.
- **A separate drafts table**: cleaner in theory, but every query and join would have to
  choose which one to read, and moving rows between them on publish is easy to get wrong.
- **Slugs and parents in the published copy too**: more exact, but it means two sets of
  unique slugs to keep apart. For now, slug and parent changes take effect straight away.
