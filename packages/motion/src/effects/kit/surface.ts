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
  const measure = () => {
    surface.width = element.clientWidth;
    surface.height = element.clientHeight;
    canvas.width = Math.max(1, Math.round(surface.width * surface.ratio));
    canvas.height = Math.max(1, Math.round(surface.height * surface.ratio));
    onResize();
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : undefined;
  observer?.observe(element);
  measure();
  return surface;
}
