---
title: Advanced styling
description: Turning and slanting, shapes and masks, picture and video backgrounds, blends and filters, your own fonts, text effects and styling single words.
since: "0.1"
sidebar:
  label: Advanced styling
---

The page builder can make poster-like pages: giant words with a photo laid over them, a
turned sticker, letters filled with a picture, a person cut out in front of a headline. Each
of these is a setting in the **Style** panel, so nobody has to write code, and each becomes
plain, readable CSS on the website.

Everything here can be set for one screen size: pick **Tablet** or **Phone** at the top
first, and the change applies at that size and smaller. A dot next to a setting means it's
changed for that size; **Reset** goes back to the bigger size's value. **Which look you're
changing** also lets you change things while the pointer is over the element, so a card
can straighten up when someone points at it (see [Site styles](/using/site-styles/#which-look-youre-changing)).

## Move and turn

- **Turn** turns the element; **Size** makes it bigger or smaller without moving anything
  around it. You can also drag the round handle above the selected element on the page. Hold
  **Shift** to turn in steps of 15°.
- In **Advanced**: **Move across** and **Move down** nudge it from where it sits, **Slant**
  tilts it sideways or up and down, and **Turns and grows around** chooses the point it turns
  around (a corner, an edge or the middle).

## Shape and mask

- **Shape** cuts the element to a circle, an oval, rounded corners, a diagonal cut, a slash
  or an arch. **Your own** gives a shape with corners you can drag: drag a corner, or pick it
  and use the arrow keys (**Shift** for bigger steps). **Add a corner** and **Remove corner**
  change how many there are. Shapes stretch with the element at every screen size.
- In **Advanced**, **Fade or mask** fades a picture out at the bottom or the sides, gives it
  soft edges, or uses a picture from the media library (a logo, a brush stroke) as its shape.

Shapes and masks only change how something looks. Everything inside is still read out in
full by screen readers.

## Background

- **Background colour** is the colour behind everything.
- **Add a picture** puts a picture from the media library behind the element. Click the part
  of the picture that matters most (or use the arrow keys on it), and that part stays in view
  however the picture is cropped. **Darken it** lays a shade over the picture so text on it
  stays readable.
- In **Advanced**, a background is a stack of layers, top first: pictures, gradients and
  colour overlays. Each layer has its own size, repeat and whether it **Stays still** while
  the page scrolls. **Blend the layers** mixes them like a photo editor does.
- **Show the background through the text** fills the letters with the background: a photo
  inside a giant word, or a gradient.
- Sections can have a **Video behind it**: upload an MP4 or WebM file, choose a poster
  picture and how much to darken it. The video plays silently on a loop. People who prefer
  less motion see the poster instead, and everyone gets a pause button.

## Blend and filters

- **Look** gives a picture a ready-made look: black and white, faded, vivid or blurred.
- In **Advanced**, **Blend with what's behind** mixes the element with whatever is under it
  (multiply darkens, screen lightens), and each filter has its own slider: blur, grey,
  brightness, contrast, colourfulness and colour shift. **Blur what's behind it** makes
  frosted glass.

## Fonts

Under **Text**, the font list has your theme's two fonts, your site's own fonts, any fonts
added to this page only, and the 23 fonts that come with Lintel. They load from your own
website, never from anyone else's (except Adobe Fonts, which Adobe serves).

**Add a font**, at the bottom of the list, adds one from Google Fonts, your own files or
Adobe Fonts to the whole site. See [Fonts](/using/fonts/).

## Text effects

- **Grow with the screen** sets a size for phones and one for wide screens, and the text
  grows smoothly between them: the easiest way to have huge headlines that still fit a phone.
- **Outlined letters** draws just the outline of the letters.
- In **Advanced**: the outline's colour, **Text shadow**, **Text runs** downwards or upwards
  (vertical text up the side of a page), **Even lines** for headlines that break nicely, and
  **Keep on one line**.

## Styling words inside a text

Select a few letters or words of a heading or paragraph on the page (double-click it to edit
it, then select). A bar appears above the page: **Italic**, **Bold**, **Outlined letters**, a
**Colour**, **Highlight**, another font or size, and **Clear styles**. This is how a headline
gets one thin italic letter inside a bold word.

You can do the same from the keyboard in **Content**: select words in the text box (with
**Shift** and the arrow keys) and use the same buttons under it.

When you change the text later, the styles stay on the words they were on.

## For developers

The styles are ordinary CSS properties, printed in a fixed order in the page's stylesheet:
`rotate`, `scale`, `translate`, `transform: skew()`, `clip-path`, `mask-image`, layered
`background-image`, `mix-blend-mode`, `filter`, `backdrop-filter`, `-webkit-text-stroke`,
`writing-mode`, `text-wrap` and so on, per screen size in media queries and in `:hover`
rules. Styled words are `<em>` (for italics) and `<span>` with a class such as
`.hero-title-mark-1`. Pictures in styles can only come from the website or the web, and
values can't break out of their property; `docs/decisions/0021-advanced-styles.md` explains
the checks.
