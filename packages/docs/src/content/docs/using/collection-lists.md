---
title: Collection lists
description: Showing entries from a collection, such as your latest blog posts, with a design you make once, and designing every entry's page.
since: "0.6"
sidebar:
  label: Collection lists
---

A **Collection list** shows entries from one of your collections (blog posts, projects,
team members) and fills itself in: publish a new post and it appears, with nothing to edit.
You design how one entry looks, once, and every entry is drawn that way.

## Add a list

1. In the page builder, open **Insert**, then **Elements**, then **Collections**, and press
   **Collection list**.
2. In **Content**, under **What it shows**, choose the **Collection**, such as Blog posts.
3. Choose how many to show, the order (newest first, oldest first, by title, or the
   collection's own order), and optionally **Only entries filed under** a category or tag.
4. Turn on **Link to more pages when there are more** to add Previous and Next links.

The canvas shows your real entries straight away, so you design with real titles and
pictures. If the collection has nothing published yet, each field's name shows instead.

## The item design

Whatever is inside the list is its **item design**, drawn once for every entry. A new list
starts with a card holding the entry's picture, date, title and summary, linking to the
entry's page. Change it like anything else: move things, delete them, add a button or a
badge, and style them in **Style**.

The first copy on the canvas is the one you edit; the others follow it.

## Show a field

Elements inside a list can show the entry's fields instead of words you type. Select one,
and in **Content** you'll find **Shows** above its text, picture or link:

- **What I type here**: the element shows what you type, the same for every entry.
- **Blog posts: Title** (or any other field): each entry shows its own.

Every entry has a title, a summary, a main picture, its page's address, the date it was
published and its body text. Fields of the collection's own content type are listed too,
so a recipe's "Cooking time" or a project's "Client" can be shown just as easily. Only
fields that suit the element are offered: pictures for a Picture, addresses for a link.

## When there is nothing to show

Under **What to say when there are none**, write the sentence visitors see when the list is
empty, such as "No recipes yet. Check back soon." It also shows when a filter matches
nothing.

## Designing every entry's page

A page can be the design for every entry of a collection: for example, how every blog post
looks.

1. Make a page (Content → Pages → New page), such as "Blog post design".
2. In the page builder, select the page itself (the top of Layers).
3. In **Content**, choose **Use this page as the design of every entry in**: Blog posts.
4. Add headings, pictures and rich text, and set each one's **Shows** to the post's title,
   picture, date or body.
5. Publish the page.

From then on every post is drawn with this design, showing its own fields. A Collection list
on that design (for "More posts") leaves out the post being read, unless you turn off
**Leave out the entry being shown** under More options. The design's own page address shows
it with your newest post as the example.

For developers: lists and fields are stored on each element as `bindings`
(`{ "text": "title" }`) and filled in by the built-in website. See the page document notes
in `packages/builder-model`.
