import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readSwitch } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { addOverlay, setStyles } from "../kit/styles.js";
import { approach } from "../maths/smoothing.js";

/**
 * Effects that follow the pointer: magnetic pull, 3D tilt with glare, follow, spotlight,
 * parallax by pointer and a glowing edge. Each also answers keyboard focus (a gentle lift
 * or a centred light) and touch (the same as a pointer, without hover), and does nothing
 * that moves for people who ask for less motion.
 *
 * Positions are eased towards the pointer in a frame loop that stops once it settles, so a
 * still pointer costs nothing. Movement uses the separate `translate` property, which adds
 * to an animation's `transform` rather than fighting it.
 */

interface Eased {
  x: number;
  y: number;
}

function easedPointer(
  element: HTMLElement,
  smoothing: number,
  draw: (position: Eased, active: boolean) => void,
  { reach = 0, track = element as Element } = {},
) {
  const target: Eased = { x: 0, y: 0 };
  const current: Eased = { x: 0, y: 0 };
  let active = false;
  const loop = createFrameLoop(element, (elapsed) => {
    current.x = approach(current.x, target.x, smoothing, elapsed);
    current.y = approach(current.y, target.y, smoothing, elapsed);
    draw(current, active);
    return current.x !== target.x || current.y !== target.y;
  });
  const move = (event: PointerEvent) => {
    const position = pointerWithin(track, event);
    const box = track.getBoundingClientRect();
    const margin = {
      x: box.width ? (reach * 2) / box.width : 0,
      y: box.height ? (reach * 2) / box.height : 0,
    };
    active = Math.abs(position.x) <= 1 + margin.x && Math.abs(position.y) <= 1 + margin.y;
    target.x = active ? position.x : 0;
    target.y = active ? position.y : 0;
    loop.wake();
  };
  const leave = () => {
    active = false;
    target.x = 0;
    target.y = 0;
    loop.wake();
  };
  const listenOn = reach > 0 ? document : track;
  return combine(
    listen(listenOn, { pointermove: move }, { passive: true }),
    listen(track, { pointerleave: leave, pointercancel: leave }),
    () => loop.destroy(),
  );
}

/** A small lift when the element (or something in it) has keyboard focus. */
function focusLift(element: HTMLElement, scale: number) {
  return listen(element, {
    focusin: () => element.style.setProperty("scale", String(scale)),
    focusout: () => element.style.removeProperty("scale"),
  });
}

const magnetic: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const strength = readNumber(params, "strength", 0.35);
  const reach = readNumber(params, "reach", 60);
  const restore = setStyles(element, { transition: "scale 200ms ease-out" });
  const box = () => element.getBoundingClientRect();
  return combine(
    easedPointer(
      element,
      readNumber(params, "smoothing", 0.82),
      ({ x, y }) => {
        const { width, height } = box();
        element.style.translate = `${(x * width * strength) / 2}px ${(y * height * strength) / 2}px`;
      },
      { reach },
    ),
    focusLift(element, 1.05),
    () => element.style.removeProperty("translate"),
    restore,
  );
};

const tilt: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const angle = readNumber(params, "angle", 12);
  const perspective = readNumber(params, "perspective", 800);
  const lift = readNumber(params, "lift", 1.03);
  const glare = readSwitch(params, "glare", false) ? addOverlay(element) : undefined;
  const restore = setStyles(element, {
    "transform-style": "preserve-3d",
    "will-change": "transform",
  });
  return combine(
    easedPointer(element, readNumber(params, "smoothing", 0.8), ({ x, y }, active) => {
      const scale = 1 + (lift - 1) * Math.max(Math.abs(x), Math.abs(y), active ? 1 : 0);
      element.style.transform = `perspective(${perspective}px) rotateX(${-y * angle}deg) rotateY(${x * angle}deg) scale(${scale})`;
      if (glare) {
        const strength = Math.min(1, Math.hypot(x, y)) * 0.35;
        glare.overlay.style.background = `radial-gradient(circle at ${50 + x * 50}% ${50 + y * 50}%, rgb(255 255 255 / ${strength}), transparent 60%)`;
      }
    }),
    focusLift(element, lift),
    () => element.style.removeProperty("transform"),
    () => glare?.remove(),
    restore,
  );
};

const follow: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const distance = readNumber(params, "distance", 40);
  const area = element.parentElement ?? element;
  return combine(
    easedPointer(
      element,
      readNumber(params, "smoothing", 0.9),
      ({ x, y }) => {
        element.style.translate = `${x * distance}px ${y * distance}px`;
      },
      { track: area },
    ),
    () => element.style.removeProperty("translate"),
  );
};

const spotlight: EffectBehaviour = (element, params, context) => {
  const size = readNumber(params, "size", 320);
  const colour = readColour(params, "colour", "rgb(255 255 255 / 0.18)");
  const layer = addOverlay(element);
  layer.overlay.style.opacity = "0";
  layer.overlay.style.transition = "opacity 300ms ease";
  const draw = (x: number, y: number, shown: boolean) => {
    layer.overlay.style.background = `radial-gradient(${size}px circle at ${50 + x * 50}% ${50 + y * 50}%, ${colour}, transparent 70%)`;
    layer.overlay.style.opacity = shown ? "1" : "0";
  };
  return combine(
    easedPointer(element, context.reduced ? 0 : 0.75, ({ x, y }, active) => draw(x, y, active)),
    listen(element, { focusin: () => draw(0, 0, true), focusout: () => draw(0, 0, false) }),
    layer.remove,
  );
};

const pointerParallax: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const depth = readNumber(params, "depth", 24);
  const layers = Array.from(element.children) as HTMLElement[];
  return combine(
    easedPointer(element, readNumber(params, "smoothing", 0.88), ({ x, y }) => {
      layers.forEach((layer, index) => {
        const own = Number(layer.dataset.depth);
        const share = Number.isFinite(own) && own > 0 ? own : (index + 1) / layers.length;
        layer.style.translate = `${-x * depth * share}px ${-y * depth * share}px`;
      });
    }),
    () => layers.forEach((layer) => layer.style.removeProperty("translate")),
  );
};

const glowEdge: EffectBehaviour = (element, params, context) => {
  const colour = readColour(params, "colour", "var(--lintel-color-brand)");
  const width = readNumber(params, "width", 2);
  const layer = addOverlay(element);
  Object.assign(layer.overlay.style, {
    padding: `${width}px`,
    mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
    webkitMask: "linear-gradient(#000 0 0) content-box xor, linear-gradient(#000 0 0)",
    opacity: "0.25",
    transition: "opacity 300ms ease",
  });
  const draw = (x: number, y: number, active: boolean) => {
    layer.overlay.style.background = `radial-gradient(240px circle at ${50 + x * 50}% ${50 + y * 50}%, ${colour}, transparent 70%)`;
    layer.overlay.style.opacity = active ? "1" : "0.25";
  };
  draw(0, -1, false);
  return combine(
    easedPointer(element, context.reduced ? 0 : 0.8, ({ x, y }, active) => draw(x, y, active)),
    listen(element, { focusin: () => draw(0, 0, true), focusout: () => draw(0, -1, false) }),
    layer.remove,
  );
};

export const behaviours = { magnetic, tilt, follow, spotlight, pointerParallax, glowEdge };
export default { behaviours } satisfies EffectModule;
