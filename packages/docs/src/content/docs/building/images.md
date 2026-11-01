---
title: Images and focal points
description: Resizing and cropping images through the API, around the editor's focal point.
since: "0.1"
---

Image fields in the [delivery API](/building/delivery-api/) come as:

```json
{
  "id": "8d1c2b3a-0f9e-4d8c-b7a6-5e4d3c2b1a09",
  "url": "http://localhost:4000/media/8d1c2b3a-0f9e-4d8c-b7a6-5e4d3c2b1a09/file?v=3a9f0c1d2e4b",
  "alt": "Two chefs plating desserts",
  "width": 2400,
  "height": 1600,
  "focalPoint": { "x": 0.62, "y": 0.4 }
}
```

`url` is the original. Add options to it to get a resized copy:

| Option   | Values                        | Notes                                                      |
| -------- | ----------------------------- | ---------------------------------------------------------- |
| `w`, `h` | 1 to 4000                     | Never enlarged beyond the original                         |
| `fit`    | `cover` (default), `contain`  | `cover` with both `w` and `h` crops around the focal point |
| `format` | `webp`, `avif`, `jpeg`, `png` | Defaults to the original's format (PNG for SVG)            |

Keep the `v` parameter: it's a fingerprint of the file and its focal point, and URLs with
it are cached for a year (`immutable`). When an editor moves the focal point, the API hands
out a new `v`, so the new crop appears without anyone purging a cache.

## Focal-point crops

With `fit=cover` and both sizes, Lintel takes the largest rectangle of that shape that
fits in the image, centres it on the focal point, and slides it back inside the image at
the edges. The admin's crop previews use the same code, so editors see exactly what your
site gets.

```ts
function imageUrl(image: { url: string }, width: number, height: number): string {
  const url = new URL(image.url);
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(height));
  url.searchParams.set("format", "webp");
  return url.toString();
}

// A 16:9 hero in three widths, cropped around the subject.
const srcSet = [640, 1280, 1920]
  .map((width) => `${imageUrl(hero, width, Math.round((width * 9) / 16))} ${width}w`)
  .join(", ");
```

```html
<img
  src="…w=1280&h=720…"
  srcset="…"
  sizes="100vw"
  alt="Two chefs plating desserts"
  width="1280"
  height="720"
  loading="lazy"
/>
```

Always use the image's `alt`. When it's empty the image is decorative to the editor, so
`alt=""` is right.

## Cropping in the browser instead

If you'd rather send the original and crop with CSS (`object-fit: cover`), turn the focal
point into `object-position`. `coverPositionForFocalPoint` in
`packages/core/src/media/focal-crop.ts` does the maths; a plain
`object-position: {x * 100}% {y * 100}%` is close for most photos.

## Caching and safety

- Each resized copy is made once and kept on disk; a CDN in front of the API caches the
  versioned URLs well.
- Files are public by id, so editors shouldn't upload anything private.
- Files are served with `X-Content-Type-Options: nosniff` and a sandboxing
  `Content-Security-Policy`, and SVGs with scripts are refused on upload.
