import { defineEffect } from "../effect-definition.js";
import { choice, colour, number, text } from "../parameters.js";

/**
 * Cursors that appear over one element. The site-wide cursor is chosen in the builder's
 * site settings instead. Only for a mouse or trackpad; touch screens see nothing different.
 */

const label = (id: string, name: string, description: string, words: string) =>
  defineEffect({
    id,
    name,
    description,
    category: "cursor",
    kind: "behaviour",
    module: "cursor",
    behaviour: "cursorLabel",
    suits: ["container", "image", "list"],
    params: {
      text: text("Label", words, 24),
      background: colour("Label colour", "#111111"),
      colour: colour("Text colour", "#ffffff"),
    },
    reducedMotion: "The label follows the pointer exactly.",
    preview: "image",
    keywords: ["cursor", "label", "pointer"],
  });

const trail = (id: string, name: string, description: string, items: string) =>
  defineEffect({
    id,
    name,
    description,
    category: "cursor",
    kind: "behaviour",
    module: "cursor",
    behaviour: "cursorTrail",
    suits: ["container"],
    params: {
      items: text("What it leaves behind, separated by commas", items, 120),
      spacing: number("Space between them", 48, 16, 160, { unit: "px" }),
      colour: colour("Colour", "#7539fd"),
    },
    reducedMotion: "No trail.",
    preview: "card",
    keywords: ["trail", "cursor", "sparkle"],
  });

export const cursorEffects = [
  label(
    "cursor-view",
    "“View” cursor",
    "Shows a round “View” label that follows the pointer over this element. Good for project grids.",
    "View",
  ),
  label(
    "cursor-drag",
    "“Drag” cursor",
    "Tells people they can drag: a “Drag” label follows the pointer.",
    "Drag",
  ),
  label("cursor-play", "“Play” cursor", "A “Play” label over videos and reels.", "Play ▸"),
  trail(
    "sparkle-trail",
    "Sparkle trail",
    "Little sparkles appear behind the pointer and fade away.",
    "✦, ✧, ⋆",
  ),
  trail(
    "word-trail",
    "Word trail",
    "Leaves a trail of words behind the pointer. Try your services, or “hello” in many languages.",
    "Hello, Bonjour, Hola, Ciao, Hallo",
  ),
  trail("emoji-trail", "Emoji trail", "A playful trail of emoji. Use sparingly!", "🎉, ✨, 💜"),
];

/**
 * What the pointer does over an element, set with fields of their own on the Animate tab
 * rather than from the gallery (`listed: false`): a short word the cursor shows, a picture
 * that follows the pointer, or a change to the site's cursor (`cursor-over`: grow, show a
 * different picture, hide, or step aside for the normal pointer).
 */
export const cursorWordEffectId = "cursor-word";
export const hoverPictureEffectId = "hover-picture";
export const cursorOverEffectId = "cursor-over";

/** An element's own look for its word; empty means the site's choice. */
const wordLookParams = {
  background: text("Background", "", 80),
  colour: text("Letters", "", 80),
  size: choice("Size", "", [
    ["", "The site's choice"],
    ["small", "Small"],
    ["medium", "Medium"],
    ["large", "Large"],
  ]),
  shape: choice("Shape", "", [
    ["", "The site's choice"],
    ["pill", "Pill"],
    ["square", "Square"],
    ["circle", "Circle"],
  ]),
};

export const pointerFieldEffects = [
  defineEffect({
    id: cursorWordEffectId,
    name: "Word on the cursor",
    description: "A short word, such as “View”, shown by the cursor over this element.",
    category: "cursor",
    kind: "behaviour",
    module: "cursor",
    behaviour: "cursorWord",
    suits: ["any"],
    params: { text: text("Word", "View", 16), ...wordLookParams },
    reducedMotion: "The word follows the pointer exactly.",
    preview: "card",
    listed: false,
  }),
  defineEffect({
    id: hoverPictureEffectId,
    name: "Picture on hover",
    description: "A picture that appears and follows the pointer while it is over this element.",
    category: "cursor",
    kind: "behaviour",
    module: "pointer",
    behaviour: "hoverPicture",
    suits: ["any"],
    params: {
      src: text("Picture", "", 400),
      // Set for a picture from the media library, whose server then sends a smaller copy.
      assetId: text("Picture in the media library", "", 64),
      size: choice("Size", "medium", [
        ["small", "Small"],
        ["medium", "Medium"],
        ["large", "Large"],
      ]),
    },
    reducedMotion: "The picture appears without fading or trailing behind the pointer.",
    preview: "card",
    listed: false,
  }),
  defineEffect({
    id: cursorOverEffectId,
    name: "Cursor over this element",
    description:
      "Changes the cursor over this element: it grows, becomes a different picture, hides, or gives way to the normal pointer.",
    category: "cursor",
    kind: "behaviour",
    module: "cursor",
    behaviour: "cursorOver",
    suits: ["any"],
    params: {
      mode: choice("What the cursor does", "grow", [
        ["grow", "Grows"],
        ["picture", "Becomes a different picture"],
        ["hide", "Hides"],
        ["normal", "Normal pointer"],
      ]),
      src: text("Picture", "", 400),
      size: number("Picture size", 32, 16, 96, { unit: "px" }),
      point: choice("Where it points", "centre", [
        ["centre", "The middle"],
        ["top-left", "The top-left corner"],
      ]),
      bytes: number("File size", 0, 0, 1_000_000_000),
    },
    reducedMotion: "The cursor changes at once, without growing smoothly.",
    preview: "card",
    listed: false,
  }),
];
