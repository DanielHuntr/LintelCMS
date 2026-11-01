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

- **The website's look**: `GET /website/canvas` gives the site's whole stylesheet, body
  class, header, footer and the motion runtime, passed to `PageBuilder` as `site`, so the
  canvas shows the page exactly as the website will and can preview animations on it. The
  screen waits for it; if it can't be had, the canvas uses the default theme.
- **Animation words**: `motionText`, the admin's `t()` for the animation studio.
- **The tour**: the Publish button carries `data-tour="publish"`, so the tour can point at it.
