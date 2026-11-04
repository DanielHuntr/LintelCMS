import type { Rgb } from "../maths/readable.js";

/**
 * Any CSS colour as three numbers from 0 to 1, read the way the browser reads it, so the
 * site's own colours (`var(--lintel-color-brand)`, an oklch() from the theme) reach a shader.
 */

let probe: CanvasRenderingContext2D | null | undefined;
const known = new Map<string, Rgb | undefined>();

function parse(css: string): Rgb | undefined {
  if (known.has(css)) return known.get(css);
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  let result: Rgb | undefined;
  if (probe) {
    probe.canvas.width = probe.canvas.height = 1;
    // An unreadable colour leaves the fill style as it was: start from a marker to tell.
    probe.fillStyle = "#010203";
    probe.fillStyle = css;
    if (probe.fillStyle !== "#010203" || /^#010203$/i.test(css.trim())) {
      probe.clearRect(0, 0, 1, 1);
      probe.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = probe.getImageData(0, 0, 1, 1).data;
      if ((alpha ?? 0) > 0) result = [(red ?? 0) / 255, (green ?? 0) / 255, (blue ?? 0) / 255];
    }
  }
  known.set(css, result);
  return result;
}

/**
 * A colour from an effect's settings: a hex colour, or a site or theme colour written as
 * `var(--name)` (with an optional fallback), looked up on the element.
 */
export function resolveColour(element: Element, value: string, fallback: string): Rgb {
  const variable = /^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/.exec(value.trim());
  const css = variable
    ? getComputedStyle(element).getPropertyValue(variable[1]!).trim() || variable[2] || fallback
    : value;
  return parse(css) ?? parse(fallback) ?? [0.5, 0.5, 0.5];
}

/** The colours of the words inside an element: its own, then each piece of text's. */
export function wordColours(element: Element, limit = 40): Rgb[] {
  const colours: Rgb[] = [];
  const seen = new Set<string>();
  const add = (holder: Element) => {
    const css = getComputedStyle(holder).color;
    if (seen.has(css)) return;
    seen.add(css);
    const rgb = parse(css);
    if (rgb) colours.push(rgb);
  };
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && seen.size < limit; node = walker.nextNode()) {
    if (node.textContent?.trim() && node.parentElement) add(node.parentElement);
  }
  return colours;
}

/** The element's own background colour, or the nearest one behind it; white if none is set. */
export function backgroundBehind(element: HTMLElement): Rgb {
  for (let at: HTMLElement | null = element; at; at = at.parentElement) {
    const css = getComputedStyle(at).backgroundColor;
    if (!/^(transparent|rgba\(.*,\s*0\))$/.test(css)) return resolveColour(at, css, "#ffffff");
  }
  return [1, 1, 1];
}
