# Free photos (admin)

The admin half of the Free photos plugin (`packages/core/src/free-photos`). While the plugin
is on and the person may upload media (`useCanAddFreePhotos`), a **Free photos** button
appears:

- in the media library, beside Upload (and under Upload on an empty library), where photos
  are added and the dialog stays open for more;
- in the image picker (`MediaPickerDialog`), beside Upload new, where **Use** adds the photo
  and chooses it for the field straight away.

`FreePhotosDialog` searches when the person presses Search (not on every key, because
Openverse limits searches per server). Each result shows its title, creator and licence,
and a link to where it came from. The footer says which licences are offered and that
CC BY and CC BY-SA photos need their credit shown. Problems are the API's own plain
messages, with Try again.

Thumbnails need the session cookie, so `useFreePhotoThumbnail` fetches them and shows a
`data:` URL (which the admin's Content-Security-Policy allows). Openverse still lists some
photos whose files have gone; their thumbnail fails, and the result is left out.

| File                       | What it does                             |
| -------------------------- | ---------------------------------------- |
| `FreePhotosDialog.tsx`     | Searching, results and adding            |
| `useFreePhotoThumbnail.ts` | A thumbnail through the API              |
| `useFreePhotos.ts`         | Whether to offer free photos here        |
| `freePhotos.api.ts`        | Requests                                 |
| `freePhotosStrings.ts`     | Its words, spread into `i18n/strings.ts` |
