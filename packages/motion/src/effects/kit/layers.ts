import type { EffectContext } from "../effect-types.js";
import { largestDrawing } from "./shader-renderer.js";
import { setStyles } from "./styles.js";

/**
 * The layers shader effects draw on. A backdrop sits behind an element's content but in
 * front of its own background; a picture layer lies exactly over a picture. Both keep
 * their canvas at a sensible number of pixels: never more than twice the screen's, once on
 * phones and slow devices, and less again where WebGL has no graphics card to run on.
 */

/** How many canvas pixels to draw per CSS pixel. */
export function drawingRatio(
  context: EffectContext,
  { resolution = 1, software = false }: { resolution?: number; software?: boolean } = {},
): number {
  const screen = Math.min(window.devicePixelRatio || 1, 2);
  return (context.lowPower ? 1 : screen) * resolution * (software ? 0.5 : 1);
}

/** Sets a canvas's pixel size (only when it changes: that wipes it), within the limit. */
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  ratio: number,
): boolean {
  const scale = Math.min(ratio, largestDrawing / Math.max(width, height, 1));
  const pixelWidth = Math.max(1, Math.round(width * scale));
  const pixelHeight = Math.max(1, Math.round(height * scale));
  if (canvas.width === pixelWidth && canvas.height === pixelHeight) return false;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  return true;
}

function layer(tagName: "canvas" | "div", styles: Partial<CSSStyleDeclaration>) {
  const made = document.createElement(tagName);
  made.setAttribute("aria-hidden", "true");
  Object.assign(made.style, { position: "absolute", pointerEvents: "none" }, styles);
  return made;
}

export interface Backdrop {
  canvas: HTMLCanvasElement;
  /** A quiet veil between the drawing and the words, for contrast; see `maths/readable`. */
  scrim: HTMLDivElement;
  remove(): void;
}

/**
 * A canvas behind the element's content and in front of its background. The element is
 * isolated (its own stacking context), so the canvas can sit underneath children that
 * aren't positioned, without slipping behind the section's parent.
 */
export function addBackdrop(element: HTMLElement): Backdrop {
  const style = getComputedStyle(element);
  const restore = setStyles(element, {
    isolation: "isolate",
    ...(style.position === "static" ? { position: "relative" } : {}),
  });
  const behind = { inset: "0", zIndex: "-1", borderRadius: "inherit" };
  const canvas = layer("canvas", { ...behind, width: "100%", height: "100%" });
  const scrim = layer("div", { ...behind, display: "none" });
  element.prepend(canvas, scrim);
  return {
    canvas: canvas as HTMLCanvasElement,
    scrim: scrim as HTMLDivElement,
    remove: () => {
      canvas.remove();
      scrim.remove();
      restore();
    },
  };
}

export interface PictureLayer {
  image: HTMLImageElement;
  canvas: HTMLCanvasElement;
  /** Puts the canvas over the picture again (after a resize) and sizes it; true if resized. */
  place(ratio: number): boolean;
  remove(): void;
}

/** The picture an effect works on: the element itself, or the first picture inside it. */
export function findPicture(element: HTMLElement): HTMLImageElement | null {
  return element instanceof HTMLImageElement ? element : element.querySelector("img");
}

/** A canvas lying exactly over a picture, with the picture's rounded corners. */
export function addPictureLayer(image: HTMLImageElement): PictureLayer {
  const holder = image.parentElement ?? document.body;
  const restore =
    getComputedStyle(holder).position === "static"
      ? setStyles(holder, { position: "relative" })
      : () => undefined;
  const canvas = layer("canvas", { zIndex: "1" }) as HTMLCanvasElement;
  image.after(canvas);
  return {
    image,
    canvas,
    place(ratio) {
      const style = getComputedStyle(image);
      Object.assign(canvas.style, {
        left: `${image.offsetLeft}px`,
        top: `${image.offsetTop}px`,
        width: `${image.offsetWidth}px`,
        height: `${image.offsetHeight}px`,
        borderRadius: style.borderRadius,
      });
      return sizeCanvas(canvas, image.offsetWidth, image.offsetHeight, ratio);
    },
    remove: () => {
      canvas.remove();
      restore();
    },
  };
}
