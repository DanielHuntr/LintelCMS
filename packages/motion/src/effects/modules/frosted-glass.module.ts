import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber } from "../kit/params.js";
import { createSurface } from "../kit/surface.js";
import { loaded } from "../kit/webgl.js";

/**
 * Frosted glass over a picture (or the element) that the pointer or a finger wipes clear,
 * slowly misting over again. The frost is decoration only: keyboard focus inside clears it
 * all, and screen readers read what is underneath as normal.
 */
const frostedGlass: EffectBehaviour = (element, params, context) => {
  let repaint = () => {};
  const surface = createSurface(element, context, { under: false, onResize: () => repaint() });
  const drawing = surface.canvas.getContext("2d");
  if (!drawing) return surface.remove;
  surface.canvas.style.pointerEvents = "none";
  const tint = readColour(params, "tint", "rgb(255 255 255 / 0.55)");
  const blur = readNumber(params, "blur", 14);
  const brush = readNumber(params, "brush", 60);
  const regrow = context.reduced ? 0 : readNumber(params, "regrow", 0.6);
  const frost = document.createElement("canvas");
  const image = element.querySelector("img");
  const paintFrost = () => {
    frost.width = surface.canvas.width;
    frost.height = surface.canvas.height;
    const frostDrawing = frost.getContext("2d");
    if (!frostDrawing) return;
    if (image?.complete && image.naturalWidth && "filter" in frostDrawing) {
      frostDrawing.filter = `blur(${blur * surface.ratio}px)`;
      frostDrawing.drawImage(image, 0, 0, frost.width, frost.height);
      frostDrawing.filter = "none";
    }
    frostDrawing.fillStyle = tint;
    frostDrawing.fillRect(0, 0, frost.width, frost.height);
    drawing.globalCompositeOperation = "source-over";
    drawing.drawImage(frost, 0, 0);
  };
  repaint = paintFrost;
  paintFrost();
  if (image) void loaded(image).then(paintFrost, () => undefined);
  let clearAmount = 0;
  const loop = createFrameLoop(element, () => {
    if (regrow <= 0 || clearAmount <= 0) return false;
    drawing.globalCompositeOperation = "source-over";
    drawing.globalAlpha = 0.012 * regrow;
    drawing.drawImage(frost, 0, 0);
    drawing.globalAlpha = 1;
    clearAmount -= 0.012 * regrow;
    return clearAmount > 0;
  });
  const wipe = (x: number, y: number) => {
    const radius = brush * surface.ratio;
    const gradient = drawing.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgb(0 0 0 / 1)");
    gradient.addColorStop(1, "rgb(0 0 0 / 0)");
    drawing.globalCompositeOperation = "destination-out";
    drawing.fillStyle = gradient;
    drawing.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    clearAmount = 1;
    loop.wake();
  };
  const restoreTouch = element.style.touchAction;
  element.style.touchAction = "pan-y";
  return combine(
    listen(element, {
      pointermove: (event: PointerEvent) => {
        const box = element.getBoundingClientRect();
        wipe((event.clientX - box.left) * surface.ratio, (event.clientY - box.top) * surface.ratio);
      },
      focusin: () => (surface.canvas.style.opacity = "0"),
      focusout: () => (surface.canvas.style.opacity = "1"),
    }),
    listen(window, { resize: paintFrost }),
    () => loop.destroy(),
    () => (element.style.touchAction = restoreTouch),
    surface.remove,
  );
};

export const behaviours = { frostedGlass };
export default { behaviours } satisfies EffectModule;
