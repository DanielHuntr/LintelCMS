# Free photos

An optional plugin, off until someone switches it on in Build → Features. It lets people
search openly licensed photos on [Openverse](https://openverse.org) from the media library
and the image picker, and add one to the media library as an ordinary file, with its credit.
Why it works this way: `docs/decisions/0027-free-photos-from-openverse.md`.

## How it works

1. The admin asks `GET /free-photos/search?q=bakery`. Lintel asks Openverse's public API
   (`https://api.openverse.org/v1/images/`, no key needed) and answers with the results.
   The browser never talks to Openverse, so the admin's Content-Security-Policy stays
   closed and editors' addresses aren't shared.
2. Thumbnails come through Lintel too (`GET /free-photos/:id/thumbnail`).
3. `POST /free-photos/add { id }` looks the photo up again by id, checks its licence,
   downloads the full-size file on the server and stores it with the media library's own
   `uploadAsset`, so every upload check applies. Its credit goes in the file's `credit`.
   The same photo added twice gives back the first file, as uploads do.

## Licences

Only licences that let a business use a photo on its website without asking are offered:
CC0, the Public Domain Mark, CC BY and CC BY-SA (`allowedLicences` in `free-photos.schema.ts`).
Non-commercial (NC) and no-derivatives (ND) licences are left out. They are asked for in the
search and checked again on every result and before every download.

The credit is written as the licences ask: title, creator, licence with its link, and
where the photo was found, for example:

> “Bakery” by InfoMofo, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/).
> Source: https://www.flickr.com/photos/40689227@N00/141332285

## Polite use and safety

- Requests to Openverse carry a user agent naming Lintel and give up after 8 seconds.
- Searches are kept for 10 minutes and thumbnails for an hour (`timed-cache.ts`), in memory.
- Openverse limits anonymous use per server (20 searches a minute and 200 a day, 1,000
  thumbnails a day, at the time of writing). When it says "too many", people see "This site
  has searched for free photos a lot today. Wait a little and try again."
- The full-size file comes from wherever Openverse says (Flickr, Wikimedia Commons...), so it
  goes through the same outgoing-request safety as webhooks (`src/webhooks/address-safety.ts`
  and `publicOnlyLookup`): local and private addresses are refused, after every redirect too.
  Only photos are kept: a document or an SVG is refused.

## Endpoints

All need `media:upload`, and answer 404 `PLUGIN_NOT_ENABLED` while the plugin is off.

| Method and path                  | Body or query         | Success                                             |
| -------------------------------- | --------------------- | --------------------------------------------------- |
| `GET /free-photos/search`        | `?q=&page=` (1 to 12) | 200 `{ photos, page, pageCount }`                   |
| `GET /free-photos/:id/thumbnail` | none                  | 200, the image                                      |
| `POST /free-photos/add`          | `{ id, folder? }`     | 201 `Asset` with its `credit` (200 if added before) |

Errors: 400 for an empty search, 404 `FREE_PHOTO_NOT_FOUND`, 422
`FREE_PHOTO_LICENCE_NOT_ALLOWED`, 429 `FREE_PHOTOS_BUSY`, 502 `FREE_PHOTOS_UNAVAILABLE` and
502 `FREE_PHOTO_DOWNLOAD_FAILED` (with the reason, such as a private address).

## Files

| File                      | What it does                                                 |
| ------------------------- | ------------------------------------------------------------ |
| `free-photos.plugin.ts`   | The plugin definition                                        |
| `register-free-photos.ts` | What the routes need: the Openverse client and media library |
| `free-photos.routes.ts`   | HTTP only                                                    |
| `free-photos.service.ts`  | Searching, licences, credits and adding a photo              |
| `openverse-client.ts`     | Openverse's API: the only place that knows its addresses     |
| `photo-download.ts`       | Downloading a photo with the outgoing-request safety         |
| `timed-cache.ts`          | The short in-memory cache                                    |
| `free-photos.schema.ts`   | Zod schemas and the allowed licences                         |
| `free-photos.errors.ts`   | Named errors                                                 |
| `free-photos.test.ts`     | Tests against a stand-in Openverse                           |

`buildServer({ freePhotos: { openverseApiUrl, allowPrivateDownloads } })` points it at a
stand-in for tests. `allowPrivateDownloads` follows `WEBHOOKS_ALLOW_PRIVATE_ADDRESSES`.
