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

| Method and path       | Permission     | Success                                                                 |
| --------------------- | -------------- | ----------------------------------------------------------------------- |
| `POST /media`         | `media:upload` | 201 `Asset` (200 when the same file was already uploaded)               |
| `GET /media`          | `media:read`   | 200 `{ assets, total }`, newest first                                   |
| `GET /media/:id`      | `media:read`   | 200 `Asset`                                                             |
| `PATCH /media/:id`    | `media:update` | 200 `Asset`; body `{ alt?, credit?, focalPoint?: { x, y }, filename? }` |
| `DELETE /media/:id`   | `media:delete` | 204, or 409 `ASSET_IN_USE` with `usedBy: [{ entryId, title }]`          |
| `GET /media/:id/file` | public         | The original, or a resized image                                        |

`credit` holds who made a file and its licence, for files that must be credited, such as
photos added by the Free photos plugin (`src/free-photos`). It is empty for most files.
`credit_details` keeps its parts when Lintel wrote it; editing the credit clears them.
`photo-credit.ts` decides what websites show under the picture: nothing for CC0 and Public
Domain Mark photos, the parts (so the creator and licence can link) for other free photos,
and a typed credit as typed. Delivered images carry it as `credit`, and the admin's `Asset`
as `photoCredit`.

## The recycle bin

Deleting a file moves it to the media recycle bin (`media-bin.service.ts`): its row is kept
in `binned_assets` and its bytes stay in storage, so the admin's Undo, or Restore in the
recycle bin, brings it back with the same id, name, alt text and folder. Only files nothing
uses can be deleted, so nothing points at a binned file. Deleting it from the bin, or
emptying the bin, removes the bytes for good. Forms delete their uploads for good straight
away (`deleteAsset`).

| Method and path               | Permission     | Success                                                                   |
| ----------------------------- | -------------- | ------------------------------------------------------------------------- |
| `GET /media-bin`              | `media:read`   | 200 `{ items: [{ id, filename, mimeType, size, deletedAt, deletedBy }] }` |
| `POST /media-bin/:id/restore` | `media:upload` | 200 `Asset`; 409 `ASSET_ALREADY_IN_LIBRARY` or `FILE_MISSING` if it can't |
| `DELETE /media-bin/:id`       | `media:delete` | 204, gone for good                                                        |
| `DELETE /media-bin`           | `media:delete` | 200 `{ deleted }`, the bin emptied                                        |

`:id` is the file's own id. A restore is refused when the same file was uploaded again
meanwhile, or when its bytes left storage (moving to a bucket only copies the library's
files, and backups only hold those too).

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

- **Limits:** uploads are 25 MB at most, images 100 megapixels at most (refused on upload
  with `413 IMAGE_TOO_LARGE`, and sharp won't decode more), and one address may upload 30
  files and ask for 300 resized images a minute (`429`; plain originals aren't counted).
  Put a CDN in front of `/media` on a busy site.

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

`storage-driver.ts` is the whole contract: `put`, `get` (a stream), `delete` and `exists`,
plus two optional methods: `checkReachable()` (used by `GET /ready` and at start) and
`signedUrl()`. `buildServer` takes a driver in `media.storage`; `configured-storage.ts`
picks one from the settings (`storage.config.ts`).

- **`LocalDiskStorage`** (`STORAGE_DRIVER=local`, the default) keeps files in
  `<LINTEL_FOLDER>/uploads`, `.lintel/uploads` unless set.
- **`S3Storage`** (`STORAGE_DRIVER=s3`) keeps them in an S3-compatible bucket with the AWS
  SDK: AWS S3, Cloudflare R2, Backblaze B2 or MinIO. Set `S3_BUCKET`, `S3_REGION`, and for
  anything but AWS `S3_ENDPOINT`; the keys go in `S3_ACCESS_KEY_ID` and
  `S3_SECRET_ACCESS_KEY` (leave both out to use the server's AWS role). Path-style
  addresses are used whenever an endpoint is set. `S3_KEY_PREFIX` keeps Lintel's files in
  one folder of a shared bucket. The SDK's newer default checksums are switched off,
  because B2, R2 and older MinIO refuse them.

Keep the bucket private. Files are served through `GET /media/:id/file`, with the checks
and headers above. With `S3_SIGNED_URLS=true`, originals are sent as a `302` to a signed
link lasting `S3_SIGNED_URL_SECONDS` (3600) instead, which takes the bytes off the server;
the redirect is `private, max-age` half that. Resized images are always made by Lintel and
cached on its disk. A CDN in front of the API caches either well, thanks to the versioned
URLs.

### Moving files from disk to a bucket

```bash
pnpm media:move-to-s3 --dry-run   # what would be copied
pnpm media:move-to-s3             # copy, then set STORAGE_DRIVER=s3 and restart
```

`storage-move.service.ts` copies every asset's file by its `storageKey`, skips files the
bucket already has (so it can be run again after an interruption) and lists any the disk
has lost. It deletes nothing.

### Testing against a bucket

`s3-storage.test.ts` and `s3-media.test.ts` run the real AWS SDK against
`src/testing/fake-s3-server.ts`, which speaks the part of the S3 API Lintel uses and checks
which key signed each request. To try a real MinIO:

```bash
docker run -p 9000:9000 -e MINIO_ROOT_USER=lintel -e MINIO_ROOT_PASSWORD=lintel-secret minio/minio server /data
# create a bucket "lintel" in the console, then:
STORAGE_DRIVER=s3 S3_BUCKET=lintel S3_ENDPOINT=http://localhost:9000 \
  S3_ACCESS_KEY_ID=lintel S3_SECRET_ACCESS_KEY=lintel-secret pnpm dev
```

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

Forms store the files visitors send through `uploadAsset(context, file, null)` (no uploader)
and remove them with `deleteAsset`, after checking the kind of file with `detectFileType`.
All three are exported from `index.ts` for that (see `src/forms/submission-files.ts`).

## Files

| File                      | What it does                                                |
| ------------------------- | ----------------------------------------------------------- |
| `media.table.ts`          | The `assets` table                                          |
| `media.schema.ts`         | Zod schemas: the `Asset` shape, queries and the update body |
| `media.routes.ts`         | The endpoints and the file response headers                 |
| `media.service.ts`        | Uploading, listing, updating and deleting                   |
| `media-file.service.ts`   | Serving originals and resized images                        |
| `media.repository.ts`     | Database reads and writes                                   |
| `media-bin.table.ts`      | The `binned_assets` table: deleted files, kept for Undo     |
| `media-bin.service.ts`    | Binning, restoring, deleting for good and emptying          |
| `media-bin.repository.ts` | The bin's database reads and writes                         |
| `media-bin.routes.ts`     | The bin's endpoints                                         |
| `media.errors.ts`         | Named errors with the messages people see                   |
| `file-types.ts`           | The allowed types and telling what a file really is         |
| `svg-safety.ts`           | Refusing SVGs with active content                           |
| `filenames.ts`            | Cleaning filenames                                          |
| `image-transforms.ts`     | Reading sizes and resizing with sharp                       |
| `focal-crop.ts`           | Crop geometry, shared with the admin                        |
| `transform-cache.ts`      | The disk cache for resized images                           |
| `asset-response.ts`       | Rows to `Asset`s, with versioned URLs                       |
| `content-disposition.ts`  | Download headers that survive any filename                  |
| `storage-driver.ts`       | The storage interface                                       |
| `local-disk-storage.ts`   | Storage in `.lintel/uploads`                                |
| `s3-storage.ts`           | Storage in an S3-compatible bucket                          |
| `storage.config.ts`       | The storage settings and their rules                        |
| `configured-storage.ts`   | The driver the settings ask for                             |
| `storage-move.service.ts` | Copying every file from one storage to another              |
| `asset-lookup.ts`         | `AssetLookup`, `AssetExists` and `AssetUsageFinder`         |
| `index.ts`                | What other features may import                              |
