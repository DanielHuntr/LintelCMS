# Media

The media library at `/media` and the `MediaPicker` that image fields use. The API side is
in `packages/core/src/media`.

## The library

- Upload with the button, or drag files anywhere onto the page (an overlay says "Drop to
  upload"). Each file gets its own row in the uploads tray, with progress, a tick or the
  reason it was refused. Files too big or of the wrong kind are refused before sending,
  with the same rules as the API (`upload-rules.ts`); the API still checks the real type.
- A grid of square thumbnails, loaded lazily, newest first, 60 at a time with "Show more".
  Documents show an icon and their kind. Search (filename and alt text) and the All, Images,
  Documents filter go to the API, so they cover the whole library, not just what's loaded.
- An empty library shows only a guide with an Upload button; an empty search says so.

## The detail sheet

Opens from a tile. Changes save as they're made, with "Saved" in the header:

- **Focal point:** click or drag on the image, or focus it and use the arrow keys (Shift
  for bigger steps). It saves half a second after the point settles.
- **Crop previews** at square, wide (16:9) and portrait (4:5). They use the API's own crop
  geometry (`@lintel/core/media-crop`), so they match what the website gets.
- **Alt text** (saved on leaving the field), with guidance on writing it, and the
  **filename** (the API keeps the real extension).
- `/media?upload=true` opens the file chooser straight away (the command palette's "Upload media").
- Details, Copy URL, Download, and Delete. Delete asks first, then moves the file to the
  recycle bin and offers Undo; if entries still use the file, the API's 409 is shown as
  "Used in" with their titles.

## MediaPicker

```tsx
<MediaPicker label="Hero image" value={assetId} onChange={(assetId) => ...} />
```

`value` is an asset id or null. It shows the chosen image (thumbnail, name, alt text) with
Replace and Remove, or a "Choose image" button. Both open a dialog with the library's
images, search and an Upload button (dropping files on the dialog works too). Clicking an
image, or pressing Enter on it, chooses it; an image uploaded there is chosen as soon as it
arrives.

## Keyboard and screen readers

- Dialogs (`Modal.tsx`) keep Tab inside, close on Escape (only the top one when stacked),
  and give focus back to whatever opened them.
- Grids are one Tab stop: arrow keys move between tiles (up and down by a row), Home and
  End jump to the ends.
- The focal point picker announces its position as "40% across, 30% down".

## Files

| File                      | What it does                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| `MediaLibraryPage.tsx`    | The `/media` screen                                                |
| `AssetGrid.tsx`           | The keyboard-friendly thumbnail grid, and its loading placeholder  |
| `AssetTile.tsx`           | One thumbnail with its name and size                               |
| `AssetDetailSheet.tsx`    | The detail sheet and saving                                        |
| `AssetPreview.tsx`        | The big preview: the focal point picker, or a document icon        |
| `FocalPointPicker.tsx`    | Click, drag or arrow keys to set the focal point                   |
| `CropPreviews.tsx`        | The three crop shapes                                              |
| `AltTextField.tsx`        | A labelled multi-line field with guidance                          |
| `AssetDetailsList.tsx`    | Type, size, dimensions, uploader and date                          |
| `AssetActions.tsx`        | Copy URL, Download, Delete                                         |
| `DeleteAssetDialog.tsx`   | Confirming a delete, and "Used in" when it's refused               |
| `useOfferAssetUndo.ts`    | "Moved to the recycle bin" with Undo, at the foot of the window    |
| `MediaPicker.tsx`         | The image field                                                    |
| `MediaPickerDialog.tsx`   | Choosing or uploading an image                                     |
| `UploadTray.tsx`          | The floating uploads list on the library                           |
| `UploadProgressList.tsx`  | Rows of upload progress, results and problems                      |
| `DropOverlay.tsx`         | "Drop to upload"                                                   |
| `Modal.tsx`               | Dialogs with a focus trap                                          |
| `useUploadQueue.ts`       | Checking and uploading files, and tracking each one                |
| `usePictureUpload.ts`     | One picture pasted or dropped into a field, uploaded with progress |
| `PictureUploadStatus.tsx` | That upload's progress and result, under the field                 |
| `pastedFiles.ts`          | The pictures in a paste or a drop, with usable names               |
| `useFileDrop.ts`          | Drag and drop of files onto the window or an element               |
| `useFittedSize.ts`        | Sizing the preview to the image's shape                            |
| `useDebouncedValue.ts`    | One search per pause in typing                                     |
| `upload-rules.ts`         | The size limit and allowed kinds of file                           |
| `media.api.ts`            | Requests, including uploads with progress (XMLHttpRequest)         |
| `media.queries.ts`        | TanStack Query hooks and cache keys                                |
| `formatting.ts`           | File sizes, dates and dimensions for people                        |
