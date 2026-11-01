import { isSafeImageAddress } from "../components/component-props.js";
import { isSafeStyleValue, type StylePropertyName } from "./style-properties.js";

/**
 * Checks for the values that are more than one plain word: picture layers, shapes, filters
 * and skews. Most properties only need `isSafeStyleValue`; these few also have to be the
 * right kind of value, and two of them (background and mask pictures) are the only places a
 * stored style may point at a file, so the address is checked the way an image's is.
 */

/** Picture layers can hold a few addresses and gradients, so they may be longer. */
export const maxLayeredValueLength = 2000;

const imageLayerProperties = new Set<StylePropertyName>(["backgroundImage", "maskImage"]);

const shapeFunctions = ["circle", "ellipse", "inset", "polygon"];
const filterFunctions = [
  "blur",
  "brightness",
  "contrast",
  "drop-shadow",
  "grayscale",
  "hue-rotate",
  "invert",
  "opacity",
  "saturate",
  "sepia",
];
const transformFunctions = [
  "skew",
  "skewX",
  "skewY",
  "perspective",
  "rotateX",
  "rotateY",
  "matrix",
];
const gradientPattern = /^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/s;

/** Whether `value` is something `property` may be set to. */
export function isSafeValueFor(property: StylePropertyName, value: string): boolean {
  if (imageLayerProperties.has(property)) return isSafeImageLayers(value);
  if (property === "clipPath") return isFunctionList(value, shapeFunctions, 1000, true);
  if (property === "filter" || property === "backdropFilter") {
    return isFunctionList(value, filterFunctions, 400, false);
  }
  if (property === "transform") return isFunctionList(value, transformFunctions, 200, false);
  return isSafeStyleValue(value);
}

/**
 * `url("/media/photo.jpg"), linear-gradient(...)`: each layer a picture address, a gradient
 * or `none`. Addresses may only be web addresses or paths on the site, with no quotes,
 * brackets or spaces, so nothing can break out of the `url()`.
 */
export function isSafeImageLayers(value: string): boolean {
  if (value.trim() === "" || value.length > maxLayeredValueLength) return false;
  const layers = splitTopLevel(value);
  return layers.length > 0 && layers.length <= 8 && layers.every(isSafeImageLayer);
}

function isSafeImageLayer(layer: string): boolean {
  if (layer === "none") return true;
  const address = readUrlAddress(layer);
  if (address !== null) return address !== "" && isSafeImageAddress(address);
  const gradient = gradientPattern.exec(layer);
  return gradient !== null && isSafeStyleValue((gradient[3] ?? "").slice(0, 400));
}

/** The address inside `url("...")`, or null when the layer isn't one. */
export function readUrlAddress(layer: string): string | null {
  const match = /^url\(\s*(["']?)([^"'()\s\\;{}<>]*)\1\s*\)$/.exec(layer.trim());
  return match ? (match[2] ?? "") : null;
}

/** The way a picture address is written in a stored style. */
export function urlLayer(address: string): string {
  return `url("${address}")`;
}

/** `none`, or one or more of the allowed functions, each with plain arguments. */
function isFunctionList(
  value: string,
  allowed: readonly string[],
  maxLength: number,
  onlyOne: boolean,
): boolean {
  const trimmed = value.trim();
  if (trimmed === "none") return true;
  if (trimmed.length === 0 || trimmed.length > maxLength) return false;
  if (/[;{}<>\\@]|\/\*|\*\/|url\s*\(|expression\s*\(|javascript:/i.test(trimmed)) return false;
  const calls = [...trimmed.matchAll(/([a-zA-Z-]+)\(((?:[^()]|\([^()]*\))*)\)/g)];
  const rebuilt = calls.map((call) => call[0]).join(" ");
  if (calls.length === 0 || rebuilt.replace(/\s+/g, "") !== trimmed.replace(/\s+/g, "")) {
    return false;
  }
  if (onlyOne && calls.length > 1) return false;
  return calls.every(
    (call) => allowed.includes(call[1] ?? "") && /^[\w\s#%().,\-+*/]*$/.test(call[2] ?? ""),
  );
}

/**
 * Splits a value at the commas that separate its layers, leaving commas inside brackets
 * and quotes alone: `url(a), linear-gradient(red, blue)` gives two parts.
 */
export function splitTopLevel(value: string, separator = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const character of value) {
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    } else if (character === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}
