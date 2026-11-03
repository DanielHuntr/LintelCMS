# 0050: Menu links and text effects on hover

Date: 3 November 2026. Status: accepted.

## Context

Daniel asked whether text could do something on hover, with a picture of a mono-type menu
whose current item has a thin circle around it, and then: "What if I want to style them
differently? Should it be Menu > Link?"

A Menu draws its links itself, from the site's menu (Content → Menus) or its own list, so
its links couldn't be selected, styled or given an effect. Text effects that play on hover
existed (Wave on hover, Bolder on hover, Scramble with "When the pointer is over it") but
were listed under "Appears" and were not among the Motion panel's quick tiles.

## Decision

- **A Menu holds one Menu link**, shown in Layers: the look of every link. It is styled like
  any element, including its Hovered and Current looks, so "a circle around the current
  page" is simply its Current look or the circle hover look kept on the current page. Its
  words and addresses still come from the menu.
- **One link on its own.** Clicking a link on the canvas selects the Menu link with that
  link in hand; Style then offers "Changes apply to: Every menu link / Only “Contact”", the
  same pattern as shared styles. Only keeps just the changed properties on the Menu link,
  by menu item id (`itemStyles`), and the shared look shows for everything else. Menu items
  now carry their ids to the page (`data-menu-item`).
- **Hover looks** on the Menu link: none, a line drawing in, the words rolling up, the
  letters scrambling, a circle, a colour fade (with a colour from the site's or theme's
  colours). All but the scramble are CSS written with the page; the roll up draws a copy of
  the words with `aria-hidden`. The scramble runs the `scramble-on-hover` effect, so the
  effects runtime only loads when a menu scrambles. Hover rules only apply on devices that
  can hover; keyboard focus gets the same look; with less motion the change is instant and
  nothing rolls.
- **The drawer** of a Menu button in the same part of the page takes the same look.
- **New effects:** Roll up (`roll-up`) and Scramble on hover (`scramble-on-hover`), for any
  text, link or button. Text effects that play while the pointer is over the words are now
  offered under Hover, and the Motion panel's Hover tiles for words are Lift, Roll up,
  Underline, Scramble, Wave and Bolder (text) or Lift, Grow, Roll up, Underline, Scramble and
  Wave (links and buttons); the rest stay under More effects.
- An effect on an element drawn more than once (each link of a menu) runs on every copy.

## Consequences

- Menus made before this have no Menu link and draw exactly as before. The builder adds one
  when the page is opened, without marking the page changed; it is saved with the next
  change. With nothing changed on it, it adds no CSS.
- Menu links can't be deleted, copied or moved on their own. Hiding one draws the menu's
  links plainly.
- The drawer's links don't roll or scramble (phones have no hover); they do show the
  current page's look.
- The Header element keeps drawing its own links; this applies to the Menu element, which
  the Navigation and Footer sections use.
