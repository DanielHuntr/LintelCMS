import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readText } from "../kit/params.js";
import { addOverlay, addStyleOnce, setStyles } from "../kit/styles.js";
import {
  flattenPath,
  matchOutlines,
  mixOutlines,
  outlineToPath,
  type Point,
} from "../maths/pathMorph.js";

/**
 * SVG effects: drawing lines when they come into view, morphing between shapes (the
 * element's own paths, or built-in ones), a living blob, a moving wave edge and the gooey
 * filter that melts shapes together. Shapes are matched point by point first (see
 * maths/pathMorph.ts) so the morph never folds through itself.
 */

const svgNamespace = "http://www.w3.org/2000/svg";

/** Built-in outlines on a 100 by 100 square. */
function polarOutline(radiusAt: (angle: number) => number, points = 72): Point[] {
  return Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2 - Math.PI / 2;
    const radius = radiusAt(angle);
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius] as Point;
  });
}

export const builtInShapes: Record<string, (seed: number) => Point[]> = {
  circle: () => polarOutline(() => 44),
  star: () => polarOutline((angle) => 30 + 16 * Math.cos(angle * 5 + Math.PI / 2) ** 8),
  flower: () => polarOutline((angle) => 34 + 10 * Math.cos(angle * 6)),
  squircle: () =>
    polarOutline(
      (angle) =>
        44 / Math.pow(Math.abs(Math.cos(angle)) ** 4 + Math.abs(Math.sin(angle)) ** 4, 0.25),
    ),
  blob: (seed) =>
    polarOutline(
      (angle) =>
        38 +
        5 * Math.sin(angle * 2 + seed) +
        4 * Math.cos(angle * 3 + seed * 1.7) +
        2 * Math.sin(angle * 5 + seed * 0.6),
    ),
};

function inView(element: Element, start: () => void) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    },
    { threshold: 0.3 },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

const drawLines: EffectBehaviour = (element, params, context) => {
  const shapes = Array.from(
    element.querySelectorAll<SVGGeometryElement>(
      "path, line, polyline, polygon, circle, ellipse, rect",
    ),
  );
  if (context.reduced || shapes.length === 0) return;
  const duration = readNumber(params, "duration", 1600);
  const stagger = readNumber(params, "stagger", 120);
  const animations: Animation[] = [];
  shapes.forEach((shape) => {
    const length = shape.getTotalLength?.() ?? 0;
    shape.style.strokeDasharray = `${length}`;
    shape.style.strokeDashoffset = `${length}`;
  });
  return combine(
    inView(element, () =>
      shapes.forEach((shape, index) => {
        const length = shape.getTotalLength?.() ?? 0;
        animations.push(
          shape.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
            duration,
            delay: index * stagger,
            easing: "cubic-bezier(.65,0,.35,1)",
            fill: "forwards",
          }),
        );
      }),
    ),
    () => {
      animations.forEach((animation) => animation.cancel());
      shapes.forEach(
        (shape) => (
          shape.style.removeProperty("stroke-dasharray"),
          shape.style.removeProperty("stroke-dashoffset")
        ),
      );
    },
  );
};

/**
 * Morphs the first path of the element's SVG through the shapes of its other paths (which
 * are hidden), or through a list of built-in shapes when it has only one. Plays on a loop,
 * or on hover and focus.
 */
const morphShapes: EffectBehaviour = (element, params, context) => {
  let path = element.querySelector<SVGPathElement>("svg path");
  let added: SVGSVGElement | undefined;
  if (!path) {
    added = document.createElementNS(svgNamespace, "svg");
    added.setAttribute("viewBox", "0 0 100 100");
    added.setAttribute("aria-hidden", "true");
    Object.assign(added.style, { width: "100%", height: "100%", display: "block" });
    path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("fill", readColour(params, "colour", "currentColor"));
    added.append(path);
    element.append(added);
  }
  const others = Array.from(path.ownerSVGElement?.querySelectorAll("path") ?? []).filter(
    (other) => other !== path,
  );
  const outlines =
    others.length > 0
      ? [path, ...others].map((shape) => flattenPath(shape.getAttribute("d") ?? ""))
      : readText(params, "shapes", "circle, flower, star")
          .split(/\s*,\s*/)
          .map((name, index) => (builtInShapes[name] ?? builtInShapes.circle!)(index));
  others.forEach((other) => (other.style.display = "none"));
  const original = path.getAttribute("d");
  const pairs = outlines.map((outline, index) =>
    matchOutlines(outline, outlines[(index + 1) % outlines.length]!, 96),
  );
  const show = (index: number, progress: number) => {
    const [from, to] = pairs[index % pairs.length]!;
    path!.setAttribute("d", outlineToPath(mixOutlines(from, to, progress)));
  };
  show(0, 0);
  if (context.reduced)
    return combine(
      () => others.forEach((other) => other.style.removeProperty("display")),
      () => added?.remove(),
    );
  const duration = readNumber(params, "duration", 1400);
  const onHover = readText(params, "trigger", "loop") === "hover";
  let started = 0;
  let wanted = !onHover;
  let progressOnHover = 0;
  const loop = createFrameLoop(element, (elapsed, now) => {
    if (onHover) {
      progressOnHover = Math.min(
        1,
        Math.max(0, progressOnHover + (wanted ? 1 : -1) * (elapsed / duration)),
      );
      const eased = progressOnHover * progressOnHover * (3 - 2 * progressOnHover);
      show(0, eased);
      return progressOnHover > 0 && progressOnHover < 1;
    }
    if (!started) started = now;
    const total = (now - started) / duration;
    const index = Math.floor(total);
    const within = total - index;
    const eased = within < 0.6 ? 0 : (within - 0.6) / 0.4;
    show(index, eased * eased * (3 - 2 * eased));
    return true;
  });
  const set = (on: boolean) => {
    wanted = on;
    loop.wake();
  };
  return combine(
    onHover
      ? listen(element, {
          pointerenter: () => set(true),
          pointerleave: () => set(false),
          focusin: () => set(true),
          focusout: () => set(false),
        })
      : undefined,
    () => loop.destroy(),
    () => {
      if (original !== null) path!.setAttribute("d", original);
      others.forEach((other) => other.style.removeProperty("display"));
      added?.remove();
    },
  );
};

/** A soft organic shape behind the element's content that slowly changes. */
const livingBlob: EffectBehaviour = (element, params, context) => {
  const layer = addOverlay(element, "div", true);
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  Object.assign(svg.style, {
    width: "100%",
    height: "100%",
    opacity: String(readNumber(params, "opacity", 0.35)),
  });
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("fill", readColour(params, "colour", "var(--lintel-color-brand)"));
  svg.append(path);
  layer.overlay.append(svg);
  const speed = readNumber(params, "speed", 1) / 4000;
  const draw = (time: number) =>
    path.setAttribute("d", outlineToPath(builtInShapes.blob!(time * speed * Math.PI * 2)));
  draw(0);
  if (context.reduced) return layer.remove;
  const loop = createFrameLoop(element, (_elapsed, now) => (draw(now), true));
  return combine(() => loop.destroy(), layer.remove);
};

/** A wave along the element's bottom edge, gently rolling. */
const waveEdge: EffectBehaviour = (element, params, context) => {
  const height = readNumber(params, "height", 48);
  const colour = readColour(params, "colour", "var(--lintel-color-background, #fff)");
  const layer = addOverlay(element);
  Object.assign(layer.overlay.style, { top: "auto", height: `${height}px`, bottom: "-1px" });
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 200 20");
  svg.setAttribute("preserveAspectRatio", "none");
  Object.assign(svg.style, { width: "100%", height: "100%", display: "block" });
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("fill", colour);
  svg.append(path);
  layer.overlay.append(svg);
  const draw = (phase: number) => {
    let data = "M0 20";
    for (let x = 0; x <= 200; x += 5) {
      data += `L${x} ${10 + Math.sin(x / 22 + phase) * 4 + Math.sin(x / 9 + phase * 1.6) * 1.5}`;
    }
    path.setAttribute("d", `${data}L200 20Z`);
  };
  draw(0);
  if (context.reduced) return layer.remove;
  const loop = createFrameLoop(element, (_elapsed, now) => (draw(now / 900), true));
  return combine(() => loop.destroy(), layer.remove);
};

/** Melts the element's children together where they touch, like drops of liquid. */
const gooey: EffectBehaviour = (element, params) => {
  const strength = readNumber(params, "strength", 10);
  const id = `lintel-goo-${Math.round(strength)}`;
  if (!document.getElementById(id)) {
    const holder = document.createElementNS(svgNamespace, "svg");
    holder.setAttribute("aria-hidden", "true");
    Object.assign(holder.style, { position: "absolute", width: "0", height: "0" });
    holder.innerHTML = `<filter id="${id}"><feGaussianBlur in="SourceGraphic" stdDeviation="${strength}" result="blur"/><feColorMatrix in="blur" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${strength * 2} -${strength}" result="goo"/><feComposite in="SourceGraphic" in2="goo" operator="atop"/></filter>`;
    document.body.append(holder);
  }
  return setStyles(element, { filter: `url(#${id})` });
};

/** A gradient that drifts through its colours, behind the content or through the text. */
const flowingGradient: EffectBehaviour = (element, params, context) => {
  addStyleOnce(
    "lintel-gradient-style",
    `@property --lintel-flow{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes lintel-flow{to{--lintel-flow:360deg}}`,
  );
  const colours = ["one", "two", "three"].map((name, index) =>
    readColour(params, name, ["#7539fd", "#ff5c8a", "#ffb347"][index]!),
  );
  const onText = readText(params, "target", "background") === "text";
  const seconds = readNumber(params, "duration", 8);
  return setStyles(element, {
    "background-image": `linear-gradient(var(--lintel-flow), ${colours.join(", ")}, ${colours[0]})`,
    animation: context.reduced ? "none" : `lintel-flow ${seconds}s linear infinite`,
    ...(onText
      ? { "-webkit-background-clip": "text", "background-clip": "text", color: "transparent" }
      : {}),
  });
};

export const behaviours = { drawLines, morphShapes, livingBlob, waveEdge, gooey, flowingGradient };
export default { behaviours } satisfies EffectModule;
