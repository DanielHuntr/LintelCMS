# Sites

A site is one website served by this install, in one language: "Acme UK in English" and
"Acme France in French" are two sites. Entries belong to a site, so the same collection
can hold each site's own pages.

For now every install has exactly one site, created the first time anything needs it
(`findOrCreateDefaultSite`). Managing several sites, domains and languages comes later.

| File                  | What it does                                       |
| --------------------- | -------------------------------------------------- |
| `sites.table.ts`      | The `sites` table                                  |
| `sites.service.ts`    | `findOrCreateDefaultSite` and the default's values |
| `sites.repository.ts` | Database reads and writes                          |
