import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readText } from "../kit/params.js";
import { onScrollProgress } from "../kit/scroll-progress.js";
import { setStyles } from "../kit/styles.js";
import {
  type DepthLook,
  depthLayerTransform,
  type LayerOrder,
  layerDepths,
} from "../maths/layouts-3d.js";
import { approach, clamp, mix } from "../maths/smoothing.js";
import { VelocityTracker, velocityStrength } from "../maths/velocity.js";

/**
 * Effects driven by scrolling: speed (skew and stretch), drawing SVG lines, a pinned
 * sideways-scrolling section, focus and blur, reveal masks, exploded layers, parallax, a
 * reading-progress bar, stacking cards and colour shifts.
 *
 * Each reads the scroll position once per frame, and only in frames after the page moved
 * while the element is on screen. People who ask for less motion see the finished state.
 */

const onScroll = onScrollProgress;

/** Scroll speed, eased, from -1 to 1. */
function scrollSpeed(element: HTMLElement, fullAt: number, draw: (strength: number) => void) {
  const tracker = new VelocityTracker(120);
  let eased = 0;
  return onScroll(element, (_progress, elapsed, now) => {
    tracker.add(window.scrollY, now);
    const target = velocityStrength(tracker.velocity(now), fullAt);
    eased = approach(eased, target, 0.86, elapsed);
    draw(eased);
    return eased !== 0 || target !== 0;
  });
}

const velocitySkew: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const most = readNumber(params, "angle", 8);
  return combine(
    scrollSpeed(
      element,
      3000,
      (strength) => (element.style.transform = `skewY(${strength * most}deg)`),
    ),
    () => element.style.removeProperty("transform"),
  );
};

const velocityStretch: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const amount = readNumber(params, "amount", 0.15);
  return combine(
    scrollSpeed(element, 3000, (strength) => {
      element.style.scale = `${1 - Math.abs(strength) * amount * 0.5} ${1 + Math.abs(strength) * amount}`;
    }),
    () => element.style.removeProperty("scale"),
  );
};

/** Progress between where the effect starts and ends, as fractions of the screen's journey. */
function window01(progress: number, start: number, end: number) {
  return end > start ? clamp((progress - start) / (end - start), 0, 1) : 1;
}

const pathDraw: EffectBehaviour = (element, params, context) => {
  const shapes = Array.from(
    element.querySelectorAll<SVGGeometryElement>(
      "path, line, polyline, polygon, circle, ellipse, rect",
    ),
  );
  if (context.reduced || shapes.length === 0) return;
  const lengths = shapes.map((shape) =>
    typeof shape.getTotalLength === "function" ? shape.getTotalLength() : 0,
  );
  shapes.forEach((shape, index) => {
    shape.style.strokeDasharray = `${lengths[index]}`;
  });
  const start = readNumber(params, "start", 0.15);
  const end = readNumber(params, "end", 0.6);
  return combine(
    onScroll(element, (progress) => {
      const drawn = window01(progress, start, end);
      shapes.forEach((shape, index) => {
        shape.style.strokeDashoffset = `${(lengths[index] ?? 0) * (1 - drawn)}`;
      });
    }),
    () =>
      shapes.forEach((shape) => {
        shape.style.removeProperty("stroke-dasharray");
        shape.style.removeProperty("stroke-dashoffset");
      }),
  );
};

/**
 * Holds the section on screen while its panels slide sideways. The panels (the element's
 * children) are moved into a sticky track; tabbing to a panel off to the side scrolls the
 * page to it. With less motion asked for, the panels become a row you can swipe instead.
 */
const horizontalScroll: EffectBehaviour = (element, _params, context) => {
  const panels = Array.from(element.children) as HTMLElement[];
  if (panels.length < 2) return;
  const sticky = document.createElement("div");
  const track = document.createElement("div");
  sticky.append(track);
  track.append(...panels);
  element.append(sticky);
  Object.assign(track.style, {
    display: "flex",
    gap: "inherit",
    width: "max-content",
    height: "100%",
    alignItems: "center",
  });
  panels.forEach((panel) => (panel.style.flex = "0 0 auto"));
  const undo = () => {
    element.append(...panels);
    sticky.remove();
    panels.forEach((panel) => panel.style.removeProperty("flex"));
  };
  if (context.reduced) {
    Object.assign(sticky.style, { overflowX: "auto", scrollSnapType: "x mandatory" });
    panels.forEach((panel) => (panel.style.scrollSnapAlign = "start"));
    return undo;
  }
  Object.assign(sticky.style, {
    position: "sticky",
    top: "0",
    height: "100vh",
    overflow: "hidden",
  });
  const travel = () => Math.max(0, track.scrollWidth - sticky.clientWidth);
  const restoreHeight = setStyles(element, { height: `calc(100vh + ${travel()}px)` });
  const progressOf = () => {
    const box = element.getBoundingClientRect();
    return clamp(-box.top / Math.max(1, box.height - innerHeight), 0, 1);
  };
  return combine(
    onScroll(element, () => {
      track.style.transform = `translateX(${-progressOf() * travel()}px)`;
    }),
    listen(window, { resize: () => (element.style.height = `calc(100vh + ${travel()}px)`) }),
    listen(element, {
      focusin: (event: FocusEvent) => {
        const panel = panels.find((candidate) => candidate.contains(event.target as Node));
        if (!panel) return;
        sticky.scrollLeft = 0;
        const share = travel() ? clamp(panel.offsetLeft / travel(), 0, 1) : 0;
        const top = element.getBoundingClientRect().top + scrollY;
        window.scrollTo({ top: top + share * (element.offsetHeight - innerHeight) });
      },
    }),
    () => track.style.removeProperty("transform"),
    restoreHeight,
    undo,
  );
};

const focusBlur: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const most = readNumber(params, "blur", 10);
  return combine(
    onScroll(element, (progress) => {
      const distance = Math.abs(progress - 0.5) * 2;
      element.style.filter = `blur(${Math.max(0, distance - 0.35) * most * 1.6}px)`;
    }),
    () => element.style.removeProperty("filter"),
  );
};

const maskShapes: Record<string, (amount: number) => string> = {
  circle: (amount) => `circle(${amount * 75}% at 50% 50%)`,
  inset: (amount) => `inset(${(1 - amount) * 30}% ${(1 - amount) * 30}% round 24px)`,
  diagonal: (amount) => `polygon(0 0, ${amount * 200}% 0, ${amount * 200 - 100}% 100%, 0 100%)`,
  blinds: (amount) => `inset(0 0 ${(1 - amount) * 100}% 0)`,
};

const revealMask: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const shape = maskShapes[readText(params, "shape", "circle")] ?? maskShapes.circle!;
  const end = readNumber(params, "end", 0.5);
  return combine(
    onScroll(element, (progress) => {
      element.style.clipPath = shape(window01(progress, 0.05, end));
    }),
    () => element.style.removeProperty("clip-path"),
  );
};

const explodeLayers: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const distance = readNumber(params, "distance", 140);
  const assemble = readText(params, "direction", "assemble") === "assemble";
  const layers = Array.from(element.children) as HTMLElement[];
  const restore = setStyles(element, { perspective: "1000px", "transform-style": "preserve-3d" });
  return combine(
    onScroll(element, (progress) => {
      const spread = assemble ? 1 - window01(progress, 0.1, 0.5) : window01(progress, 0.5, 0.9);
      layers.forEach((layer, index) => {
        const offset = index - (layers.length - 1) / 2;
        layer.style.transform = `translate3d(${offset * spread * distance * 0.6}px, ${-spread * distance * 0.3 * Math.abs(offset)}px, ${offset * spread * distance}px) rotateX(${spread * 18}deg)`;
      });
    }),
    () => layers.forEach((layer) => layer.style.removeProperty("transform")),
    restore,
  );
};

const scrollParallax: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const speed =
    readNumber(params, "speed", 0.25) *
    (readText(params, "direction", "back") === "front" ? -1 : 1);
  return combine(
    onScroll(element, (progress) => {
      element.style.translate = `0 ${(progress - 0.5) * speed * innerHeight}px`;
    }),
    () => element.style.removeProperty("translate"),
  );
};

/** The element becomes a bar that fills as the reader moves down the page. */
const readingProgress: EffectBehaviour = (element) => {
  const restore = setStyles(element, { "transform-origin": "0 50%" });
  const draw = () => {
    const most = document.documentElement.scrollHeight - innerHeight;
    element.style.transform = `scaleX(${most > 0 ? clamp(scrollY / most, 0, 1) : 1})`;
  };
  draw();
  return combine(listen(window, { scroll: draw, resize: draw }, { passive: true }), restore, () =>
    element.style.removeProperty("transform"),
  );
};

/** Its children stick one over another as the page scrolls, the ones behind shrinking back. */
const stackingCards: EffectBehaviour = (element, params, context) => {
  const cards = Array.from(element.children) as HTMLElement[];
  const gap = readNumber(params, "offset", 24);
  const restores = cards.map((card, index) =>
    setStyles(card, { position: "sticky", top: `calc(10vh + ${index * gap}px)` }),
  );
  if (context.reduced) return combine(...restores);
  return combine(
    onScroll(element, () => {
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        if (!next) return;
        const covered = clamp(
          1 -
            (next.getBoundingClientRect().top - card.getBoundingClientRect().top) /
              card.offsetHeight,
          0,
          1,
        );
        card.style.scale = String(1 - covered * 0.06);
        card.style.filter = `brightness(${1 - covered * 0.25})`;
      });
    }),
    () =>
      cards.forEach(
        (card) => (card.style.removeProperty("scale"), card.style.removeProperty("filter")),
      ),
    ...restores,
  );
};

const scrollRotate: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const turn = readNumber(params, "degrees", 90);
  return combine(
    onScroll(element, (progress) => {
      element.style.rotate = `${(progress - 0.5) * turn}deg`;
    }),
    () => element.style.removeProperty("rotate"),
  );
};

const colourShift: EffectBehaviour = (element, params) => {
  const from = readColour(params, "from", "#ffffff");
  const to = readColour(params, "to", "#111111");
  return combine(
    onScroll(element, (progress) => {
      const share = Math.round(window01(progress, 0.2, 0.6) * 100);
      element.style.backgroundColor = `color-mix(in oklab, ${to} ${share}%, ${from})`;
    }),
    () => element.style.removeProperty("background-color"),
  );
};

const zoomOnScroll: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const most = readNumber(params, "zoom", 1.25);
  const target = (element.querySelector("img, video") as HTMLElement | null) ?? element;
  const restore = setStyles(element, { overflow: "hidden" });
  return combine(
    onScroll(element, (progress) => {
      target.style.scale = String(mix(1, most, progress));
    }),
    () => target.style.removeProperty("scale"),
    restore,
  );
};

/**
 * The layers of a section (its children, or its one wrapper's children) at different depths,
 * the nearer ones moving further as the page scrolls, like the view from a train window.
 */
const depthOnScroll: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  let parent: HTMLElement = element;
  for (let level = 0; level < 2 && parent.children.length === 1; level++) {
    parent = parent.children[0] as HTMLElement;
  }
  const layers = Array.from(parent.children) as HTMLElement[];
  if (!layers.length) return;
  const look = readText(params, "look", "deep") as DepthLook;
  const strength = readNumber(params, "strength", 1);
  const depths = layerDepths(layers.length, readText(params, "order", "front-first") as LayerOrder);
  return combine(
    onScroll(element, (progress) => {
      const screenHeight = window.innerHeight;
      layers.forEach((layer, index) => {
        layer.style.transform = depthLayerTransform(depths[index] ?? 0, progress, {
          look,
          strength,
          screenHeight,
        });
      });
    }),
    () => layers.forEach((layer) => layer.style.removeProperty("transform")),
  );
};

export const behaviours = {
  depthOnScroll,
  velocitySkew,
  velocityStretch,
  pathDraw,
  horizontalScroll,
  focusBlur,
  revealMask,
  explodeLayers,
  scrollParallax,
  readingProgress,
  stackingCards,
  scrollRotate,
  colourShift,
  zoomOnScroll,
};
export default { behaviours } satisfies EffectModule;
