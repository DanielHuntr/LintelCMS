# Page design

"Edit design": the visual page builder (`@lintel/builder`) for fields of type `page`.

| File                     | What it is                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| `DesignFirstFields.tsx`  | A page's fields: the Design card first, then the rest, Page sections last |
| `PageDesignCard.tsx`     | The Design card: a live picture, **Edit design**, or a way to start       |
| `DesignThumbnail.tsx`    | The picture: the design drawn with the website's look, scaled down        |
| `designSummary.ts`       | Counting a design's sections and a blocks field's blocks                  |
| `PageFieldEditor.tsx`    | A second page field in a form: a summary and the **Edit design** link     |
| `pageDesignRoutes.tsx`   | `/content/:collection/:entryId/design/:field`, full screen                |
| `PageDesignPage.tsx`     | Loads the entry and opens the builder with the admin's services           |
| `DesignerWhenWide.tsx`   | The note for narrow windows; a designer already open stays open, hidden   |
| `usePageDesignSaving.ts` | Autosave and Publish through the entries API                              |
| `preloadDesigner.ts`     | Fetches the builder early, so switching to Design doesn't wait for it     |

## Design first

A blueprint with a page field (Pages) is edited design first. The entry editor
(`content/EntryEditor.tsx`) hands its fields to `DesignFirstFields`, which leads with the
Design card for the first page field:

- **Designed**: a live picture of the page (lazy, so the renderer isn't in the main bundle),
  how many sections it has, and **Edit design**.
- **Saved but empty**: one short row with **Start from a template or section**, so the page's
  fields stay in view. It opens the builder on its empty page: **Add a section**, **Add
  elements** and a **Start from a template** link.
- **New**: **Start designing** once the page has a title (Return in the title does the same).
  It saves the page, then opens it in the builder.

`DesignFirstFields` also says what the Summary is for, unless the blueprint has its own help.
People without `builder:design` see **Edit on the page** instead of Edit design.

Blocks fields (the "Page sections" form sites had before designs) are the alternative to a
design. They're hidden once the page has a design, and until then are folded away under
**Simple sections (no design)**, opening by themselves if something in them needs attention.
New sites' Page blueprint no longer has them (see `packages/core/src/collections`); older
sites keep theirs, and the website and the delivery API still serve their sections.

The builder fills the window, so its route sits beside the admin layout (under the setup
gate) and checks the session itself. It loads lazily: the builder isn't in the admin's main
bundle.

What the admin hands the builder:

- **Words**: the admin's `t()`. The builder's strings (`builderStrings`) are spread into
  `src/i18n/strings.ts` through `pageDesignStrings.ts`, so they translate with the rest.
- **Pictures**: `pickImage` opens the media library (`MediaPickerDialog`) and resolves with
  the chosen asset's address and alt text. `uploadPicture` uploads a picture dropped on (or
  pasted into) a Picture element on the canvas, with the library's checks
  (`media/uploadPicture.ts`); its errors are the library's plain messages.
- **Code**: Code elements (adding them and editing their code) only appear with `builder:code` (`useCan`). The
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
- **The top bar**: `toolbarTitleNote` and `toolbarAfterTitle` put the page's status and the
  view switch beside its name, and `toolbarEnd` holds View page, Preview and Publish, all from
  `src/page-home`. Preview opens the saved draft in a new tab, or the page's split view if there
  is no preview address (or the browser blocks the tab). Switching to Content saves first.
- **The tour**: Publish and **View page** (shown once the page is live, see
  `content/viewPage.ts`) sit together inside `data-tour="publish"`, so the tour's last step
  can point at both. The view switch is `data-tour="page-views"`, the step before it.

## Menus in the builder

The builder gets the site's menus with their links (`useBuilderMenus` in `src/menus`), so a
Header, Menu or Menu drawer on the canvas shows the real menu, and its Content tab offers
"Which menu" and "Edit menu". Edit menu opens `InlineMenuEditor` in the panel: the same
editing as the Menus screen (add pages, rename, reorder, nest), saved to the same menu.
