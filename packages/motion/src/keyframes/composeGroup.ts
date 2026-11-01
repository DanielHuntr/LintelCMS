import {
  catalogueProperties,
  describeProperty,
  isCssVariable,
  propertyCatalogue,
  type AnimatableProperty,
  type CatalogueProperty,
  type PropertyGroup,
} from "../spec/properties.js";
import { formatNumericValue, parseNumericValue } from "./values.js";

/**
 * Builds one CSS value from the tracks that share it: translateX 10 and translateY 20
 * become `translate: 10px 20px`. Only properties with a track are written, so a lone
 * rotateX track gives `transform: rotateX(…)` and leaves everything else to the stylesheet.
 */

/** The key a group writes: the camelCase name used in Web Animations keyframes. */
export function keyframeKeyOf(property: AnimatableProperty): string {
  return isCssVariable(property) ? property : propertyCatalogue[property].group;
}

/** The same property in CSS spelling, for element.style.setProperty. */
export function cssNameOf(keyframeKey: string): string {
  if (keyframeKey.startsWith("--")) return keyframeKey;
  return keyframeKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export type GroupValues = ReadonlyMap<AnimatableProperty, number | string>;

function numeric(values: GroupValues, property: CatalogueProperty) {
  const definition = propertyCatalogue[property];
  const value = values.get(property) ?? definition.restValue;
  return parseNumericValue(value, definition.unit) ?? { amount: 0, unit: definition.unit };
}

function text(values: GroupValues, property: CatalogueProperty): string {
  return formatNumericValue(numeric(values, property));
}

function composeTranslate(values: GroupValues): string {
  const parts = [text(values, "translateX"), text(values, "translateY")];
  if (values.has("translateZ")) parts.push(text(values, "translateZ"));
  return parts.join(" ");
}

function composeScale(values: GroupValues): string {
  const uniform = numeric(values, "scale").amount;
  const across = uniform * numeric(values, "scaleX").amount;
  const down = uniform * numeric(values, "scaleY").amount;
  return across === down
    ? formatNumericValue({ amount: across, unit: "" })
    : `${formatNumericValue({ amount: across, unit: "" })} ${formatNumericValue({ amount: down, unit: "" })}`;
}

/** Function-list properties (transform, filter) in a fixed order, so keyframes always match. */
function composeFunctions(
  values: GroupValues,
  group: PropertyGroup,
  rename: (name: string) => string,
) {
  const parts = catalogueProperties
    .filter((property) => propertyCatalogue[property].group === group && values.has(property))
    .map((property) => `${rename(property)}(${text(values, property)})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

/** Writes the CSS value of `keyframeKey` from the values of the tracks in its group. */
export function composeGroupValue(keyframeKey: string, values: GroupValues): string {
  switch (keyframeKey) {
    case "translate":
      return composeTranslate(values);
    case "scale":
      return composeScale(values);
    case "transform":
      return composeFunctions(values, "transform", (name) => name);
    case "filter":
      return composeFunctions(values, "filter", (name) => name);
    default: {
      const [property, value] = [...values][0] ?? [];
      if (property === undefined || value === undefined) return "";
      const definition = describeProperty(property);
      if (typeof value === "string") return value;
      return formatNumericValue({ amount: value, unit: definition.unit });
    }
  }
}
