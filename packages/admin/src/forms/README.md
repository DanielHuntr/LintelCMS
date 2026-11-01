# Forms

The Forms plugin's screens. They appear (with Forms in the sidebar) only while the plugin
is on; `formsRoutes.tsx` is the one place they're registered, from `router.tsx`.

| Screen                       | File                    | What it's for                                          |
| ---------------------------- | ----------------------- | ------------------------------------------------------ |
| `/forms`                     | `FormsPage.tsx`         | Every form, with new submissions; "New form"           |
| `/forms/$formId`             | `FormBuilderPage.tsx`   | Fields, Settings and "Add to your site" tabs           |
| `/forms/$formId/submissions` | `SubmissionsPage.tsx`   | The inbox: list on the left, the open one on the right |
| `/forms/settings`            | `FormsSettingsPage.tsx` | Turnstile keys, and one person's data                  |

## The builder

The whole form is a draft until **Save**, like a document; leaving with changes asks first.
`formDraft.ts` holds the changes as plain functions (tested in `formDraft.test.ts`). Fields
are reordered by dragging the handle (pointer or keyboard, through dnd-kit) or with the
arrow buttons, and every move is announced. `FormPreview.tsx` draws the form from the draft
as it changes, steps included. A field's handle follows its label until it is typed by hand,
under **Advanced**.

## The inbox

The open submission, search, filter and page live in the address, so the link in a
notification email (`?submission=<id>`) opens the right one. Opening a submission marks it
read. Export downloads the API's CSV through `fetch`, so the session cookie goes with it.

## Pages

`FormPickerFieldEditor.tsx` is the editor for the `form` fieldtype (the Form section on
pages): a list of the site's forms, registered in `src/fields/FieldEditor.tsx`.

## Text

All words are in `formsStrings.ts`, spread into `src/i18n/strings.ts` and used with `t()`.
