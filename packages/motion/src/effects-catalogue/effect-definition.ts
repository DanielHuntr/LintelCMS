import { motionSpecSchema, type MotionSpec, type MotionSpecInput } from "../spec/motion.schema.js";
import type { PreviewSample } from "../presets/preset.js";
import type {
  EffectBehaviour,
  EffectModuleName,
  EffectParameterValue,
} from "../effects/effect-types.js";

/**
 * An effect: one entry in the builder's Effects gallery. It says what it is called, which
 * elements it suits, the settings people can change (in plain words) and how it runs:
 *
 * - "behaviour": a function in one of the lazily loaded modules (or registered by code);
 * - "animation": an ordinary animation spec, which becomes the element's animation, so it
 *   composes with presets and opens on the timeline like any other;
 * - "style": CSS only, written into the page (a shared-element transition name, say).
 *
 * `defineEffect` checks it and keeps the settings' types, so code that registers its own
 * effects gets typed props. See the docs page "Effects API".
 */

export const effectCategories = [
  "text",
  "scroll",
  "hover",
  "canvas",
  "depth",
  "transitions",
  "physics",
  "cursor",
  "marquee",
  "loaders",
  "svg",
] as const;
export type EffectCategory = (typeof effectCategories)[number];

/** The kinds of element the gallery's "Suits this element" filter knows. */
export const elementKinds = ["any", "text", "image", "container", "button", "list", "svg"] as const;
export type ElementKind = (typeof elementKinds)[number];

interface ParameterBase {
  /** Plain words for Simple mode: "How strong the pull is". */
  label: string;
}

export type EffectParameter =
  | (ParameterBase & {
      kind: "number";
      default: number;
      min: number;
      max: number;
      step?: number;
      unit?: string;
    })
  | (ParameterBase & {
      kind: "choice";
      default: string;
      choices: ReadonlyArray<{ value: string; label: string }>;
    })
  | (ParameterBase & { kind: "colour"; default: string })
  | (ParameterBase & { kind: "switch"; default: boolean })
  | (ParameterBase & { kind: "text"; default: string; maxLength?: number });

export type EffectParameters = Readonly<Record<string, EffectParameter>>;

/** The values a set of parameters gives: `{ strength: number, glare: boolean }`. */
export type EffectProps<Parameters extends EffectParameters> = {
  [Name in keyof Parameters]: Parameters[Name]["default"] extends number
    ? number
    : Parameters[Name]["default"] extends boolean
      ? boolean
      : string;
};

/** How heavy an effect is for the page, beyond its module's download. */
export type EffectWeight = "light" | "medium" | "heavy";

interface DefinitionBase<Parameters extends EffectParameters> {
  /** Lowercase words and dashes, unique across the gallery: "magnetic-pull". */
  id: string;
  name: string;
  /** One or two plain sentences: what it does and where it looks good. */
  description: string;
  category: EffectCategory;
  suits: readonly ElementKind[];
  params: Parameters;
  /** Extra words people might search for. */
  keywords?: readonly string[];
  /**
   * False for effects set with a field of their own rather than from the gallery (the word
   * on the cursor, the picture shown on hover): the gallery and the element's list leave
   * them out.
   */
  listed?: boolean;
  /** What people who ask for less motion get instead, in plain words. */
  reducedMotion: string;
  weight?: EffectWeight;
  /** The stand-in element the gallery card shows. */
  preview: PreviewSample;
  /**
   * CSS written into the page for this effect, so it looks right before (and without)
   * scripts: a fallback colour, a stacked layout. `selector` matches the element.
   */
  staticCss?: (selector: string, props: EffectProps<Parameters>) => string;
  /**
   * Attributes the element carries on the published page, for scripts that look for it
   * without reading every element's styles (see carriedElementsScript).
   */
  elementAttributes?: (props: EffectProps<Parameters>) => Readonly<Record<string, string>>;
}

export type BehaviourEffect<Parameters extends EffectParameters = EffectParameters> =
  DefinitionBase<Parameters> & {
    kind: "behaviour";
    module: EffectModuleName | "custom";
    behaviour: string;
    /** Values always passed to the behaviour, on top of the editable ones. */
    fixed?: Readonly<Record<string, EffectParameterValue>>;
    /** For code-registered effects: the function itself (see registerEffectBehaviour). */
    run?: EffectBehaviour;
  };

export type AnimationEffect<Parameters extends EffectParameters = EffectParameters> =
  DefinitionBase<Parameters> & {
    kind: "animation";
    animation: (props: EffectProps<Parameters>) => MotionSpecInput;
  };

export type StyleEffect<Parameters extends EffectParameters = EffectParameters> =
  DefinitionBase<Parameters> & {
    kind: "style";
    staticCss: (selector: string, props: EffectProps<Parameters>) => string;
  };

export type EffectDefinition<Parameters extends EffectParameters = EffectParameters> =
  BehaviourEffect<Parameters> | AnimationEffect<Parameters> | StyleEffect<Parameters>;

export class InvalidEffectError extends Error {
  constructor(id: string, reason: string) {
    super(`The effect “${id}” can't be used: ${reason}`);
    this.name = "InvalidEffectError";
  }
}

const idPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A colour setting's value: a hex colour, one of the site's or theme's colours by name
 * (`var(--lintel-color-brand)`), which follows the site's styles, or `currentColor`, the
 * colour of the element's words.
 */
export const effectColourPattern = /^(#[0-9a-f]{6}|var\(--[a-z0-9-]{1,60}\)|currentColor)$/i;

/** The settings' starting values. */
export function defaultProps<Parameters extends EffectParameters>(
  params: Parameters,
): EffectProps<Parameters> {
  return Object.fromEntries(
    Object.entries(params).map(([name, parameter]) => [name, parameter.default]),
  ) as EffectProps<Parameters>;
}

/** Checks an effect and keeps its settings' types. Throws InvalidEffectError if it's wrong. */
export function defineEffect<const Parameters extends EffectParameters>(
  definition: EffectDefinition<Parameters>,
): EffectDefinition<Parameters> {
  if (!idPattern.test(definition.id) || definition.id.length > 80) {
    throw new InvalidEffectError(
      definition.id,
      "its id should be lowercase words joined by dashes",
    );
  }
  if (definition.suits.length === 0) {
    throw new InvalidEffectError(definition.id, "it should suit at least one kind of element");
  }
  for (const [name, parameter] of Object.entries(definition.params)) {
    if (
      parameter.kind === "number" &&
      (parameter.default < parameter.min || parameter.default > parameter.max)
    ) {
      throw new InvalidEffectError(
        definition.id,
        `the starting value of “${name}” is outside its range`,
      );
    }
    if (
      parameter.kind === "choice" &&
      !parameter.choices.some((choice) => choice.value === parameter.default)
    ) {
      throw new InvalidEffectError(
        definition.id,
        `the starting value of “${name}” isn't one of its choices`,
      );
    }
  }
  if (definition.kind === "animation") {
    const checked = motionSpecSchema.safeParse(
      definition.animation(defaultProps(definition.params)),
    );
    if (!checked.success) {
      throw new InvalidEffectError(
        definition.id,
        checked.error.issues[0]?.message ?? "its animation is invalid",
      );
    }
  }
  return definition;
}

/** Its animation, checked, for "animation" effects. */
export function effectAnimation(
  definition: AnimationEffect,
  props: Readonly<Record<string, EffectParameterValue>>,
): MotionSpec {
  return motionSpecSchema.parse(definition.animation(cleanProps(definition, props) as never));
}

/**
 * Stored settings made safe: unknown names dropped, missing ones defaulted, numbers kept
 * in range, choices kept to their list, text and colours kept short and harmless.
 */
export function cleanProps(
  definition: EffectDefinition,
  props: Readonly<Record<string, unknown>> = {},
): Record<string, EffectParameterValue> {
  return Object.fromEntries(
    Object.entries(definition.params).map(([name, parameter]) => {
      const value = props[name];
      switch (parameter.kind) {
        case "number":
          return [
            name,
            typeof value === "number" && Number.isFinite(value)
              ? Math.min(parameter.max, Math.max(parameter.min, value))
              : parameter.default,
          ];
        case "switch":
          return [name, typeof value === "boolean" ? value : parameter.default];
        case "choice":
          return [
            name,
            parameter.choices.some((choice) => choice.value === value)
              ? (value as string)
              : parameter.default,
          ];
        case "colour":
          return [
            name,
            typeof value === "string" && effectColourPattern.test(value)
              ? value
              : parameter.default,
          ];
        case "text":
          return [
            name,
            typeof value === "string"
              ? value.replace(/[<>{}]/g, "").slice(0, parameter.maxLength ?? 200)
              : parameter.default,
          ];
      }
      return [name, value as EffectParameterValue];
    }),
  );
}
