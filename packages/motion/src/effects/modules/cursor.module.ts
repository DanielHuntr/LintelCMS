import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readText } from "../kit/params.js";
import { isEmbeddedFrame, pointerOnFrame, watchEmbeddedFrames } from "../kit/pointer.js";
import { addStyleOnce } from "../kit/styles.js";
import { approach } from "../maths/smoothing.js";

/**
 * Custom cursors: the site-wide one picked in the builder's site settings, and cursors
 * that only show over one element (a "View" label over a gallery, a trail of words).
 *
 * The runtime only starts the site cursor for a mouse or trackpad. Fields, text areas and
 * anything editable keep the normal cursor, so typing never loses its caret. Keyboard
 * focus rings are untouched. With less motion asked for, the cursor follows exactly,
 * changes size without easing and leaves no trail.
 *
 * Elements given a word on the Animate tab carry `data-lintel-cursor-word`: the site
 * cursor turns into a small pill with that word over them, and without a site cursor the
 * word follows the pointer on its own.
 *
 * Over an embedded frame (a YouTube or Vimeo player) the page can't tell where the pointer
 * is, so the cursor and its word step aside for the frame's own cursor and come back when
 * the pointer returns to the page.
 */

const hiddenCursorClass = "lintel-custom-cursor";
const cursorWordAttribute = "data-lintel-cursor-word";

/** A colour as the canvas needs it: theme variables worked out to rgb(). */
function resolvedColour(colour: string): string {
  if (!colour.startsWith("var(")) return colour;
  const probe = document.createElement("span");
  probe.style.color = colour;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || "#111111";
}

/** Words on a pill of this colour: the theme's background on its text colour, else black or white. */
function wordColourOn(colour: string): string {
  if (colour.includes("--lintel-color-text")) return "var(--lintel-color-background, #ffffff)";
  if (colour.includes("--lintel-color-brand")) return "var(--lintel-color-on-brand, #ffffff)";
  const hex = /^#([0-9a-f]{6})$/i.exec(colour)?.[1];
  if (!hex) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return (red ?? 0) * 0.299 + (green ?? 0) * 0.587 + (blue ?? 0) * 0.114 > 160
    ? "#111111"
    : "#ffffff";
}

function cursorStyles() {
  addStyleOnce(
    "lintel-cursor-style",
    `.${hiddenCursorClass},.${hiddenCursorClass} *{cursor:none!important}
.${hiddenCursorClass} :is(input,textarea,select,[contenteditable]){cursor:auto!important}
.lintel-cursor{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;border-radius:50%;transition:width .2s,height .2s,opacity .2s,background-color .2s}
.lintel-cursor-label{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;padding:.5em .9em;border-radius:999px;font:600 .8rem/1 system-ui,sans-serif;opacity:0;scale:.6;transition:opacity .2s,scale .2s}
.lintel-cursor-label[data-shown]{opacity:1;scale:1}
.lintel-cursor[data-hidden]{opacity:0!important}
@media (prefers-reduced-motion:reduce){.lintel-cursor,.lintel-cursor-label{transition:none}}`,
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

/**
 * Where a cursor part goes: centred on the point. It's set with `translate`, which the
 * browser applies after `scale`, so a part shrinking on a click (or a word popping in)
 * shrinks in place instead of sliding towards the corner of the window.
 */
function centredAt(point: { x: number; y: number }): string {
  return `calc(${point.x}px - 50%) calc(${point.y}px - 50%)`;
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
  const trailColour = trailLayer ? resolvedColour(colour) : colour;
  const word = document.createElement("div");
  word.className = "lintel-cursor-label";
  word.setAttribute("aria-hidden", "true");
  word.style.background = colour;
  word.style.color = wordColourOn(colour);
  document.body.append(word);
  let shownWord = "";
  const drawing = trailLayer?.canvas.getContext("2d");
  const target = { x: -100, y: -100 };
  const eased = { x: -100, y: -100 };
  const points: Point[] = [];
  let hovering = false;
  const smoothing = context.reduced ? 0 : 0.8;
  const loop = createFrameLoop(document.documentElement, (elapsed) => {
    eased.x = approach(eased.x, target.x, smoothing, elapsed);
    eased.y = approach(eased.y, target.y, smoothing, elapsed);
    if (dot) dot.style.translate = centredAt(target);
    word.style.translate = centredAt(eased);
    if (ring) {
      ring.style.translate = centredAt(eased);
      const grown = hovering ? size * 1.8 : size;
      ring.style.width = ring.style.height = `${grown}px`;
    }
    if (drawing && trailLayer) {
      points.forEach((point) => (point.age += elapsed / 450));
      while (points.length && (points[0]?.age ?? 0) >= 1) points.shift();
      drawing.setTransform(trailLayer.ratio, 0, 0, trailLayer.ratio, 0, 0);
      drawTrail(drawing, points, trail, trailColour, size / 2);
    }
    return eased.x !== target.x || eased.y !== target.y || points.length > 0;
  });
  const show = (shown: boolean) =>
    [ring, dot].forEach((node) => node && (node.style.opacity = shown ? "1" : "0"));
  const hideWord = () => {
    word.removeAttribute("data-shown");
    [ring, dot].forEach((node) => node?.removeAttribute("data-hidden"));
    shownWord = "";
  };
  // Back from a frame, the cursor appears where the pointer is instead of gliding over.
  let jumpToPointer = false;
  return combine(
    watchEmbeddedFrames({
      onEnter: () => {
        show(false);
        hideWord();
        points.length = 0;
        jumpToPointer = true;
      },
    }),
    listen(
      document,
      {
        pointermove: (event: PointerEvent) => {
          if (event.pointerType !== "mouse" || isEmbeddedFrame(event.target)) return;
          target.x = event.clientX;
          target.y = event.clientY;
          if (jumpToPointer) {
            jumpToPointer = false;
            eased.x = target.x;
            eased.y = target.y;
          }
          if (drawing) points.push({ x: target.x, y: target.y, age: 0 });
          const over = event.target instanceof Element ? event.target : null;
          hovering = over?.closest("a, button, [role='button'], label, summary") != null;
          const nextWord =
            over?.closest(`[${cursorWordAttribute}]`)?.getAttribute(cursorWordAttribute) ?? "";
          if (nextWord !== shownWord) {
            shownWord = nextWord;
            if (nextWord) word.textContent = nextWord;
            word.toggleAttribute("data-shown", nextWord !== "");
            [ring, dot].forEach((node) => node?.toggleAttribute("data-hidden", nextWord !== ""));
          }
          show(true);
          loop.wake();
        },
        pointerdown: () => ring?.style.setProperty("scale", "0.85"),
        pointerup: () => ring?.style.removeProperty("scale"),
      },
      { passive: true },
    ),
    listen(document.documentElement, {
      pointerleave: () => {
        show(false);
        hideWord();
      },
    }),
    () => {
      loop.destroy();
      ring?.remove();
      dot?.remove();
      word.remove();
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
    label.style.translate = centredAt(eased);
    return eased.x !== target.x || eased.y !== target.y;
  });
  const hideNative = readText(params, "native", "hide") === "hide";
  // A word set on the element defers to the site cursor, which shows it itself.
  const deferToSiteCursor = params.onlyWithoutSiteCursor === true;
  const showAt = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (deferToSiteCursor && document.documentElement.classList.contains(hiddenCursorClass)) {
      return;
    }
    eased.x = target.x = event.clientX;
    eased.y = target.y = event.clientY;
    label.toggleAttribute("data-shown", true);
    if (hideNative) element.style.cursor = "none";
    loop.wake();
  };
  return combine(
    // Over a video's frame the label would freeze where the pointer crossed onto it.
    watchEmbeddedFrames({
      onEnter: () => label.removeAttribute("data-shown"),
      onReturn: (event) => {
        if (event.target instanceof Node && element.contains(event.target)) showAt(event);
      },
    }),
    listen(element, {
      pointerenter: (event: PointerEvent) => {
        if (!pointerOnFrame(event)) showAt(event);
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

/**
 * The word set on an element with "Word on the cursor". The site cursor shows it when there
 * is one; otherwise this shows it as a small pill in the theme's colours.
 */
const cursorWord: EffectBehaviour = (element, params, context) => {
  const text = readText(params, "text", "").trim().slice(0, 16);
  if (!text) return;
  element.setAttribute(cursorWordAttribute, text);
  const undoAttribute = () => element.removeAttribute(cursorWordAttribute);
  if (!context.finePointer) return undoAttribute;
  const ownLabel = cursorLabel(
    element,
    {
      text,
      background: "var(--lintel-color-text, #111111)",
      colour: "var(--lintel-color-background, #ffffff)",
      onlyWithoutSiteCursor: true,
    },
    context,
  );
  return combine(undoAttribute, ownLabel ?? undefined);
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

export const behaviours = { siteCursor, cursorLabel, cursorWord, cursorTrail };
export default { behaviours } satisfies EffectModule;
