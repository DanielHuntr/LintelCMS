---
title: Make your own components
description: Save something you designed as one of your site's components, choose what editors can change, and use it on any page or in a content type.
since: "0.6"
sidebar:
  label: Make your own components
---

A **component** is a piece of design you use again and again: a team card, a quote, a call to
action, a price box. You design it once in the page builder and save it as one of your
site's components. From then on anyone can add it to a page from **Insert**, fill in its
details in a simple form, and it always looks exactly as you designed it.

Change the component's design later and every page that uses it changes too.

## Make a component

1. Open a page in the builder and design the piece you want to reuse, such as a box with a
   photo, a name, a role and a LinkedIn button.
2. Select it (on the page, or in **Layers**) and press **Make into a component**, under the
   panel on the right.
3. Give it a **name** ("Team card"), pick an **icon**, and choose a **group** for Insert
   ("Team"). Components in the same group are listed together.
4. Under **What editors can change**, tick each part people should fill in each time they
   use the component, and name it the way they'll see it:
   - **Words**: a heading's or paragraph's text, such as Name or Role.
   - **Picture**: a photo from the media library, with its description.
   - **Link**: where a button or link goes.
   - **Show or hide**: a switch that shows or hides that part, such as Show LinkedIn.
   - **Colour**: one of its colours, such as an accent.
   - **A list of these**: several cards in a grid become a list, and editors add as many as
     they need. The first card is the design of each.
5. Press **Make component**. What you selected becomes your new component, already filled in with
   what it said, and the component appears in Insert.

Everything you didn't tick stays exactly as designed.

## Use a component

In the builder, open **Insert**, choose **Elements**, and find your component at the top under
**Your components** (or type its name in the search). Press it to add it after what's
selected.

Select a component on the page to fill it in. The panel on the right shows its form: the same
kinds of fields you know from writing content, with their help text, sizes and rules. What
you type shows on the page straight away. Anything you leave empty shows what the design
says.

A component's design can't be changed by accident from a page: clicking anywhere on it selects
the whole component.

### Make one different from the rest

If one page needs a version of the component that looks different, select it and press
**Detach from component**. After you confirm, it becomes ordinary elements with what you filled
in, which you can change freely. Later changes to the component won't reach it.

## Change a component

Go to **Design → Your components** and open the component. There you can:

- rename it, change its icon, group and description;
- change **What editors fill in**: add fields, change their labels, help text, width,
  rules and when they show, exactly as for a content type;
- press **Edit design** to open the component in the builder. Change it as you would a page,
  and use **Choose what editors can change** to tick or untick parts. **Save design**
  changes every page that uses the component;
- see **Where it's used**: every page with the component, each a link to open it.

If you rename a field, pages keep what was filled in. If you remove a field that pages
have filled in, Lintel lists those pages and asks before taking it out.

## Delete a component

Open the component and press **Delete component**. If pages use it, Lintel tells you how many and
offers to turn the component into ordinary elements on those pages first, so they look exactly
the same; then the component is deleted.

## Components in content types

Your components can also be offered in a content type's **blocks field** (the list of sections
some pages are built from). In the content type, open the blocks field's settings and use
**Add one of your site's components**. Editors then pick the component when adding a section, fill
in its form and see a live preview of how it will look under the form. The website draws it
exactly as it does on a designed page.

## Who can make components

Anyone who can edit a page can use components. Making, changing and deleting them needs
**Make and change the site's components** (`builder:blocks`), which Owners and Admins have. Give
it to other roles in **Users → Roles**.

Some components are **defined in code** by a developer, or **added by a feature** you switched on.
You can use them like any other, but they're changed by whoever looks after them.

## Variants

One component can come in a few looks, such as a Button in three sizes, filled or outlined,
with or without an icon.

1. Open the component's design and press **Add variants**, above the canvas.
2. Name a variant and type its choices, separated by commas: **Size** and
   **Small, Medium, Large**. The first is where it starts.
3. Pick a choice above the canvas and change how it looks. The line beside the choices says
   where changes go. Hide a part to leave it out of that choice.
4. Save the design.

Choices combine, so Small and Outline together look small and outlined. To give a combination
its own look, pick both and change it. Changes made with every choice at its start go to every
variant that hasn't said otherwise.

Anyone using the component picks its variant at the top of its panel. Clients only see the
variants if you turn on **Clients can choose variants** under **Edit variants**. They can always
fill in its details.

## Make several things one component

If you've built the same thing several times, such as the rows of a list, you don't have to
start again. Select them, or select one that shares a shared style with the others, and press
**Make these one component**.

Lintel shows what will happen first. The words, pictures and links that differ become details
each one keeps. Layout, styles and animation become shared, so changing the title's animation
in the component changes it in every row. Undo puts everything back in one step.

## Select several things at once

In **Layers**, hold Ctrl (Cmd on a Mac) and click to add or take away, or hold Shift and click
to select a run of layers side by side. Ctrl or Cmd with A selects everything beside the
current layer, and Shift with the up and down arrows adds the next one. On the page, hold Shift
and click.

With several selected, **Style** changes all of them and shows **Mixed** where they differ, and
**Animate** puts the same motion on all of them, replacing what they had. You can also duplicate,
delete, group or move them together.
