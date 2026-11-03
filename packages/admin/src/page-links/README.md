# Page links

"Choose a page…" beside a link's address: find a page by its title and link to it, rather
than typing its address. It appears in:

- the rich text link form (`fields/RichTextLinkForm.tsx`): the selected words are linked,
  or the page's title is inserted, linked, when nothing is selected;
- Link fields (`fields/LinkFieldEditor.tsx`): the address, and the link text when there is
  none yet;
- the page builder's Content panel, for buttons, links, cards and every other element with
  a link, and for lists of links (`PageDesignPage.tsx` gives the builder `pickPage`; see
  `packages/builder/src/panels/page-picker.ts`).

Menus already link to pages by their id ("Choose page" in `menus/MenuItemSheet.tsx`) and are
left as they are. Typing a full web address still works everywhere.

## What it stores

The page itself, as `lintel:page/<entry id>` (`pageLinkHref` from `@lintel/builder-model`),
in the place the address would go. Lintel puts the page's current address in its place
wherever the link is drawn, so the link follows the page when it is renamed or moved; see
`docs/decisions/0032-links-to-pages-by-id.md`. Where such a link is edited, the page's title
shows instead of an address (`LinkedPageField.tsx`), with "This page no longer exists" when
it has been deleted or binned, and **Type an address instead** to go back to typing one.
Links made before this, such as `/about`, are left as they are.

## Files

| File                    | What it does                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| `PagePickerDialog.tsx`  | The dialog: a search box and the pages that match, with addresses              |
| `ChoosePageButton.tsx`  | "Choose a page…", the text action that opens it                                |
| `usePagePicker.tsx`     | The dialog as a promise, and the title finder, for the page builder            |
| `LinkedPageField.tsx`   | A linked page's title where the address would be, or that it is gone           |
| `TypeAddressButton.tsx` | "Type an address instead"                                                      |
| `pageLinks.queries.ts`  | Searching pages by title, and a linked page's title by id (`GET /entries/:id`) |
| `pageLinkStrings.ts`    | Its words                                                                      |
| `PagePicker.test.tsx`   | Link fields and rich text, end to end against a mocked API                     |
