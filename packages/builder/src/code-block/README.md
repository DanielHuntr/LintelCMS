# Code element

`CodeBlockEditor.tsx`: a Code element's HTML, CSS and JavaScript, edited in the **Content**
panel under the fields its markers make (`data-lintel-field`, `data-lintel-image`). Only
people with the `builder:code` permission see it; everyone else changes the marked words
and pictures. Changes wait for **Save code**, so a half-typed tag never reaches the page.

The builder has no other code tools: developers work on the site's Liquid templates in their
own editor with `lintel templates init` and `lintel templates sync`. Pasting HTML onto the
page still turns it into elements (and, with the permission, Code elements for what doesn't
match). See docs/decisions/0046-one-builder-for-everyone.md.
