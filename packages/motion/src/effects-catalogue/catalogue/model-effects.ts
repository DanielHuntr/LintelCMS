import { defineEffect } from "../effect-definition.js";
import { choice, text } from "../parameters.js";

/**
 * What runs a 3D model element. Set from the element's own fields (the model, its motion,
 * light and background) rather than the gallery, so it isn't listed there.
 */
export const modelEffects = [
  defineEffect({
    id: "model-viewer",
    name: "3D model",
    description: "Draws the element's 3D model, lit and turning as its settings say.",
    category: "depth",
    kind: "behaviour",
    module: "model",
    behaviour: "modelViewer",
    suits: ["any"],
    listed: false,
    params: {
      src: text("Model", "", 2000),
      motion: choice("Motion", "spin", [
        ["still", "Still"],
        ["spin", "Spin slowly"],
        ["pointer", "Follow the pointer"],
        ["scroll", "Turn as you scroll"],
        ["drag", "Drag to turn"],
      ]),
      light: choice("Light", "studio", [
        ["studio", "Studio"],
        ["daylight", "Soft daylight"],
        ["dramatic", "Dramatic"],
        ["night", "Night"],
      ]),
      background: text("Background", "transparent", 20),
    },
    reducedMotion: "Shows the model's picture, or the model standing still.",
    preview: "image",
    weight: "heavy",
  }),
];
