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

## The address it inserts

The page's address on the site, such as `/about` (or a full address, for a site start on a
domain of its own). That is the form these places already took for a page of the site: the
builder's hint says "a page on your site such as /about", and Link fields and rich text
accept addresses starting with `/`. Lintel has no link-by-id format outside menus, so a link
made here is a typed address: if the page's address changes later, the link doesn't follow
(with the SEO tools on, Lintel offers a redirect from the old address when it changes).

## Files

| File                   | What it does                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `PagePickerDialog.tsx` | The dialog: a search box and the pages that match, with addresses      |
| `ChoosePageButton.tsx` | "Choose a page…", the text action that opens it                        |
| `usePagePicker.tsx`    | The dialog as a promise, for the page builder                          |
| `pageLinks.queries.ts` | Searching pages by title (`GET /content-tree/search`, which has `url`) |
| `pageLinkStrings.ts`   | Its words                                                              |
| `PagePicker.test.tsx`  | Link fields and rich text, end to end against a mocked API             |
