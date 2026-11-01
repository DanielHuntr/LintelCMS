---
title: Next.js starter
description: A ready-made website that reads Lintel's delivery API, to copy and build on.
since: "0.1"
---

`starters/nextjs` is a small, complete website built with Next.js (App Router). It reads
Lintel's delivery API and renders:

- a **home page**: your page with the slug `home` if there is one, and the latest posts;
- **pages** at `/<slug>`, with their hero image and rich text body;
- a **blog index** at `/blog`, ten posts a page (`/blog/page/2`...);
- **blog posts** at `/blog/<slug>`.

Images are cropped by Lintel around each one's focal point, in several widths. Pages are
regenerated in the background at most once a minute (incremental static regeneration),
and can be refreshed straight away through `/api/revalidate`.

## Run it

With Lintel running (`pnpm dev`) and something published:

```bash
cp starters/nextjs/.env.example starters/nextjs/.env.local
pnpm --filter starter-nextjs dev
```

Open <http://localhost:3000>. It isn't started by the root `pnpm dev`, so it doesn't get
in the way when you're only working on Lintel.

## Where things are

| File                         | What it does                                            |
| ---------------------------- | ------------------------------------------------------- |
| `lib/lintel.ts`              | Typed fetch helpers: `getEntry`, `listEntries`          |
| `lib/content-types.ts`       | The fields of Pages and Blog posts, as TypeScript types |
| `lib/images.ts`              | Building resized, focal-point-cropped image URLs        |
| `components/LintelImage.tsx` | A responsive `<img>` with `srcset`                      |
| `components/RichText.tsx`    | Renders a rich text field's HTML                        |
| `app/`                       | The routes                                              |

The starter's [README](https://github.com/DanielHuntr/lintelcms/blob/main/starters/nextjs/README.md)
walks through it step by step, including deploying and adding your own content types.
