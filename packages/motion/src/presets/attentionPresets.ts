import { definePreset, through } from "./preset.js";

/**
 * Attention: brief movements that draw the eye. Use sparingly. They play on a custom
 * event by default (for example after "Add to cart"), so nothing moves unless something happened.
 */

const onEvent = { type: "event", name: "motion:attention" } as const;

export const attentionPresets = [
  definePreset({
    id: "pulse",
    name: "Pulse",
    description: "Swells and settles twice. Draws the eye to a new badge or a call to action.",
    category: "attention",
    preview: { sample: "button" },
    spec: {
      trigger: onEvent,
      duration: 500,
      repeat: { times: 1 },
      easing: "easeInOut",
      reducedMotion: "none",
      tracks: [through("scale", [1, 1.08, 1])],
    },
  }),
  definePreset({
    id: "shake",
    name: "Shake",
    description: "Shakes side to side, the way a wrong password does. For errors.",
    category: "attention",
    preview: { sample: "card" },
    spec: {
      trigger: onEvent,
      duration: 500,
      easing: "easeInOut",
      reducedMotion: "fade",
      tracks: [through("translateX", [0, -10, 9, -7, 5, -2, 0])],
    },
  }),
  definePreset({
    id: "wiggle",
    name: "Wiggle",
    description: "Rocks back and forth for a moment. A friendly nudge towards a button.",
    category: "attention",
    preview: { sample: "button" },
    spec: {
      trigger: onEvent,
      duration: 600,
      easing: "easeInOut",
      reducedMotion: "none",
      tracks: [through("rotate", [0, -6, 5, -4, 2, 0])],
    },
  }),
  definePreset({
    id: "bounce",
    name: "Bounce",
    description: "Hops up and lands with a little squash. Cheerful; good for icons.",
    category: "attention",
    preview: { sample: "button" },
    spec: {
      trigger: onEvent,
      duration: 700,
      easing: "easeOut",
      reducedMotion: "none",
      tracks: [through("translateY", [0, -18, 0, -6, 0]), through("scaleY", [1, 1.05, 0.95, 1, 1])],
    },
  }),
  definePreset({
    id: "flash",
    name: "Flash",
    description: 'Blinks twice without moving. The calmest way to say "look here".',
    category: "attention",
    preview: { sample: "card" },
    spec: {
      trigger: onEvent,
      duration: 800,
      easing: "easeInOut",
      reducedMotion: "fade",
      tracks: [through("opacity", [1, 0.3, 1, 0.3, 1])],
    },
  }),
];
