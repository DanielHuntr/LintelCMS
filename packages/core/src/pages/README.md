# Pages (the visual builder's side of the API)

A blueprint field of type `page` holds a page designed in the visual builder: a tree of
elements with their styles, as described in `@lintel/builder-model` (see its README and
docs/decisions/0015-page-documents.md). Pages are saved, published and restored like any
other field, through the entries API, so drafts, publishing and revisions work unchanged.

## What saving checks

`src/fieldtypes/page-fieldtype.ts` checks the whole tree on every save
(`validatePageDocument`): the right version (older pages are migrated), known elements only
(`page-components.ts`), valid props, unique ids, elements only where they are allowed, and
only the style properties and values the builder knows. A problem comes back as the field's
message, naming the element: `Design: Heading 2: A heading level should be a number from 1 to 6`.

When a person creates or saves an entry, two more rules apply (`page-code.service.ts`):

- **Code needs `builder:code`.** Without it, a save that adds new code or changes existing
  code (the HTML, CSS or JavaScript of a code block) is refused. Moving, duplicating, hiding
  and deleting code blocks, and filling in their marked text and pictures, are fine.
  Owners and Admins have it; give it to other roles in Users → Roles to let developers
  write code.
- **Design needs `builder:design`.** Without it (the Client role), a save may change only
  the words, pictures and links the designer opened up, and add or remove items where
  allowed; anything else is refused with 403. See src/client-editing.
- **Scripts follow the site setting** `builderCustomScripts`: `removeScripts` (the default)
  takes `<script>`, `on…` attributes and `javascript:` links out of code blocks and empties
  their JavaScript when the page is saved; `allowScripts` keeps them.

Publishing and restoring a revision don't apply these rules again: they store what was
already saved by someone allowed to save it.

Instances of the site's own blocks (`customBlock` elements) have their values checked
against their block's properties on every save; see src/blocks.

An empty page (no elements) is stored as null, like any empty field.

## Endpoints

| Method and path         | Permission        | Body / success                           |
| ----------------------- | ----------------- | ---------------------------------------- |
| `GET /pages/settings`   | `entries:read`    | 200 `{ customScripts: "removeScripts" }` |
| `PATCH /pages/settings` | `settings:update` | `{ customScripts }` → 200 the settings   |

## Files

| File                   | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `page-components.ts`   | The components saved pages may use (add code components here) |
| `page-code.service.ts` | The code permission and script rule for one save              |
| `pages.schema.ts`      | The settings' shape                                           |
| `pages.service.ts`     | Reading and saving the settings                               |
| `pages.routes.ts`      | The endpoints                                                 |
| `pages.test.ts`        | Saving designs, the code rules and the settings               |
