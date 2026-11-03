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
 * Two pointer touches set with fields of their own on the Animate tab rather than from the
 * gallery (`listed: false`): a short word the cursor shows over the element, and a picture
 * that follows the pointer while it is over the element.
 */
export const cursorWordEffectId = "cursor-word";
export const hoverPictureEffectId = "hover-picture";

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
    params: { text: text("Word", "View", 16) },
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
];
