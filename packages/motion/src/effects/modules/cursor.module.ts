import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readText } from "../kit/params.js";
import { addStyleOnce } from "../kit/styles.js";
import { approach } from "../maths/smoothing.js";

/**
 * Custom cursors: the site-wide one picked in the builder's site settings, and cursors
 * that only show over one element (a "View" label over a gallery, a trail of words).
 *
 * The runtime only starts the site cursor for a mouse or trackpad. Fields, text areas and
 * anything editable keep the normal cursor, so typing never loses its caret. With less
 * motion asked for, the cursor follows exactly and leaves no trail.
 */

const hiddenCursorClass = "lintel-custom-cursor";

function cursorStyles() {
  addStyleOnce(
    "lintel-cursor-style",
    `.${hiddenCursorClass},.${hiddenCursorClass} *{cursor:none!important}
.${hiddenCursorClass} :is(input,textarea,select,[contenteditable]){cursor:auto!important}
.lintel-cursor{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;border-radius:50%;translate:-50% -50%;transition:width .2s,height .2s,opacity .2s,background-color .2s}
.lintel-cursor-label{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;padding:.5em .9em;border-radius:999px;font:600 .8rem/1 system-ui,sans-serif;translate:-50% -50%;opacity:0;scale:.6;transition:opacity .2s,scale .2s}
.lintel-cursor-label[data-shown]{opacity:1;scale:1}`,
  );
}

function trailCanvas() {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483645",
  });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  };
  resize();
  document.body.append(canvas);
  const stop = listen(window, { resize });
  return { canvas, ratio, remove: () => (stop(), canvas.remove()) };
}

type Point = { x: number; y: number; age: number };

function drawTrail(
  context: CanvasRenderingContext2D,
  points: Point[],
  kind: string,
  colour: string,
  size: number,
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.fillStyle = colour;
  context.strokeStyle = colour;
  context.lineCap = "round";
  points.forEach((point, index) => {
    const life = 1 - point.age;
    if (life <= 0) return;
    context.globalAlpha = life * (kind === "comet" ? 0.6 : 0.45);
    if (kind === "line" || kind === "comet") {
      const previous = points[index - 1];
      if (!previous) return;
      context.lineWidth = kind === "comet" ? size * life : 2;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    } else if (index % 3 === 0) {
      context.beginPath();
      context.arc(point.x, point.y, (size / 4) * life, 0, Math.PI * 2);
      context.fill();
    }
  });
  context.globalAlpha = 1;
}

const siteCursor: EffectBehaviour = (_body, params, context) => {
  cursorStyles();
  const style = readText(params, "style", "ring-and-dot");
  const trail = context.reduced || context.lowPower ? "none" : readText(params, "trail", "none");
  const colour = readColour(params, "colour", "#111111");
  const size = readNumber(params, "size", 32);
  const make = (diameter: number, fill: boolean) => {
    const node = document.createElement("div");
    node.className = "lintel-cursor";
    node.setAttribute("aria-hidden", "true");
    Object.assign(node.style, {
      width: `${diameter}px`,
      height: `${diameter}px`,
      background: fill ? colour : "transparent",
      border: fill ? "none" : `1.5px solid ${colour}`,
      opacity: "0",
    });
    document.body.append(node);
    return node;
  };
  const blend = style === "blend";
  const ring =
    style === "ring" || style === "ring-and-dot" || blend ? make(size, blend) : undefined;
  const dot =
    style === "dot" || style === "ring-and-dot" ? make(Math.max(6, size / 5), true) : undefined;
  if (blend && ring) {
    ring.style.background = "#fff";
    ring.style.mixBlendMode = "difference";
  }
  document.documentElement.classList.add(hiddenCursorClass);
  const trailLayer = trail !== "none" ? trailCanvas() : undefined;
  const drawing = trailLayer?.canvas.getContext("2d");
  const target = { x: -100, y: -100 };
  const eased = { x: -100, y: -100 };
  const points: Point[] = [];
  let hovering = false;
  const smoothing = context.reduced ? 0 : 0.8;
  const loop = createFrameLoop(document.documentElement, (elapsed) => {
    eased.x = approach(eased.x, target.x, smoothing, elapsed);
    eased.y = approach(eased.y, target.y, smoothing, elapsed);
    if (dot) dot.style.transform = `translate(${target.x}px, ${target.y}px)`;
    if (ring) {
      ring.style.transform = `translate(${eased.x}px, ${eased.y}px)`;
      const grown = hovering ? size * 1.8 : size;
      ring.style.width = ring.style.height = `${grown}px`;
    }
    if (drawing && trailLayer) {
      points.forEach((point) => (point.age += elapsed / 450));
      while (points.length && (points[0]?.age ?? 0) >= 1) points.shift();
      drawing.setTransform(trailLayer.ratio, 0, 0, trailLayer.ratio, 0, 0);
      drawTrail(drawing, points, trail, colour, size / 2);
    }
    return eased.x !== target.x || eased.y !== target.y || points.length > 0;
  });
  const show = (shown: boolean) =>
    [ring, dot].forEach((node) => node && (node.style.opacity = shown ? "1" : "0"));
  return combine(
    listen(
      document,
      {
        pointermove: (event: PointerEvent) => {
          if (event.pointerType !== "mouse") return;
          target.x = event.clientX;
          target.y = event.clientY;
          if (drawing) points.push({ x: target.x, y: target.y, age: 0 });
          hovering =
            event.target instanceof Element &&
            event.target.closest("a, button, [role='button'], label, summary") !== null;
          show(true);
          loop.wake();
        },
        pointerdown: () => ring?.style.setProperty("scale", "0.85"),
        pointerup: () => ring?.style.removeProperty("scale"),
      },
      { passive: true },
    ),
    listen(document.documentElement, { pointerleave: () => show(false) }),
    () => {
      loop.destroy();
      ring?.remove();
      dot?.remove();
      trailLayer?.remove();
      document.documentElement.classList.remove(hiddenCursorClass);
    },
  );
};

/** A label ("View", "Drag", "Play") that follows the pointer while it is over the element. */
const cursorLabel: EffectBehaviour = (element, params, context) => {
  if (!context.finePointer) return;
  cursorStyles();
  const label = document.createElement("div");
  label.className = "lintel-cursor-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = readText(params, "text", "View");
  label.style.background = readColour(params, "background", "#111111");
  label.style.color = readColour(params, "colour", "#ffffff");
  document.body.append(label);
  const target = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  const smoothing = context.reduced ? 0 : 0.75;
  const loop = createFrameLoop(element, (elapsed) => {
    eased.x = approach(eased.x, target.x, smoothing, elapsed);
    eased.y = approach(eased.y, target.y, smoothing, elapsed);
    label.style.transform = `translate(${eased.x}px, ${eased.y}px)`;
    return eased.x !== target.x || eased.y !== target.y;
  });
  const hideNative = readText(params, "native", "hide") === "hide";
  return combine(
    listen(element, {
      pointerenter: (event: PointerEvent) => {
        eased.x = target.x = event.clientX;
        eased.y = target.y = event.clientY;
        label.toggleAttribute("data-shown", true);
        if (hideNative) element.style.cursor = "none";
        loop.wake();
      },
      pointermove: (event: PointerEvent) => {
        target.x = event.clientX;
        target.y = event.clientY;
        loop.wake();
      },
      pointerleave: () => label.removeAttribute("data-shown"),
    }),
    () => {
      loop.destroy();
      label.remove();
      element.style.removeProperty("cursor");
    },
  );
};

/** Words or emoji left behind the pointer as it moves over the element, fading away. */
const cursorTrail: EffectBehaviour = (element, params, context) => {
  if (context.reduced || !context.finePointer) return;
  const items = readText(params, "items", "✦")
    .split(/\s*,\s*/)
    .filter(Boolean);
  const colour = readColour(params, "colour", "currentColor");
  const gap = readNumber(params, "spacing", 48);
  let last: { x: number; y: number } | undefined;
  let index = 0;
  return listen(element, {
    pointermove: (event: PointerEvent) => {
      if (last && Math.hypot(event.clientX - last.x, event.clientY - last.y) < gap) return;
      last = { x: event.clientX, y: event.clientY };
      const mark = document.createElement("span");
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = items[index++ % items.length] ?? "";
      Object.assign(mark.style, {
        position: "fixed",
        left: `${event.clientX}px`,
        top: `${event.clientY}px`,
        translate: "-50% -50%",
        pointerEvents: "none",
        color: colour,
        zIndex: "2147483645",
        font: "600 1rem system-ui, sans-serif",
      });
      document.body.append(mark);
      mark
        .animate(
          [
            { opacity: 1, transform: "scale(1)" },
            {
              opacity: 0,
              transform: `translateY(-24px) scale(0.6) rotate(${(index % 5) * 9 - 18}deg)`,
            },
          ],
          { duration: 900, easing: "ease-out" },
        )
        .finished.finally(() => mark.remove());
    },
    pointerleave: () => (last = undefined),
  });
};

export const behaviours = { siteCursor, cursorLabel, cursorTrail };
export default { behaviours } satisfies EffectModule;
