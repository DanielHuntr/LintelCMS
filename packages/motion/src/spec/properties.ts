/**
 * Every property an animation track can move, and how it reaches CSS.
 *
 * Only properties the browser can animate without laying the page out again are here:
 * opacity, transforms, filters, clip paths and colours. Width, height, margins and
 * positions are left out on purpose, because animating them makes every frame recalculate
 * the layout of the page around the element.
 *
 * Several properties share one CSS property (translateX and translateY both write
 * `translate`). The `group` says which; `src/keyframes/composeGroup.ts` builds the value.
 */

export type PropertyKind = "number" | "length" | "angle" | "colour" | "text";

export type PropertyGroup =
  | "opacity"
  | "translate"
  | "scale"
  | "rotate"
  | "transform"
  | "filter"
  | "clipPath"
  | "color"
  | "backgroundColor"
  | "borderColor";

export interface PropertyDefinition {
  group: PropertyGroup;
  kind: PropertyKind;
  /** The unit a bare number gets, e.g. 20 → "20px". Empty for unitless numbers. */
  unit: string;
  /** The value when nothing moves it, used to fill gaps when a group is composed. */
  restValue: number | string;
}

export const propertyCatalogue = {
  opacity: { group: "opacity", kind: "number", unit: "", restValue: 1 },
  translateX: { group: "translate", kind: "length", unit: "px", restValue: 0 },
  translateY: { group: "translate", kind: "length", unit: "px", restValue: 0 },
  translateZ: { group: "translate", kind: "length", unit: "px", restValue: 0 },
  scale: { group: "scale", kind: "number", unit: "", restValue: 1 },
  scaleX: { group: "scale", kind: "number", unit: "", restValue: 1 },
  scaleY: { group: "scale", kind: "number", unit: "", restValue: 1 },
  rotate: { group: "rotate", kind: "angle", unit: "deg", restValue: 0 },
  perspective: { group: "transform", kind: "length", unit: "px", restValue: 0 },
  rotateX: { group: "transform", kind: "angle", unit: "deg", restValue: 0 },
  rotateY: { group: "transform", kind: "angle", unit: "deg", restValue: 0 },
  skewX: { group: "transform", kind: "angle", unit: "deg", restValue: 0 },
  skewY: { group: "transform", kind: "angle", unit: "deg", restValue: 0 },
  blur: { group: "filter", kind: "length", unit: "px", restValue: 0 },
  brightness: { group: "filter", kind: "number", unit: "", restValue: 1 },
  contrast: { group: "filter", kind: "number", unit: "", restValue: 1 },
  saturate: { group: "filter", kind: "number", unit: "", restValue: 1 },
  grayscale: { group: "filter", kind: "number", unit: "", restValue: 0 },
  clipPath: { group: "clipPath", kind: "text", unit: "", restValue: "none" },
  color: { group: "color", kind: "colour", unit: "", restValue: "currentcolor" },
  backgroundColor: {
    group: "backgroundColor",
    kind: "colour",
    unit: "",
    restValue: "transparent",
  },
  borderColor: { group: "borderColor", kind: "colour", unit: "", restValue: "currentcolor" },
} as const satisfies Record<string, PropertyDefinition>;

export type CatalogueProperty = keyof typeof propertyCatalogue;

/** A track's property: one from the catalogue, or a CSS custom property such as `--glow`. */
export type AnimatableProperty = CatalogueProperty | `--${string}`;

export const catalogueProperties = Object.keys(propertyCatalogue) as CatalogueProperty[];

export function isCssVariable(property: string): property is `--${string}` {
  return property.startsWith("--");
}

export function isCatalogueProperty(property: string): property is CatalogueProperty {
  return Object.hasOwn(propertyCatalogue, property);
}

/** CSS variables are animated as text: the browser interpolates them if they are registered. */
const cssVariableDefinition: PropertyDefinition = {
  group: "opacity",
  kind: "text",
  unit: "",
  restValue: "",
};

export function describeProperty(property: AnimatableProperty): PropertyDefinition {
  return isCssVariable(property) ? cssVariableDefinition : propertyCatalogue[property];
}

export function isNumericKind(kind: PropertyKind): boolean {
  return kind === "number" || kind === "length" || kind === "angle";
}

const unitsByKind: Partial<Record<PropertyKind, readonly string[]>> = {
  number: [""],
  length: ["px", "%", "rem", "em", "vw", "vh"],
  angle: ["deg", "turn", "rad"],
};

/** Whether a numeric kind accepts a unit: lengths take px or %, angles deg or turn. */
export function isUnitAllowed(kind: PropertyKind, unit: string): boolean {
  return unitsByKind[kind]?.includes(unit) ?? false;
}

/**
 * Properties that change how something looks without moving it: opacity and colours.
 * These are the only ones kept when an animation's reduced-motion behaviour is "fade".
 */
export function isCalmProperty(property: AnimatableProperty): boolean {
  if (isCssVariable(property)) return false;
  const { kind, group } = propertyCatalogue[property];
  return group === "opacity" || kind === "colour";
}
