# Navigation

Menus, such as the main menu and the footer links. Every site gets an empty "Main menu"
(handle `main`, two levels) during setup.

A menu's items are a small tree kept as one JSON value and saved whole, because menus are
edited all at once in the admin and read all at once by websites. Each item:

```json
{
  "id": "uuid",
  "label": "About us",
  "entryId": "uuid",
  "url": null,
  "newTab": false,
  "children": []
}
```

An item may also have `"style": "button"`, drawn as a button ("Book now") instead of a plain
link; items saved without one are links.

An item links to an entry (`entryId`), so its address follows the entry's slug, or to an
address typed by hand (`url`: `https://`, `mailto:`, `tel:`, `/...` or `#...`), never both.
An entry link may leave `label` empty to use the entry's title.

## Rules

Checked on every save (`navigation-items.ts`), with each problem keyed by item id in
`fields`, so the admin can show it on the right row:

- a page or an address, not both and not neither; an address needs a label;
- no item deeper than the menu's `maxDepth` (1 to 5 levels; 1 is a flat list);
- item ids unique, at most 500 items; linked entries must exist.

## Following the page tree

A menu's `source` is `"items"` (arranged by hand) or `"pageTree"`: the site's home page,
then the pages under it in the tree's order, their children as drop-downs, as many levels
deep as `maxDepth` (`navigation-page-tree.ts`). `pageTree` keeps what is changed per page:
`includeHome`, `hiddenEntryIds` ("Hide from menu") and `labels`. The hand-made items are
kept meanwhile; switching back, the admin sends the items it shows, so nothing jumps.
`GET /navigation/:handle` answers the items as they are now either way.

## "In the main menu" on a page

`GET` and `PUT /navigation/:handle/pages/:entryId` (`{ inMenu, label? }`) read and switch a
page in a menu: the same menu the Menus screen edits, on the admin's current site. In a
hand-made menu the page's item goes under its parent page's item (if the menu has a level
for it) or beside its siblings', in the tree's order, before any buttons; switching off
removes its items and keeps what was inside them (`page-menu-items.ts`). In a menu that
follows the tree it hides or shows the page and sets its label there. Only pages (entries
of a page tree with addresses) can be switched: 400 `NOT_A_PAGE` otherwise.

## Delivery

`GET /delivery/navigation/:handle?locale=` gives `{ handle, name, locale, items }`, with
items as `{ label, url, newTab, style, entryId, children }`. Entry links become the published
entry's address, in the requested language when it has a translation there. An item whose
entry isn't published (or was deleted) is left out, with everything inside it.

## Endpoints

| Method and path                          | Permission          | Success                                                                   |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `GET /navigation`                        | `navigation:read`   | 200 `{ navigations: [Summary] }`                                          |
| `POST /navigation`                       | `navigation:update` | 201 `Navigation`, from `{ handle, name, maxDepth? }`                      |
| `GET /navigation/:handle`                | `navigation:read`   | 200 `Navigation`                                                          |
| `PUT /navigation/:handle`                | `navigation:update` | 200 `Navigation`, from `{ name?, maxDepth?, items?, source?, pageTree? }` |
| `GET /navigation/:handle/pages/:entryId` | `navigation:read`   | 200 `{ menu: { handle, name, source }, inMenu, label }`                   |
| `PUT /navigation/:handle/pages/:entryId` | `navigation:update` | 200 the same, from `{ inMenu, label? }`                                   |
| `DELETE /navigation/:handle`             | `navigation:update` | 204                                                                       |
| `GET /delivery/navigation/:handle`       | public              | 200, the menu ready to print                                              |

`Navigation` is `{ id, handle, name, maxDepth, source, itemCount, updatedAt, items, pageTree, linkedEntries }`,
where `linkedEntries` gives the title, collection and status of each linked entry by id.

## Files

| File                               | What it does                                    |
| ---------------------------------- | ----------------------------------------------- |
| `navigation.table.ts`              | The `navigations` table                         |
| `navigation.schema.ts`             | The item shape and request and response schemas |
| `navigation-items.ts`              | Pure tree rules: problems, walking, counting    |
| `navigation-page-tree.ts`          | Pure: a menu made from the page tree            |
| `page-menu-items.ts`               | Pure: where a page's item goes, or comes out    |
| `navigation-tree-items.service.ts` | A menu's items as they are now                  |
| `navigation-pages.service.ts`      | "In the main menu" on a page                    |
| `navigation.service.ts`            | Creating, saving and deleting menus             |
| `navigation-delivery.service.ts`   | Menus for websites                              |
| `navigation.repository.ts`         | Database reads and writes                       |
| `default-navigation.ts`            | The main menu, made during setup                |
| `navigation.errors.ts`             | Named errors with the messages people see       |
| `navigation.routes.ts`             | The endpoints                                   |
