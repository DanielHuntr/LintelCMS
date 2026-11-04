---
title: The content tree
description: How pages sit under each other, what that does to their addresses, and what the marks in the tree mean.
since: "1.0.0-rc"
sidebar:
  label: The content tree
---

The tree beside **Content** shows every page of your site, in the shape of your site. Open
a page's arrow to see the pages under it.

## Why pages sit under Home

**Home** is your site's front page, at the address `/`. The pages of your site sit under
it, like folders inside a folder.

- A page directly under Home gets its own address: **Work** is at `/work`.
- A page under any other page adds to that page's address: **Article** under **Blogs** is
  at `/blogs/article`.

So where a page sits decides its address, and moving it changes the address. When a move
changes the address of a live page, Lintel offers to send visitors from the old address to
the new one, if you have the search engine tools turned on.

To move a page, drag it in the tree, choose **More**, then **Move…** in its menu, or change
**Parent page** in the panel beside the page.

## What the marks mean

Most pages are live, so they have no mark. A mark means the page needs a second look. Press
the **i** beside **Content** to see this list in Lintel, or rest the pointer on a mark.

| Mark          | Status                    | What it means                                                       |
| ------------- | ------------------------- | ------------------------------------------------------------------- |
| None          | **Live**                  | On your site.                                                       |
| Pencil        | **Changes not published** | On your site, but visitors see the older version until you publish. |
| Dashed circle | **Draft**                 | Not on your site yet. Only people who sign in to Lintel can see it. |
| Clock         | **Scheduled**             | Goes live by itself at the time you chose. The tooltip says when.   |

## A page's menu

Press **…** on a row, or right-click it. The menu keeps to what you're likely to want:

- **Create…**, **Rename…** and **Duplicate…**
- **Publish…** or **Unpublish…**, whichever applies to the page, and **View page** for a
  live page or **Preview** for one that isn't.
- **Delete…**

Everything else waits under **More**: Move, Sort children, History, Info, Show as a list and
Domain and path. If a page has pages under it, More also has the other of Publish and Unpublish,
for changing those pages along with it.

You only see what your role allows.

## One page, two views

Opening a page shows its **Content** view: a picture of the design, its fields, and its
settings in the panel on the right. **Design** opens the same page in the builder. The
switch at the top of both moves between them, and the page's name, status, **View page**,
**Preview** and **Publish** stay at the top in both.

On a phone there's no Design view, because the builder needs a bigger screen.

People with a content-only role see **On the page** instead of Design: the page as it looks,
with the words and pictures their designer opened up.
