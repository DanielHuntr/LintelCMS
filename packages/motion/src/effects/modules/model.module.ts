import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readText } from "../kit/params.js";
import { onScrollProgress } from "../kit/scroll-progress.js";
import { setStyles } from "../kit/styles.js";
import { pointerWithin, progressThroughScreen } from "../kit/pointer.js";
import { modelPixelRatio, scrollTurn } from "../model/model-file.js";
import type { ModelScene } from "../model/model-scene.js";
import { approach, clamp } from "../maths/smoothing.js";
import { VelocityTracker } from "../maths/velocity.js";

/**
 * The 3D model element. The page shows the model's poster (or a placeholder) first; this
 * small module then imports three.js and the model only when the element nears the screen,
 * on a device that can draw WebGL, and fades the model in over the poster. People who ask
 * for less motion keep the poster (a model without one stands still). Drawing stops while
 * the model is off screen or the tab is hidden, and phones, data savers and a low battery
 * get fewer pixels and fewer frames.
 */

type ModelMotion = "still" | "spin" | "pointer" | "scroll" | "drag";
const motions: readonly ModelMotion[] = ["still", "spin", "pointer", "scroll", "drag"];

/** Radians a second for "Spin slowly". */
const SPIN_SPEED = 0.35;

interface BatteryState {
  level: number;
  charging: boolean;
}

async function batteryIsLow(): Promise<boolean> {
  const navigatorWithBattery = navigator as Navigator & {
    getBattery?: () => Promise<BatteryState>;
  };
  try {
    const battery = await navigatorWithBattery.getBattery?.();
    return battery !== undefined && !battery.charging && battery.level < 0.2;
  } catch {
    return false;
  }
}

const modelViewer: EffectBehaviour = (element, params, context) => {
  const src = readText(params, "src", "");
  if (!src) return;
  const poster = element.querySelector<HTMLElement>(".lintel-model__poster");
  if (context.reduced && poster) return;
  // What shows until the model is drawn: its poster, or the element's quiet placeholder.
  const standIn = poster ?? element.querySelector<HTMLElement>(".lintel-model__placeholder");
  const chosen = readText(params, "motion", "spin") as ModelMotion;
  const motion: ModelMotion = !motions.includes(chosen)
    ? "spin"
    : context.reduced && chosen !== "drag"
      ? "still"
      : chosen;

  const canvas = document.createElement("canvas");
  canvas.className = "lintel-model__canvas";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
    opacity: "0",
    transition: "opacity 500ms ease-out",
  });
  const restorePosition =
    getComputedStyle(element).position === "static"
      ? setStyles(element, { position: "relative" })
      : undefined;
  element.append(canvas);

  let scene: ModelScene | undefined;
  let stopped = false;
  let turn = 0;
  let tilt = 0;
  const goal = { turn: 0, tilt: 0 };
  let velocity = 0;
  let dragging = false;
  let lowPower = context.lowPower;
  let sinceDrawn = 0;

  const loop = createFrameLoop(element, (elapsed) => {
    if (!scene) return false;
    let moving = false;
    if (motion === "spin") {
      turn += (SPIN_SPEED * elapsed) / 1000;
      moving = true;
    } else if (motion === "drag" && !dragging && velocity !== 0) {
      goal.turn += (velocity * elapsed) / 1000;
      velocity = Math.abs(velocity) < 0.02 ? 0 : velocity * Math.pow(0.92, elapsed / 16);
      moving = velocity !== 0;
    }
    if (motion !== "spin") {
      turn = approach(turn, goal.turn, dragging ? 0.5 : 0.88, elapsed);
      tilt = approach(tilt, goal.tilt, 0.88, elapsed);
      moving ||= turn !== goal.turn || tilt !== goal.tilt || dragging;
    }
    // Phones and low batteries draw at most 30 frames a second.
    sinceDrawn += elapsed;
    if (!lowPower || sinceDrawn >= 30 || !moving) {
      sinceDrawn = 0;
      scene.draw(turn, tilt);
    }
    return moving;
  });

  const resize = () => {
    scene?.resize(element.clientWidth, element.clientHeight);
    if (scene) scene.draw(turn, tilt);
  };
  const resizeObserver =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : undefined;

  void (async () => {
    lowPower ||= await batteryIsLow();
    try {
      const { createModelScene } = await import("../model/model-scene.js");
      const created = await createModelScene(canvas, {
        src,
        light: readText(params, "light", "studio"),
        background: readText(params, "background", "transparent"),
        pixelRatio: modelPixelRatio(window.devicePixelRatio, lowPower),
        lowPower,
      });
      if (stopped) return created.destroy();
      scene = created;
      if (motion === "scroll") turn = goal.turn = scrollTurn(progressThroughScreen(element));
      resizeObserver?.observe(element);
      resize();
      element.setAttribute("data-model-ready", "");
      // The model fades in over its poster, which then steps aside (its background may be clear).
      canvas.style.opacity = "1";
      if (standIn) {
        standIn.style.transition = "opacity 500ms ease-out";
        standIn.style.opacity = "0";
      }
      loop.wake();
    } catch {
      // No WebGL, a file that can't be read or a format we can't draw: the poster stays.
      canvas.remove();
      element.setAttribute("data-model-failed", "");
    }
  })();

  const tracker = new VelocityTracker(100);
  let lastX = 0;
  const pointerHandlers =
    motion === "pointer"
      ? listen(window, {
          pointermove: (event: PointerEvent) => {
            const where = pointerWithin(element, event);
            goal.turn = clamp(where.x, -1.5, 1.5) * 0.6;
            goal.tilt = clamp(where.y, -1.5, 1.5) * 0.2;
            loop.wake();
          },
        })
      : motion === "scroll"
        ? onScrollProgress(element, (progress) => {
            goal.turn = scrollTurn(progress);
            loop.wake();
          })
        : undefined;
  const dragHandlers =
    motion === "drag"
      ? listen(element, {
          pointerdown: (event: PointerEvent) => {
            dragging = true;
            velocity = 0;
            lastX = event.clientX;
            tracker.reset();
            element.setPointerCapture?.(event.pointerId);
            loop.wake();
          },
          pointermove: (event: PointerEvent) => {
            if (!dragging) return;
            goal.turn += ((event.clientX - lastX) / Math.max(element.clientWidth, 1)) * Math.PI;
            lastX = event.clientX;
            tracker.add(goal.turn, event.timeStamp);
            loop.wake();
          },
          pointerup: (event: PointerEvent) => {
            dragging = false;
            velocity = clamp(tracker.velocity(event.timeStamp), -8, 8);
            loop.wake();
          },
          pointercancel: () => (dragging = false),
          keydown: (event: KeyboardEvent) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            goal.turn += event.key === "ArrowRight" ? Math.PI / 8 : -Math.PI / 8;
            loop.wake();
          },
        })
      : undefined;
  // Dragging needs a keyboard way too: the model takes focus and turns with the arrow keys.
  const hadTabIndex = element.hasAttribute("tabindex");
  if (motion === "drag" && !hadTabIndex) element.tabIndex = 0;

  return combine(pointerHandlers, dragHandlers, () => {
    stopped = true;
    loop.destroy();
    resizeObserver?.disconnect();
    scene?.destroy();
    canvas.remove();
    element.removeAttribute("data-model-ready");
    element.removeAttribute("data-model-failed");
    poster?.style.removeProperty("opacity");
    poster?.style.removeProperty("transition");
    restorePosition?.();
    if (motion === "drag" && !hadTabIndex) element.removeAttribute("tabindex");
  });
};

export const behaviours = { modelViewer };
export default { behaviours } satisfies EffectModule;
