---
title: Building with Lintel
description: For developers building websites on Lintel or working on Lintel itself.
since: "0.1"
sidebar:
  label: Start here
---

Lintel is a TypeScript monorepo: an API server (`packages/core`), a React admin
(`packages/admin`), these docs (`packages/docs`) and site starters (`starters/`).

Editors write in the admin. Your website reads what they publish from the **delivery
API**, a public, read-only REST API that serves only published content. Lintel doesn't
render your site; you build it with any framework that can make an HTTP request.

## Pick your path

- **Building a website on Lintel:** [install it](/building/install/), read the
  [delivery API](/building/delivery-api/) and [images](/building/images/) pages, then start
  from the [Next.js starter](/building/nextjs-starter/).
- **Working on Lintel itself:** read the [architecture](/building/architecture/), how
  [feature folders](/building/feature-folders/) are laid out, and
  [contributing](/building/contributing/).

## What exists today

| Area                                          | Status                                                            |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Setup, accounts                               | Setup screens, sign-in, Super admin, scripts for more admins      |
| Content                                       | Content types, entries, drafts, publishing, scheduling, history   |
| Media                                         | Uploads, alt text, focal points, resized and cropped images       |
| Delivery API                                  | `GET /delivery/:collection` and `GET /delivery/:collection/:slug` |
| Plugins                                       | Switching features on and off (Blog creates Blog posts)           |
| Visual builder, commerce, forms, users screen | On the roadmap                                                    |
