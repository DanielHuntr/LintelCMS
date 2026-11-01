# Preview

The live preview beside the entry editor, and the setting that connects it to a website.
The API side is in core's `src/preview`.

- `EntryPreviewPane.tsx` is the right half of the editor's split view (Preview in the
  toolbar or the More menu). It asks for a preview token while it's open
  (`usePreviewToken`, refreshed every 20 minutes) and follows every save: the entry's
  `updatedAt` is part of the frame's key and the draft's query key.
- With a preview address, the website is shown in a sandboxed frame, with "Open in a new
  tab". Without one, `BuiltInPreview.tsx` draws the draft from `GET /preview?token=`, the
  same data the site would get, with a friendly note that no site is connected yet.
- `BuiltInPreview.tsx` knows the block types new sites start with (Hero, Text, Image, Call
  to action, FAQ) and shows any other field or block simply. Links don't navigate.
  `deliveredValues.ts` reads delivered values safely.
- Desktop, Tablet and Phone set the frame's width, so editors can check smaller screens.
- `PreviewAddressSettings.tsx` is "Live preview" on a content type's page: each collection
  using it can have a preview address (needs `collections:update`).

A new entry has nothing to preview until it is first saved, which happens as soon as it
has a title.
