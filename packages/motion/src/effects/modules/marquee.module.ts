import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readSwitch, readText } from "../kit/params.js";
import { setStyles } from "../kit/styles.js";
import { approach } from "../maths/smoothing.js";
import { VelocityTracker } from "../maths/velocity.js";

/**
 * An endless row of the element's children that drifts sideways, speeds up (and turns
 * round) with the page's scroll, pauses under the pointer or keyboard focus, and can be
 * dragged. The copies that fill the loop are hidden from screen readers and the keyboard,
 * so the content is met once. With less motion asked for, it is a still row you can swipe.
 */
const velocityMarquee: EffectBehaviour = (element, params, context) => {
  const items = Array.from(element.children) as HTMLElement[];
  if (items.length === 0) return;
  if (context.reduced)
    return setStyles(element, { display: "flex", "overflow-x": "auto", gap: "2rem" });
  const speed = readNumber(params, "speed", 60);
  const boost = readNumber(params, "boost", 4);
  const backwards = readText(params, "direction", "left") === "right";
  const track = document.createElement("div");
  Object.assign(track.style, {
    display: "flex",
    gap: "inherit",
    width: "max-content",
    willChange: "transform",
  });
  const group = document.createElement("div");
  Object.assign(group.style, { display: "flex", gap: "inherit", paddingInlineEnd: "inherit" });
  group.append(...items);
  track.append(group);
  element.append(track);
  const restore = setStyles(element, {
    overflow: "hidden",
    display: "block",
    "touch-action": "pan-y",
  });
  const fill = () => {
    track.querySelectorAll("[data-copy]").forEach((copy) => copy.remove());
    const copies = Math.max(1, Math.ceil(element.clientWidth / Math.max(1, group.offsetWidth)));
    for (let index = 0; index < copies; index += 1) {
      const copy = group.cloneNode(true) as HTMLElement;
      copy.dataset.copy = "";
      copy.setAttribute("aria-hidden", "true");
      copy.inert = true;
      track.append(copy);
    }
  };
  fill();
  const scroll = new VelocityTracker(120);
  let offset = 0;
  let extra = 0;
  let direction = backwards ? -1 : 1;
  let paused = false;
  let dragging: { x: number; offset: number } | undefined;
  const loop = createFrameLoop(element, (elapsed, now) => {
    scroll.add(window.scrollY, now);
    const scrollVelocity = scroll.velocity(now);
    if (Math.abs(scrollVelocity) > 50) direction = Math.sign(scrollVelocity) * (backwards ? -1 : 1);
    extra = approach(extra, Math.min(Math.abs(scrollVelocity) / 1000, 1) * boost, 0.9, elapsed);
    const width = group.offsetWidth || 1;
    if (!dragging) offset += ((paused ? 0 : speed * (1 + extra)) * direction * elapsed) / 1000;
    offset = ((offset % width) + width) % width;
    track.style.transform = `translateX(${-offset}px)`;
    return true;
  });
  const draggable = readSwitch(params, "draggable", true);
  return combine(
    listen(element, {
      pointerenter: () => (paused = readSwitch(params, "pauseOnHover", true)),
      pointerleave: () => (paused = false),
      focusin: () => (paused = true),
      focusout: () => (paused = false),
      ...(draggable
        ? {
            pointerdown: (event: PointerEvent) => {
              dragging = { x: event.clientX, offset };
              element.setPointerCapture?.(event.pointerId);
            },
            pointermove: (event: PointerEvent) =>
              dragging && (offset = dragging.offset - (event.clientX - dragging.x)),
            pointerup: () => (dragging = undefined),
          }
        : {}),
    }),
    listen(window, { resize: fill }),
    () => loop.destroy(),
    () => {
      element.append(...items);
      track.remove();
    },
    restore,
  );
};

export const behaviours = { velocityMarquee };
export default { behaviours } satisfies EffectModule;
