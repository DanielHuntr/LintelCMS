import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readSwitch, readText } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { addOverlay, addStyleOnce, setStyles } from "../kit/styles.js";
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

/**
 * "Show a picture when hovered": while a mouse is over the element, its picture appears and
 * follows the pointer, like the project lists of design studios. One picture layer serves
 * every element on the page, so moving down a list swaps the picture in place. It is
 * decorative (hidden from screen readers, and clicks go straight through it), and touch
 * screens never see it. With less motion asked for, it appears and moves without easing.
 */
const pictureWidths: Record<string, string> = {
  small: "clamp(140px, 16vw, 200px)",
  medium: "clamp(200px, 22vw, 300px)",
  large: "clamp(260px, 30vw, 420px)",
};

let pictureLayer:
  | { box: HTMLDivElement; image: HTMLImageElement; target: Eased; eased: Eased; users: number }
  | undefined;
let pictureLoop: ReturnType<typeof createFrameLoop> | undefined;

function sharedPictureLayer(smoothing: number) {
  if (pictureLayer) {
    pictureLayer.users += 1;
    return pictureLayer;
  }
  addStyleOnce(
    "lintel-hover-picture-style",
    `.lintel-hover-picture{position:fixed;left:0;top:0;z-index:2147483640;pointer-events:none;translate:-50% -50%;opacity:0;scale:.85;transition:opacity .25s,scale .35s cubic-bezier(.2,.8,.2,1)}
.lintel-hover-picture[data-shown]{opacity:1;scale:1}
.lintel-hover-picture img{display:block;width:100%;height:auto;border-radius:var(--lintel-radius-medium,12px);box-shadow:0 18px 40px rgb(0 0 0/.18)}
@media (prefers-reduced-motion:reduce){.lintel-hover-picture{transition:none;scale:1}}`,
  );
  const box = document.createElement("div");
  box.className = "lintel-hover-picture";
  box.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  box.append(image);
  document.body.append(box);
  const layer = { box, image, target: { x: 0, y: 0 }, eased: { x: 0, y: 0 }, users: 1 };
  pictureLayer = layer;
  pictureLoop = createFrameLoop(document.documentElement, (elapsed) => {
    layer.eased.x = approach(layer.eased.x, layer.target.x, smoothing, elapsed);
    layer.eased.y = approach(layer.eased.y, layer.target.y, smoothing, elapsed);
    box.style.transform = `translate(${layer.eased.x}px, ${layer.eased.y}px)`;
    return layer.eased.x !== layer.target.x || layer.eased.y !== layer.target.y;
  });
  return layer;
}

function releasePictureLayer() {
  if (!pictureLayer) return;
  pictureLayer.users -= 1;
  if (pictureLayer.users > 0) return;
  pictureLoop?.destroy();
  pictureLayer.box.remove();
  pictureLayer = undefined;
  pictureLoop = undefined;
}

/** Only addresses on this site or on the web: never `javascript:` or other schemes. */
export function safePictureAddress(address: string): string {
  const trimmed = address.trim();
  return /^https?:/i.test(trimmed) || !/^[a-z][\w+.-]*:/i.test(trimmed) ? trimmed : "";
}

const hoverPicture: EffectBehaviour = (element, params, context) => {
  const src = safePictureAddress(readText(params, "src", ""));
  if (!src || !context.finePointer) return;
  const width = pictureWidths[readText(params, "size", "medium")] ?? pictureWidths.medium ?? "";
  const layer = sharedPictureLayer(context.reduced ? 0 : 0.82);
  // Fetched ahead, so it's there the moment the pointer arrives.
  const preload = new Image();
  preload.src = src;
  const place = (event: PointerEvent) => {
    layer.target.x = event.clientX;
    layer.target.y = event.clientY;
    pictureLoop?.wake();
  };
  return combine(
    listen(element, {
      pointerenter: (event: PointerEvent) => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
        const wasShown = layer.box.hasAttribute("data-shown");
        layer.image.src = src;
        layer.box.style.width = width;
        if (!wasShown) {
          layer.eased.x = event.clientX;
          layer.eased.y = event.clientY;
        }
        place(event);
        layer.box.toggleAttribute("data-shown", true);
      },
      pointermove: (event: PointerEvent) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") place(event);
      },
      pointerleave: () => layer.box.removeAttribute("data-shown"),
    }),
    () => {
      if (layer.image.getAttribute("src") === src) layer.box.removeAttribute("data-shown");
      releasePictureLayer();
    },
  );
};

export const behaviours = {
  magnetic,
  tilt,
  follow,
  spotlight,
  pointerParallax,
  glowEdge,
  hoverPicture,
};
export default { behaviours } satisfies EffectModule;
