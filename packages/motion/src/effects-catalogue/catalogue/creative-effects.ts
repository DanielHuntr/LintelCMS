import { defineEffect } from "../effect-definition.js";
import { choice, text, toggle } from "../parameters.js";

/**
 * The creative pack's effects: a container whose items visitors can drag and throw, and the
 * players behind the Lottie and Rive elements. The players are set by their elements' own
 * fields (`listed: false`), so the gallery leaves them out; see decision 0055.
 */

export const dragPlaygroundEffectId = "drag-playground";
export const lottiePlayerEffectId = "lottie-player";
export const rivePlayerEffectId = "rive-player";

/** The longest address an animation file may have. */
const addressLength = 2000;

export const creativeEffects = [
  defineEffect({
    id: dragPlaygroundEffectId,
    name: "Drag and throw these",
    description:
      "Visitors can pick up the things inside (stickers, cards, badges), throw them and watch them bump into each other.",
    category: "physics",
    kind: "behaviour",
    module: "playground",
    behaviour: "dragPlayground",
    suits: ["container"],
    params: {
      feel: choice("How things move", "drift", [
        ["drift", "Float and drift"],
        ["fall", "Fall into a pile"],
        ["bouncy", "Bouncy"],
      ]),
      tidyButton: toggle("Show a Tidy up button", true),
      tidyLabel: text("Button words", "Tidy up", 40),
    },
    reducedMotion: "Everything stays where the design put it.",
    weight: "medium",
    preview: "panels",
    keywords: ["physics", "stickers", "gravity", "playful", "throw", "drag"],
  }),
  defineEffect({
    id: lottiePlayerEffectId,
    name: "Lottie animation",
    description: "Plays the Lottie element's animation.",
    category: "svg",
    kind: "behaviour",
    module: "lottie",
    behaviour: "lottiePlayer",
    suits: ["any"],
    params: {
      src: text("Animation file", "", addressLength),
      play: choice("Plays", "view", [
        ["view", "When it comes into view"],
        ["load", "As soon as the page opens"],
        ["hover", "When the pointer is over it"],
        ["scroll", "As visitors scroll"],
      ]),
      loop: toggle("Play again at the end", true),
    },
    reducedMotion: "Shows the still picture, or one still frame.",
    preview: "image",
    listed: false,
  }),
  defineEffect({
    id: rivePlayerEffectId,
    name: "Rive animation",
    description: "Plays the Rive element's animation.",
    category: "canvas",
    kind: "behaviour",
    module: "rive",
    behaviour: "rivePlayer",
    suits: ["any"],
    params: {
      src: text("Animation file", "", addressLength),
      play: choice("Plays", "view", [
        ["view", "When it comes into view"],
        ["load", "As soon as the page opens"],
      ]),
      respondTo: choice("Responds to", "none", [
        ["none", "Nothing"],
        ["hover", "The pointer over it"],
        ["click", "A click or tap"],
      ]),
      input: text("Input name", "", 60),
      stateMachine: text("State machine", "", 60),
    },
    reducedMotion: "Shows the still picture, or the first frame.",
    weight: "heavy",
    preview: "image",
    listed: false,
  }),
];
