import type { EffectContext } from "../effect-types.js";
import { addOverlay } from "./styles.js";

/**
 * A canvas laid over (or under) an element, kept the element's size at a sensible pixel
 * ratio: at most 2, and 1 on low-power devices, which is most of the saving on phones.
 */
export interface Surface {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  ratio: number;
  remove(): void;
}

export function createSurface(
  element: HTMLElement,
  context: EffectContext,
  {
    under = true,
    onResize = () => {},
    resolution = 1,
  }: {
    under?: boolean;
    onResize?: () => void;
    /** Fewer pixels than the screen's, for soft images like gradients: 0.5 is half across. */
    resolution?: number;
  } = {},
): Surface {
  const { overlay, remove } = addOverlay(element, "canvas", under);
  const canvas = overlay as HTMLCanvasElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const surface: Surface = {
    canvas,
    width: 0,
    height: 0,
    ratio: (context.lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2)) * resolution,
    remove: () => {
      observer?.disconnect();
      remove();
    },
  };
  // Setting a canvas's size wipes what's drawn on it, so it's only set when it changes: the
  // ResizeObserver's first report repeats the size measured here, and used to erase the
  // first frame (a still frame, for people who ask for less motion, never came back).
  const measure = () => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    const pixelWidth = Math.max(1, Math.round(width * surface.ratio));
    const pixelHeight = Math.max(1, Math.round(height * surface.ratio));
    surface.width = width;
    surface.height = height;
    if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    onResize();
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : undefined;
  observer?.observe(element);
  measure();
  return surface;
}
