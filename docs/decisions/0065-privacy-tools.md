# 65. Privacy tools

Date: 2026-11-03

## Decision

Settings → Privacy gives site owners the tools to meet data protection duties (GDPR, UK GDPR
and similar): a map of where personal data lives, finding, exporting and erasing one person's
data, retention rules, consent records, a privacy policy helper and a list of outside companies.
It needs the new `privacy:manage` permission, which Owners and Admins have.

- **We never say "compliant".** Lintel gives tools and defaults; compliance also depends on how
  a site is run. Suggested wording always says it's a starting point, not legal advice.
- **One list of kinds of data.** The map, search, export and erasure all read the same list
  (`personal-data-sources.ts`), so nothing can be on the map but missed by erasure, or the other
  way round. Lintel's own kinds are in `core-sources.ts`.
- **Plugins declare theirs.** `personalData` in `definePlugin` gives tables and columns (each with
  `personalData: true` where it applies) and `find`, `export` and `erase` hooks. An add-on can also
  declare the same `tables[].columns[]` under `personalData` in the `lintel-addon` section of its
  package.json, which needs no code. Without all three hooks it is listed as "can't be searched",
  and so is one with tables that says nothing. Its own `definePlugin` declaration wins.
- **Hooks run while a plugin is off**, because switching a plugin off deletes nothing.
- **Matching is exact.** An email matches whole, ignoring case; a name matches as a whole value.
  "Ann" never finds "Anne". An erasure can't be undone, so a search must not sweep up someone else.
  Names can still be shared, so the confirmation warns after a search by name.
- **Requests are recorded without the person.** `privacy_requests` holds who on the team did it,
  when, and how much of each kind: never an email or name. That means Lintel can't re-erase someone
  after a restore, and the docs say so. The record is left out of backups so a restore can't lose
  it, and a failed erasure still records what it finished.

### What erasing does

| Kind                           | Rule                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| Form entries, customers        | Deleted                                                                               |
| Baskets                        | Deleted. Unfinished checkouts have the person removed, as they may hold stock         |
| Orders                         | Kept for tax. Email, name, address and phone go; items, amounts, country, region stay |
| Security log                   | Kept as a record. Email, name, IP, browser and details go                             |
| Webhook and automation history | Deleted, except runs still going, which need what they hold                           |
| Admin accounts                 | Kept: removing someone needs their work reassigned, which Users does                  |

### Retention defaults

The rule: **leftovers nobody expects to keep are tidied from the start; what a person sent or
bought is kept until the owner chooses**, because deleting it unasked could surprise them.

| Rule              | Default        |
| ----------------- | -------------- |
| Abandoned baskets | On, 30 days    |
| Activity logs     | On, 90 days    |
| Form entries      | Off, 12 months |
| Orders            | Off, 7 years   |

Forms with their own "keep entries for" keep following it. Lengths are short lists, not number
boxes. Activity logs cover the security log, webhook deliveries and finished automation runs; runs
about an entry stay, because that's how its reviews are found.

## Why

- Site owners, not Lintel, are responsible for their visitors' data, but non-technical owners can't
  run SQL when someone writes in. The tools have to be there and plain.
- Orders can't simply be deleted: tax law needs the record. Anonymising keeps the record and removes
  the person.
- Copies matter as much as the original. Webhook deliveries and automation runs keep the event that
  started them, order history names the customer, and security events can hold an email in their
  details. Erasing only the obvious rows would say "done" while the person was still there.

## Consequences

- Upgrading switches on two rules, so old baskets and activity logs older than the limit go in the
  first hourly run. The security log's "only ever added" rule no longer holds; its README says so.
- Backups can't be changed, so erased data stays in them until they're replaced, and a restore
  brings it back. Outside companies keep their own records. The confirmation and docs say both.
- Messages an automation wrote into a notification, and text typed into pages, aren't searched.
- The policy check only looks for words. It can miss things, and says so.
- The add-on manifest key may meet the same key from another branch; the shape is what matters.
