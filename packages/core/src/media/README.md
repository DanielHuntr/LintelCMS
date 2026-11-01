# Media

Uploaded files: photos, logos and documents. Editors upload them in the admin's media
library or straight from an image field, then describe them (alt text) and mark where the
subject is (the focal point) so every crop keeps it in view.

## How an upload flows

1. `media.routes.ts` reads the one `file` field (`@fastify/multipart`, 25 MB at most).
2. `file-types.ts` decides what the file really is from its bytes. The name and the type the
   browser sent are ignored, so a program renamed to `photo.png` is refused. Text formats
   have no signature: readable text is an SVG if it has an `<svg>` root, otherwise plain text
   or CSV by its extension.
3. SVGs go through `svg-safety.ts`, which refuses scripts, event handlers, `javascript:` links,
   embedded HTML and XML entities. Refusing is safer than cleaning: a cleaner that misses one
   trick lets the file through.
4. `sharp` reads the width and height (after the camera's rotation, so they match what people
   see). A file that claims to be an image but can't be opened is refused.
5. The SHA-256 of the bytes is checked against the library. The same file uploaded again
   gives back the existing asset with `200` instead of making a duplicate (`201` when new).
6. The bytes go to storage as `<tenant>/<asset id>.<extension>`, and the row to `assets`.
   The filename is cleaned (`filenames.ts`) and given the extension of its real type.

Allowed: JPEG, PNG, WebP, AVIF, GIF and SVG images; PDF, Word (`.docx`), Excel (`.xlsx`),
PowerPoint (`.pptx`), plain text and CSV documents.

## Endpoints

| Method and path       | Permission     | Success                                                        |
| --------------------- | -------------- | -------------------------------------------------------------- |
| `POST /media`         | `media:upload` | 201 `Asset` (200 when the same file was already uploaded)      |
| `GET /media`          | `media:read`   | 200 `{ assets, total }`, newest first                          |
| `GET /media/:id`      | `media:read`   | 200 `Asset`                                                    |
| `PATCH /media/:id`    | `media:update` | 200 `Asset`; body `{ alt?, focalPoint?: { x, y }, filename? }` |
| `DELETE /media/:id`   | `media:delete` | 204, or 409 `ASSET_IN_USE` with `usedBy: [{ entryId, title }]` |
| `GET /media/:id/file` | public         | The original, or a resized image                               |

`GET /media` takes `search` (filename or alt text), `type` (`image` or `document`), `page`
and `perPage` (25 by default, 100 at most). The `Asset` shape is in `media.schema.ts`.

| Status | `code`                  | When                                              |
| ------ | ----------------------- | ------------------------------------------------- |
| 400    | `INVALID_REQUEST`       | No `file` field, or a bad query or body           |
| 404    | `NOT_FOUND`             | No asset with that id (a malformed id counts too) |
| 409    | `ASSET_IN_USE`          | Deleting an asset that entries still use          |
| 413    | `FILE_TOO_LARGE`        | Over 25 MB                                        |
| 415    | `FILE_TYPE_NOT_ALLOWED` | Not on the list above, whatever its name says     |
| 422    | `UNSAFE_SVG`            | An SVG with active content; the message says what |
| 422    | `UNREADABLE_IMAGE`      | An image sharp can't open                         |

## Files and image transforms

`GET /media/:id/file` is **public on purpose**: its URLs go into the website's `<img>` tags,
and visitors aren't signed in. Anyone with an asset's id can fetch it, so don't upload
anything private. Ids are random UUIDs, so they can't be guessed or counted through.

With no options it sends the original: images `inline`, documents as an `attachment`, each
with its real content type. Images take:

| Option   | Values                        | Notes                                                |
| -------- | ----------------------------- | ---------------------------------------------------- |
| `w`, `h` | 1 to 4000                     | Never enlarged: 4000 of a 1000px photo gives 1000px  |
| `fit`    | `cover` (default), `contain`  | `cover` with both sizes crops around the focal point |
| `format` | `webp`, `avif`, `jpeg`, `png` | Defaults to the original's format (PNG for SVG)      |

Options on a document are ignored and the original is sent.

- **Focal crop:** the largest rectangle of the wanted shape, centred on the focal point and
  slid back inside the image at the edges (`focal-crop.ts`). The admin's crop previews use
  the same file, through `@lintel/core/media-crop`, so they show exactly what the API makes.
- **Disk cache:** each result is made once and kept in `.lintel/cache/media/<asset id>/`
  (`transform-cache.ts`). The `lintel-transform-cache` header says `hit` or `miss`.
  Deleting an asset removes its folder. The cache stays local even with remote storage.
- **Browser and CDN caching:** every URL the API hands out carries `?v=`, a fingerprint of
  the file and its focal point. Such a URL never changes meaning, so it is sent with
  `Cache-Control: public, max-age=31536000, immutable`. Without the current `v` it is kept
  for an hour. Every response has an `ETag`, and `If-None-Match` gets a `304`.
- **Safety:** files are sent with `X-Content-Type-Options: nosniff` and a sandboxing
  `Content-Security-Policy`, so even an SVG that slipped past the checks can't run.

## Storage

`storage-driver.ts` is the whole contract: `put`, `get` (a stream), `delete` and `exists`.
`LocalDiskStorage` keeps files in `.lintel/uploads` (gitignored). `buildServer` takes another
driver in `media.storage`.

### Adding S3 or R2 later

Write a class implementing `StorageDriver` with `@aws-sdk/client-s3` (R2 speaks the same API;
point `endpoint` at `https://<account>.r2.cloudflarestorage.com`):

- `put`: `PutObjectCommand` with `Body: contents` and `ContentType: mimeType`.
- `get`: `GetObjectCommand`; its `Body` is a stream. Throw `StoredFileMissingError` on `NoSuchKey`.
- `delete`: `DeleteObjectCommand` (S3 doesn't mind missing keys).
- `exists`: `HeadObjectCommand`, false on a 404.

Then pass it in `main.ts` (`media: { storage: new S3Storage(...) }`), reading the bucket and
keys from new settings in `config.ts`. Keep the bucket private: files are still served
through `GET /media/:id/file`, which applies the checks and headers above. A CDN in front of
the API caches those responses well, thanks to the versioned URLs.

## Using media from another feature

Import from `src/media/index.ts`, never from the files inside.

```ts
import { createAssetLookup } from "../media/index.js";

// In routes: the server has `database` and `publicApiUrl`, and the database is read on
// every call, so this follows the setup screen switching databases.
const assets = createAssetLookup(server);

// Image fields must point at a real asset.
if (!(await assets.assetExists(value))) { ... }

// The delivery API expands image fields: Map<id, { id, url, alt, width, height, focalPoint }>.
const found = await assets.findAssetsByIds(imageIds);

// Inside a transaction:
createAssetLookup({ database: transaction, publicApiUrl: server.publicApiUrl });
```

Deleting an asset asks an `AssetUsageFinder` which entries use it. Media can't see inside
entries, so its default (`noAssetUsage`) finds nothing. The entries feature provides the real
one and passes it in `server.ts`:

```ts
server.register(mediaRoutes, {
  ...,
  usageFinder: options.media?.usageFinder ?? createEntryAssetUsageFinder(server),
});
```

where `createEntryAssetUsageFinder(server)` returns `{ findEntriesUsingAsset(assetId) }`
resolving to `[{ entryId, title }]`.

## Files

| File                     | What it does                                                |
| ------------------------ | ----------------------------------------------------------- |
| `media.table.ts`         | The `assets` table                                          |
| `media.schema.ts`        | Zod schemas: the `Asset` shape, queries and the update body |
| `media.routes.ts`        | The endpoints and the file response headers                 |
| `media.service.ts`       | Uploading, listing, updating and deleting                   |
| `media-file.service.ts`  | Serving originals and resized images                        |
| `media.repository.ts`    | Database reads and writes                                   |
| `media.errors.ts`        | Named errors with the messages people see                   |
| `file-types.ts`          | The allowed types and telling what a file really is         |
| `svg-safety.ts`          | Refusing SVGs with active content                           |
| `filenames.ts`           | Cleaning filenames                                          |
| `image-transforms.ts`    | Reading sizes and resizing with sharp                       |
| `focal-crop.ts`          | Crop geometry, shared with the admin                        |
| `transform-cache.ts`     | The disk cache for resized images                           |
| `asset-response.ts`      | Rows to `Asset`s, with versioned URLs                       |
| `content-disposition.ts` | Download headers that survive any filename                  |
| `storage-driver.ts`      | The storage interface                                       |
| `local-disk-storage.ts`  | Storage in `.lintel/uploads`                                |
| `asset-lookup.ts`        | `AssetLookup`, `AssetExists` and `AssetUsageFinder`         |
| `index.ts`               | What other features may import                              |
