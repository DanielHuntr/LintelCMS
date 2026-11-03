import type { MotionSpec } from "@lintel/motion";
import type { EffectDefinition, EffectRegistry, ElementKind } from "@lintel/motion/effects";
import type { MotionPreset } from "@lintel/motion/presets";

/**
 * Everything that can make an element move, presets and effects together, sorted by when it
 * moves. People choose "when" first (it appears, on hover, on click, while scrolling, always),
 * then pick from a few plain groups, rather than having to know whether something is an
 * "animation" or an "effect".
 */

export const motionMoments = ["appears", "hover", "click", "scroll", "always"] as const;
export type MotionMoment = (typeof motionMoments)[number];

/** The groups inside each moment, in the order they are shown. */
export type MotionGroup =
  | "blocks"
  | "pageOpens"
  | "words"
  | "drawings"
  | "pointer"
  | "followsPointer"
  | "pointerEffects"
  | "depth"
  | "buttons"
  | "attention"
  | "drag"
  | "followsScroll"
  | "scrollEffects"
  | "backgrounds"
  | "rows"
  | "loading";

export type MotionChoice =
  | {
      kind: "preset";
      id: string;
      name: string;
      description: string;
      moment: MotionMoment;
      group: MotionGroup;
      preset: MotionPreset;
    }
  | {
      kind: "effect";
      id: string;
      name: string;
      description: string;
      moment: MotionMoment;
      group: MotionGroup;
      definition: EffectDefinition;
    };

const groupOrder: readonly MotionGroup[] = [
  "blocks",
  "pageOpens",
  "words",
  "drawings",
  "pointer",
  "followsPointer",
  "pointerEffects",
  "depth",
  "buttons",
  "attention",
  "drag",
  "followsScroll",
  "scrollEffects",
  "backgrounds",
  "rows",
  "loading",
];

/**
 * When a preset plays, from its trigger. Page exits belong to the site, not one element.
 * Something that starts with the page and never stops (a pulse, a spinner) moves "always".
 */
export function momentOfSpec(spec: MotionSpec): MotionMoment | null {
  switch (spec.trigger.type) {
    case "load":
    case "inView":
      return spec.repeat.times === "forever" ? "always" : "appears";
    case "hover":
    case "pointer":
      return "hover";
    case "click":
    case "focus":
    case "event":
      return "click";
    case "scroll":
      return "scroll";
    case "pageExit":
      return null;
  }
}

function presetGroup(preset: MotionPreset, moment: MotionMoment): MotionGroup {
  if (moment === "appears") return preset.spec.trigger.type === "load" ? "pageOpens" : "blocks";
  if (moment === "hover")
    return preset.spec.trigger.type === "pointer" ? "followsPointer" : "pointer";
  if (moment === "click") return preset.category === "attention" ? "attention" : "buttons";
  return "followsScroll";
}

/** Effect categories, by moment and group. Cursors and page transitions are site-wide. */
const effectPlaces: Partial<Record<EffectDefinition["category"], [MotionMoment, MotionGroup]>> = {
  text: ["appears", "words"],
  svg: ["appears", "drawings"],
  hover: ["hover", "pointerEffects"],
  depth: ["hover", "depth"],
  physics: ["click", "drag"],
  scroll: ["scroll", "scrollEffects"],
  canvas: ["always", "backgrounds"],
  marquee: ["always", "rows"],
  loaders: ["always", "loading"],
};

/**
 * Every choice for an element of this kind: all presets, and the effects that suit it,
 * grouped and in a fixed order.
 */
export function listMotionChoices(
  presets: readonly MotionPreset[],
  registry: EffectRegistry,
  elementKind: ElementKind,
): MotionChoice[] {
  const choices: MotionChoice[] = [];
  for (const preset of presets) {
    const moment = momentOfSpec(preset.spec);
    if (!moment) continue;
    choices.push({
      kind: "preset",
      id: preset.id,
      name: preset.name,
      description: preset.description,
      moment,
      group: presetGroup(preset, moment),
      preset,
    });
  }
  for (const definition of registry.suiting(elementKind)) {
    const place = effectPlace(definition);
    if (!place) continue;
    choices.push({
      kind: "effect",
      id: definition.id,
      name: definition.name,
      description: definition.description,
      moment: place[0],
      group: place[1],
      definition,
    });
  }
  return choices.sort(
    (first, second) =>
      motionMoments.indexOf(first.moment) - motionMoments.indexOf(second.moment) ||
      groupOrder.indexOf(first.group) - groupOrder.indexOf(second.group),
  );
}

/** Choices whose name, description or keywords contain every word typed, in any moment. */
export function searchMotionChoices(
  choices: readonly MotionChoice[],
  search: string,
): MotionChoice[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...choices];
  return choices.filter((choice) => {
    const keywords = choice.kind === "effect" ? (choice.definition.keywords ?? []) : [];
    const text = [choice.name, choice.description, ...keywords].join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/**
 * Where an effect is offered. Text effects that play while the pointer is over the words
 * (roll up, scramble on hover, the wave) are offered on hover; the rest of the text effects
 * when the words appear. Canvas effects are backgrounds that always move, except picture
 * effects marked to play on hover or as the picture appears. 3D effects are offered on hover,
 * apart from those that follow the scroll (depth on scroll, an exploded view, cards on scroll)
 * and the drifting arc carousel.
 */
function effectPlace(definition: EffectDefinition): [MotionMoment, MotionGroup] | undefined {
  const trigger = definition.kind === "behaviour" ? definition.fixed?.trigger : undefined;
  if (definition.category === "text" && (trigger === "hover" || trigger === "pointer")) {
    return ["hover", "words"];
  }
  // Picture effects: the ones that play on hover, and the reveals as a picture appears.
  if (definition.category === "canvas" && trigger === "hover") return ["hover", "pointerEffects"];
  if (definition.category === "canvas" && trigger === "appear") return ["appears", "blocks"];
  // 3D layouts that move with the page are offered with scrolling; the arc carousel drifts.
  if (definition.category === "depth" && definition.kind === "behaviour") {
    if (definition.module === "scroll" || definition.fixed?.advance === "scroll") {
      return ["scroll", "depth"];
    }
    if (definition.behaviour === "arcCarousel") return ["always", "depth"];
  }
  return effectPlaces[definition.category];
}

/** The moment an effect on an element plays in, for the list ("Tilts · On hover"). */
export function momentOfEffect(definition: EffectDefinition): MotionMoment {
  return effectPlace(definition)?.[0] ?? "always";
}
