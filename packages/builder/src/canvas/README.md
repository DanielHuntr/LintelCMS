# Canvas

The page as the site draws it, inside a frame, with the builder's outlines and handles on
top. `Canvas.tsx` holds the frame; `canvas-frame-script.ts` runs inside it and reports what
people do there; `canvas-messages.ts` checks every message from the frame before the builder
uses it (the frame runs the page's own code, so nothing it sends is trusted).

## Dragging on the canvas

- Something dragged from Insert, or an element dragged to a new place, shows a line where it
  would land (`canvas-drop.ts` works out the place).
- **Pictures from the computer:** the frame always catches dropped files, so the browser never
  opens a file in place of the page. A picture dropped on a Picture element is uploaded with
  the app's `uploadPicture` and becomes that element's picture (one step in Undo), keeping
  its description. Pasting a picture with a Picture element selected does the same.
  Dropped anywhere else, or pasted with nothing suitable selected, a note says where
  pictures go. `usePictureDrop.ts` holds the rules; `PictureDropStatus.tsx` is the note at
  the foot of the canvas ("Uploading harbour.jpg…", then "Picture added…" or the problem in
  the media library's own words), and the builder's announcer reads the same words out.

## Files

| File                     | What it does                                         |
| ------------------------ | ---------------------------------------------------- |
| `Canvas.tsx`             | The frame, sized to the chosen screen                |
| `canvas-frame-script.ts` | The script inside the frame                          |
| `canvas-messages.ts`     | Messages to and from the frame, checked              |
| `canvas-drop.ts`         | Where something dragged from Insert would land       |
| `usePictureDrop.ts`      | Pictures dropped on or pasted into a Picture element |
| `PictureDropStatus.tsx`  | The note while a picture uploads, and afterwards     |
