# Fields

One editor per fieldtype, used by the entry editor to draw a blueprint's fields.

- `FieldEditor.tsx` holds `fieldEditors`, the visible list of fieldtype → editor. Add a new
  fieldtype there (and in core's list). Unknown fieldtypes show a short note instead of failing.
- `FieldShell.tsx` draws what every field shares: the label, "Required", help text, the
  character count for text with a `maxLength`, and the API's error, all connected to the
  control with `aria-describedby`. Fields with several controls (link, image, multiple choice)
  use a `fieldset` and `legend`.
- `FieldGrid.tsx` lays fields out on a 12-column grid, each as wide as its `width` (the whole
  row on narrow screens, using a container query), draws section headings and spacers, and
  shows only fields whose conditions are met (`@lintel/field-conditions`, the same rules the
  server applies). Each grid passes its values down, so fields in a group, repeater row or
  block can look outwards with "$parent." and "$root.". `fieldLayout.ts` holds the width
  classes, the split into tabs (`splitIntoTabs`) and the default values of a new entry.
- `FieldShell.tsx` also places help text above the control when asked, and disables the
  controls of a read-only field.
- `fieldValues.ts` and `dateValues.ts` read stored values safely (data can be from an older
  version of a blueprint) and turn input back into stored values. Cleared optional fields are
  stored as `null`.

| Type                                 | Editor                                  | Stores                                                              |
| ------------------------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| `text`                               | `TextFieldEditor.tsx`                   | string                                                              |
| `textarea`                           | `TextareaFieldEditor.tsx`               | string                                                              |
| `richText`                           | `RichTextFieldEditor.tsx`               | TipTap JSON document, with pictures                                 |
| `number`                             | `NumberFieldEditor.tsx`                 | number, or `null` when cleared                                      |
| `toggle`                             | `ToggleFieldEditor.tsx`                 | boolean                                                             |
| `select`                             | `SelectFieldEditor.tsx`                 | string, or string[] when `multiple`                                 |
| `date`                               | `DateFieldEditor.tsx`                   | `YYYY-MM-DD`, or an ISO datetime with time                          |
| `link`                               | `LinkFieldEditor.tsx`                   | `{ url, label? }` (`lintel:page/<id>` for a chosen page), or `null` |
| `image`                              | `ImageFieldEditor.tsx`                  | asset id, or `null`                                                 |
| `email`                              | `EmailFieldEditor.tsx`                  | string                                                              |
| `url`                                | `UrlFieldEditor.tsx`                    | string, with a button to open it                                    |
| `colour`                             | `ColourFieldEditor.tsx`                 | `#rrggbb`; picker, typed code and swatches                          |
| `markdown`                           | `MarkdownFieldEditor.tsx`               | string; Write and Preview                                           |
| `list`                               | `ListFieldEditor.tsx`                   | string[] without blank items, or `null`                             |
| `entries`                            | `EntriesFieldEditor.tsx`                | entry ids, in order, or `null`                                      |
| `terms`                              | `TermsFieldEditor.tsx`                  | term ids, or `null`                                                 |
| `blocks`                             | `blocks/BlocksFieldEditor.tsx`          | `[{ id, type, data }]`, or `null` when empty                        |
| `page`                               | `../page-design/PageFieldEditor.tsx`    | a page design; edited in the visual builder                         |
| `radio`, `checkboxes`, `buttonGroup` | `ChoiceFieldEditors.tsx`                | a choice's value; a list for checkboxes                             |
| `range`, `time`                      | `MeasureFieldEditors.tsx`               | a number on a slider; `09:30`                                       |
| `slug`                               | `SlugFieldEditor.tsx`                   | follows another field (`from`) until edited                         |
| `code`                               | `CodeFieldEditor.tsx`                   | string; Tab indents, Escape then Tab leaves                         |
| `table`                              | `TableFieldEditor.tsx`                  | rows of cells, or `null` when all are empty                         |
| `video`                              | `VideoFieldEditor.tsx`                  | an address, with the player shown under it                          |
| `icon`                               | `IconFieldEditor.tsx` (`fieldIcons.ts`) | an icon's name, such as `map-pin`                                   |
| `users`                              | `UsersFieldEditor.tsx`                  | user ids, or `null`                                                 |
| `group`, `fieldset`                  | `GroupFieldEditor.tsx`                  | `{ handle: value }` of the fields inside                            |
| `repeater`                           | `RepeaterFieldEditor.tsx`               | `[{ id, data }]` rows, or `null` when empty                         |
| `revealer`                           | `LayoutFieldEditors.tsx`                | boolean: a Show more button                                         |
| `hidden`, `tab`, `section`, `spacer` | none (`NothingToEdit`)                  | drawn by the grid or the tabs, or not at all                        |

The `form` fieldtype (a form's handle, for the Form section on pages) is edited by
`FormPickerFieldEditor.tsx` in `src/forms`, which the Forms plugin owns.

Rich text uses TipTap's StarterKit, trimmed to headings (two levels), bold, italic, links,
lists and quotes (`richTextExtensions.ts`). Its toolbar is one tab stop with arrow keys
between buttons; links are added in a small form under the toolbar, not a browser prompt.
Rich text holds no pictures: one dropped or pasted into it is caught (so the browser doesn't
open the file in place of the admin) and a note says to use an image field or the design.

A picture dropped or pasted into a Markdown field is uploaded to the media library and
written in as `![](address)` on a line of its own, with a note to describe it between the
brackets (`usePictureUpload` and `PictureUploadStatus` in `src/media`).

Image fields use `MediaPicker` from `src/media`, which the media feature owns.

Entries fields (and menu items that link to a page) choose with `EntryPickerDialog`: a
collection, a title search and a list to choose from. Terms fields show the taxonomy's
terms as pills (or a select when only one may be chosen), and people with `terms:update`
can add a new term without leaving the entry. Markdown previews with the same renderer
settings as the API (typed HTML is shown as text). List fields work like a list in Notes:
Enter adds an item, Backspace in an empty one removes it.

## Blocks

A blocks field is a page builder (`blocks/`). Editors add a block from the field's block
types (a sheet with each type's description), drag blocks by their grip or move them with
the arrow buttons (each move is announced), collapse them to a one-line summary, and
duplicate or remove them from each block's menu. Removing a block with content asks first.
Each block's fields are drawn by `FieldEditor` itself, handed in as `renderField`, so every
fieldtype works inside a block without the blocks editor importing them all.

New blocks get an id from `crypto.randomUUID()`. The API's messages for block fields arrive
as `sections.<block id>.<handle>`; `innerErrors` and `blockErrors` (in `blockValues.ts`) pick
out the ones for each block, and a block with a problem stays open. `blockValues.ts` holds
every change to the list as a plain function.

## Pictures in rich text

**Add picture** in the rich text toolbar opens the image picker; a picture pasted or dropped
into the text is uploaded to the media library (`media/usePictureUpload.ts`) and put where it
landed. A picture is an `image` node holding its asset id, a description, an optional caption
and where it sits (`full`, `left`, `right`); the node itself is core's
(`@lintel/core/rich-text-picture`), so the editor and the website read it the same way.
Selecting a picture opens `RichTextPictureForm.tsx` under the toolbar, with the description
first; a new picture opens it straight away. `RichTextPictureView.tsx` draws it in the text.
