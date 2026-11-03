# 53. Content-only editing for clients

Date: 2026-11-03

## Decision

Agencies design a site in the builder, then give their clients access that only lets them
update content.

- **A permission for designing.** `builder:design` ("Design pages") lets someone change how
  pages look and are laid out. Owners, Admins, Editors and Authors have it. Before, anyone
  who could edit a page could design it; custom roles that could edit content were given
  `builder:design` by migration 0031, so nobody lost anything.
- **A built-in role, "Client (content only)"** (handle `client-content-only`): sees, creates,
  edits and publishes content, uploads media, and sees menus and site-wide content. No
  design, blocks, code, settings, templates, plugins or people.
- **The designer says what clients can change, per element.** Nodes carry `clientEdits`
  (`["words", "pictures", "links"]`, any of them, or `[]` for nothing) and `clientRepeats`
  ("Clients can add more of these": copy and remove the items inside it, or a list's items
  in its props). Left out, defaults apply: text gives words, pictures give pictures, buttons
  and links give words and links, and layout, styling, code, forms, the shop, collection
  lists and the site's menus give nothing. Old pages need no migration.
- **The client's view.** Without `builder:design`, the builder opens in "Edit content": the
  page as it looks, words typed in place, a click on a picture opens the media library, and
  a panel with only the fields they may change, plus "Add another" and "Remove this one"
  where allowed. No Insert, Layers, Style, Animate, site styles, code, section tools,
  dragging or deleting designed parts. Undo and History work; a short tour of its own.
- **The server enforces it.** A save by someone without `builder:design` is compared with the
  stored design (`findDesignChanges` in `@lintel/builder-model`) and refused with 403
  `DESIGN_CHANGE_NOT_ALLOWED` and a plain message naming the element when anything else
  changed. The navigation, footer, site styles and blocks already need `builder:blocks`.
- **Approval is a site setting**, "Clients' changes": Go live when they publish (the
  default), or Wait for approval. Waiting, a client's Publish becomes Send for review, and
  publishing, scheduling and unpublishing by a client is refused (403 `REVIEW_NEEDED`).
  Reviews (`client_reviews`) point at the entry; its saved values are the changes, as with
  any draft (decision 6). People who may publish and design see "Waiting for review" on the
  dashboard and in the collection view's filter, and Approve (publishes) or Send back with a
  note, which the client sees in the editor and the builder.

## Why

Agencies hand sites to clients who should keep the words and pictures fresh without
breaking the design. A client view that hides the tools is not enough on its own: the API is
public, so the rule lives on the server, in the same compare-on-save place as the code
permission (`builder:code`).

Defaults on the element types mean a designer doesn't have to mark anything to hand a site
over: text, pictures, buttons and links are open, the layout is not.

Approval is a small table of its own rather than the Automations plugin's content approval,
because the setting must work with Automations off, and because it is about who made the
change (a client), not which collection it is in.

## Consequences

- Restoring an older revision isn't checked against the design: it brings back something
  a designer saved.
- The site's own blocks and code blocks are closed to clients for now; their marked text and
  pictures could be opened up later the same way.
- A client creating a page gets an empty design, and the client's view says the designer
  will lay it out first.
