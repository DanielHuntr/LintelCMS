---
title: Delivery API
description: The public REST API your website reads published content from, with examples.
since: "0.1"
---

The delivery API serves **published** content, as JSON, to your website. It needs no key
or session: drafts, scheduled entries and unpublished changes are never served, and an
unpublished entry gets the same 404 as one that doesn't exist.

The base URL is the API's address, `http://localhost:4000` by default.

## Endpoints

| Request                           | Query             | Response                             |
| --------------------------------- | ----------------- | ------------------------------------ |
| `GET /delivery/:collection`       | `page`, `perPage` | `{ items: DeliveredEntry[], total }` |
| `GET /delivery/:collection/:slug` | none              | `DeliveredEntry`, or 404             |

`:collection` is the collection's handle: `pages` and `posts` on a new site.

- `page` starts at 1. `perPage` is 25 by default, 100 at most.
- Dated collections (blog posts) are newest first; the others are in the order editors set.
- `total` counts every published entry, for pagination.

## An entry

```json
{
  "id": "3f0b6a2e-8a4f-4c1e-9d7a-1b2c3d4e5f60",
  "slug": "hello-world",
  "url": "/blog/hello-world",
  "publishedAt": "2026-10-30T09:15:00.000Z",
  "data": {
    "title": "Hello, world",
    "excerpt": "Our first post.",
    "featured_image": {
      "id": "8d1c2b3a-0f9e-4d8c-b7a6-5e4d3c2b1a09",
      "url": "http://localhost:4000/media/8d1c2b3a-0f9e-4d8c-b7a6-5e4d3c2b1a09/file?v=3a9f0c1d2e4b",
      "alt": "Two chefs plating desserts",
      "width": 2400,
      "height": 1600,
      "focalPoint": { "x": 0.62, "y": 0.4 }
    },
    "body": {
      "json": { "type": "doc", "content": [] },
      "html": "<p>We made a thing.</p>"
    },
    "category": "news"
  }
}
```

- `url` is the collection's route pattern filled in (`/blog/{slug}` becomes
  `/blog/hello-world`; `{year}`, `{month}` and `{day}` come from the publish date in UTC).
  It's `null` when the collection has no pages of its own.
- `data` has every field of the content type, keyed by handle. Empty fields are `null`.

## Field values

| Fieldtype          | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| `text`, `textarea` | string                                                              |
| `richText`         | `{ json, html }`: the editor's document and its HTML                |
| `number`           | number                                                              |
| `toggle`           | boolean                                                             |
| `select`           | string, or string[] when it allows several                          |
| `date`             | `YYYY-MM-DD`, or a date and time when it includes a time            |
| `image`            | `{ id, url, alt, width, height, focalPoint }`, or `null` if deleted |
| `link`             | `{ url, label? }`                                                   |

Rich text HTML is rendered on the server from the editor's document, with the same
extensions the editor uses. Images are covered in [Images](/building/images/).

## Examples

```bash
curl http://localhost:4000/delivery/posts?perPage=10
curl http://localhost:4000/delivery/pages/about-us
```

```ts
interface DeliveredEntry<Data> {
  id: string;
  slug: string;
  url: string | null;
  publishedAt: string | null;
  data: Data;
}

interface PostData {
  title: string;
  excerpt: string | null;
  body: { json: unknown; html: string } | null;
}

const response = await fetch("http://localhost:4000/delivery/posts/hello-world");
if (response.status === 404) {
  // Not published, or doesn't exist.
}
const post: DeliveredEntry<PostData> = await response.json();
```

The [Next.js starter](/building/nextjs-starter/) has typed helpers ready to copy.

## Errors

Errors are JSON: `{ statusCode, code, error, message }`.

| Status | `code`            | When                                                     |
| ------ | ----------------- | -------------------------------------------------------- |
| 400    | `INVALID_REQUEST` | `page` or `perPage` isn't a whole number in range        |
| 404    | `NOT_FOUND`       | No such collection, or no published entry with that slug |

## Caching

Responses carry `Cache-Control: public, max-age=60`, so a CDN or browser may keep them for
a minute; a publish shows up within that time. Pair it with your framework's caching (the
Next.js starter revalidates every 60 seconds).

## Calling it from a browser

CORS only allows the admin's address today, so call the delivery API from your site's
server (server rendering, static builds, or an API route), not from browser JavaScript on
another domain.
