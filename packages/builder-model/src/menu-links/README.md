# Menu links

A Menu draws its links from the site's menu (or its own list), so they can't be selected one
by one. Each Menu holds one **Menu link** instead: the look of every link in it. People style
it like any element, with its Hovered and Current looks, pick what a link does on hover, and
can change a few links on their own ("Only Contact"). Those changes are kept on the Menu link
by menu item id and fall back to the shared look for everything else.

| File            | What it does                                                          |
| --------------- | --------------------------------------------------------------------- |
| `menu-links.ts` | Menu item ids, adding Menu links to older menus, drawers, and the CSS |

The links carry the Menu link's class and `data-menu-item`, so it is all CSS:

- the hover looks (a line drawing in, the words rolling up, a circle, a colour fade) show
  while the pointer is over a link on devices that can hover, and on keyboard focus;
- "Keep it on the current page's link" holds the look on `aria-current="page"`;
- with less motion the change is instant and the words don't roll;
- a Menu button's drawer in the same part of the page takes the same look.

Only the scramble needs a script: the page runs the `scramble-on-hover` effect on every link
(see `impliedMenuLinkEffect`). Menus with no Menu link draw exactly as before.

See `docs/decisions/0050-menu-links.md`.
