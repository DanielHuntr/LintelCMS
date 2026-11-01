# Fields

One editor per fieldtype, used by the entry editor to draw a blueprint's fields.

- `FieldEditor.tsx` holds `fieldEditors`, the visible list of fieldtype → editor. Add a new
  fieldtype there (and in core's list). Unknown fieldtypes show a short note instead of failing.
- `FieldShell.tsx` draws what every field shares: the label, "Required", help text, the
  character count for text with a `maxLength`, and the API's error, all connected to the
  control with `aria-describedby`. Fields with several controls (link, image, multiple choice)
  use a `fieldset` and `legend`.
- `fieldValues.ts` and `dateValues.ts` read stored values safely (data can be from an older
  version of a blueprint) and turn input back into stored values. Cleared optional fields are
  stored as `null`.

| Type       | Editor                    | Stores                                     |
| ---------- | ------------------------- | ------------------------------------------ |
| `text`     | `TextFieldEditor.tsx`     | string                                     |
| `textarea` | `TextareaFieldEditor.tsx` | string                                     |
| `richText` | `RichTextFieldEditor.tsx` | TipTap JSON document                       |
| `number`   | `NumberFieldEditor.tsx`   | number, or `null` when cleared             |
| `toggle`   | `ToggleFieldEditor.tsx`   | boolean                                    |
| `select`   | `SelectFieldEditor.tsx`   | string, or string[] when `multiple`        |
| `date`     | `DateFieldEditor.tsx`     | `YYYY-MM-DD`, or an ISO datetime with time |
| `link`     | `LinkFieldEditor.tsx`     | `{ url, label? }`, or `null`               |
| `image`    | `ImageFieldEditor.tsx`    | asset id, or `null`                        |

Rich text uses TipTap's StarterKit, trimmed to headings (two levels), bold, italic, links,
lists and quotes (`richTextExtensions.ts`). Its toolbar is one tab stop with arrow keys
between buttons; links are added in a small form under the toolbar, not a browser prompt.

Image fields use `MediaPicker` from `src/media`, which the media feature owns.
