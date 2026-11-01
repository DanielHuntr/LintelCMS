---
title: Make your own blocks
description: Save something you designed as one of your site's blocks, choose what editors can change, and use it on any page or in a content type.
since: "0.6"
sidebar:
  label: Make your own blocks
---

A **block** is a piece of design you use again and again: a team card, a quote, a call to
action, a price box. You design it once in the page builder and save it as one of your
site's blocks. From then on anyone can add it to a page from **Insert**, fill in its
details in a simple form, and it always looks exactly as you designed it.

Change the block's design later and every page that uses it changes too.

## Make a block

1. Open a page in the builder and design the piece you want to reuse, such as a box with a
   photo, a name, a role and a LinkedIn button.
2. Select it (on the page, or in **Layers**) and press **Make into a block**, under the
   panel on the right.
3. Give it a **name** ("Team card"), pick an **icon**, and choose a **group** for Insert
   ("Team"). Blocks in the same group are listed together.
4. Under **What editors can change**, tick each part people should fill in each time they
   use the block, and name it the way they'll see it:
   - **Words**: a heading's or paragraph's text, such as Name or Role.
   - **Picture**: a photo from the media library, with its description.
   - **Link**: where a button or link goes.
   - **Show or hide**: a switch that shows or hides that part, such as Show LinkedIn.
   - **Colour**: one of its colours, such as an accent.
   - **A list of these**: several cards in a grid become a list, and editors add as many as
     they need. The first card is the design of each.
5. Press **Make block**. What you selected becomes your new block, already filled in with
   what it said, and the block appears in Insert.

Everything you didn't tick stays exactly as designed.

## Use a block

In the builder, open **Insert**, choose **Elements**, and find your block at the top under
**Your site's blocks** (or type its name in the search). Press it to add it after what's
selected.

Select a block on the page to fill it in. The panel on the right shows its form: the same
kinds of fields you know from writing content, with their help text, sizes and rules. What
you type shows on the page straight away. Anything you leave empty shows what the design
says.

A block's design can't be changed by accident from a page: clicking anywhere on it selects
the whole block.

### Make one different from the rest

If one page needs a version of the block that looks different, select it and press
**Detach from block**. After you confirm, it becomes ordinary elements with what you filled
in, which you can change freely. Later changes to the block won't reach it.

## Change a block

Go to **Design → Your site's blocks** and open the block. There you can:

- rename it, change its icon, group and description;
- change **What editors fill in**: add fields, change their labels, help text, width,
  rules and when they show, exactly as for a content type;
- press **Edit design** to open the block in the builder. Change it as you would a page,
  and use **Choose what editors can change** to tick or untick parts. **Save design**
  changes every page that uses the block;
- see **Where it's used**: every page with the block, each a link to open it.

If you rename a field, pages keep what was filled in. If you remove a field that pages
have filled in, Lintel lists those pages and asks before taking it out.

## Delete a block

Open the block and press **Delete block**. If pages use it, Lintel tells you how many and
offers to turn the block into ordinary elements on those pages first, so they look exactly
the same; then the block is deleted.

## Blocks in content types

Your blocks can also be offered in a content type's **blocks field** (the list of sections
some pages are built from). In the content type, open the blocks field's settings and use
**Add one of your site's blocks**. Editors then pick the block when adding a section, fill
in its form and see a live preview of how it will look under the form. The website draws it
exactly as it does on a designed page.

## Who can make blocks

Anyone who can edit a page can use blocks. Making, changing and deleting them needs
**Make and change the site's blocks** (`builder:blocks`), which Owners and Admins have. Give
it to other roles in **Users → Roles**.

Some blocks are **defined in code** by a developer, or **added by a feature** you switched on.
You can use them like any other, but they're changed by whoever looks after them.
