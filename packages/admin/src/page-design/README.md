# Page design

"Edit design": the visual page builder (`@lintel/builder`) for fields of type `page`.

| File                     | What it is                                                            |
| ------------------------ | --------------------------------------------------------------------- |
| `PageFieldEditor.tsx`    | The field in the entry editor: a summary and the **Edit design** link |
| `pageDesignRoutes.tsx`   | `/content/:collection/:entryId/design/:field`, full screen            |
| `PageDesignPage.tsx`     | Loads the entry and opens the builder with the admin's services       |
| `usePageDesignSaving.ts` | Autosave and Publish through the entries API                          |

The builder fills the window, so its route sits beside the admin layout (under the setup
gate) and checks the session itself. It loads lazily: the builder isn't in the admin's main
bundle.

What the admin hands the builder:

- **Words**: the admin's `t()`. The builder's strings (`builderStrings`) are spread into
  `src/i18n/strings.ts` through `pageDesignStrings.ts`, so they translate with the rest.
- **Pictures**: `pickImage` opens the media library (`MediaPickerDialog`) and resolves with
  the chosen asset's address and alt text.
- **Code**: Developer mode and code blocks only appear with `builder:code` (`useCan`). The
  API checks it again when saving (see `packages/core/src/pages`).

Saving works like the entry editor: about 1.5 seconds after changes stop, one save at a time,
Cmd/Ctrl+S to save now, and a warning before leaving with unsaved changes. Each save is a
revision of the entry, so the entry's History can restore an older design. Publish (with
`entries:publish`) saves first, then publishes the entry. A design the API refuses shows its
message at the bottom of the screen.

The builder's design tokens come from the stand-in theme for now; once
`@lintel/site-components` lands, pass its `themeStylesheet` and base styles to `PageBuilder`.
