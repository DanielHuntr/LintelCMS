# Search

One search across the admin: entries and media, for the command palette (Cmd/Ctrl+K).
The admin adds its own pages (Settings, Content types...) on its side, since they are screens
rather than data.

## Endpoint

| Method and path         | Permission | Success                          |
| ----------------------- | ---------- | -------------------------------- |
| `GET /search?q=&limit=` | signed in  | 200 `{ query, entries, assets }` |

Each kind needs its own permission: entries need `entries:read`, media needs `media:read`.
A kind the person can't see is `null` (and isn't searched), so the admin can tell "nothing
found" from "not yours". `limit` is per kind, 8 by default and at most 25.

## How matching works

`search-terms.ts` keeps only the letters and numbers of what was typed, so the query is
always safe to hand to Postgres, and treats every word as a prefix: "abo us" finds
"About us". A search with no letters or numbers finds nothing.

- **Entries** use Postgres full-text search, which the built-in database (PGlite) has too,
  with the "simple" configuration (no stemming, the same in every language). The document
  is the title (weighted highest), the slug, then every text value in the entry's fields,
  read with `jsonb_to_tsvector(..., '["string"]')`, so text inside rich text and blocks
  counts and JSON keys don't. A title containing the search anywhere also matches, for the
  middle of a word ("port" in "Support"). Best match first, then most recently changed.
- **Media** matches every word in the file name or alt text, newest first.

There is no search index yet: page and post counts on a single site are small enough for a
scan. If that changes, a GIN index on the same expression is the next step.

## Files

| File                   | What it does                                       |
| ---------------------- | -------------------------------------------------- |
| `search-terms.ts`      | Turning what was typed into safe prefix words      |
| `search.service.ts`    | What the person may search, and the response shape |
| `search.repository.ts` | The full-text and file name queries                |
| `search.schema.ts`     | Zod schemas for the query and the response         |
| `search.routes.ts`     | The endpoint                                       |
