import type { EffectBehaviour } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { describeAsGroup } from "../kit/group.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";
import { setStyles } from "../kit/styles.js";
import {
  arcBend,
  arcPerspective,
  arcPlacement,
  type ArcShape,
  wrapAround,
} from "../maths/layouts-3d.js";
import { approach, clamp } from "../maths/smoothing.js";
import { VelocityTracker } from "../maths/velocity.js";

/**
 * Pictures in an endless row bent into a curve, the ones further along going back (or
 * coming round, for "around") in perspective. It drifts by itself, follows a drag, a
 * sideways wheel or trackpad swipe, and is nudged along as the page scrolls past. Arrow
 * keys step one picture; focusing a link inside brings its picture to the middle.
 *
 * The items stay in the page's order, so screen readers read them as the plain list they
 * are. With less motion asked for it is a flat row that scrolls sideways.
 */

const itemStyles = ["position", "left", "top", "margin", "transform", "opacity", "z-index"];

export const arcCarousel: EffectBehaviour = (element, params, context) => {
  const items = Array.from(element.children) as HTMLElement[];
  if (items.length < 2) return;
  if (context.reduced) {
    return setStyles(element, {
      display: "flex",
      "overflow-x": "auto",
      gap: "1rem",
      "scroll-snap-type": "x mandatory",
    });
  }
  const shape: ArcShape = readText(params, "shape", "away") === "around" ? "around" : "away";
  const speed = readNumber(params, "speed", 0.25);
  const bend = arcBend(readNumber(params, "bend", 14), items.length, shape);
  const tallest = Math.max(...items.map((item) => item.offsetHeight), 1);
  const widest = () => Math.max(...items.map((item) => item.offsetWidth), 1);
  let pitch = widest() + 16;
  const restore = setStyles(element, {
    position: getComputedStyle(element).position === "static" ? "relative" : "",
    overflow: "hidden",
    "min-height": `${Math.round(tallest * 1.25)}px`,
    perspective: `${Math.round(arcPerspective(bend, pitch, shape))}px`,
    "touch-action": "pan-y",
    "user-select": "none",
  });
  items.forEach((item) =>
    Object.assign(item.style, { position: "absolute", left: "50%", top: "50%", margin: "0" }),
  );

  let position = 0;
  let velocity = 0;
  let target: number | undefined;
  let dragging = false;
  let paused = false;
  const draw = () => {
    items.forEach((item, index) => {
      const offset = wrapAround(index - position, items.length);
      const place = arcPlacement(offset, { bend, pitch, shape });
      item.style.transform = `translate(-50%, -50%) translate3d(${place.x.toFixed(1)}px, 0, ${place.z.toFixed(1)}px) rotateY(${place.turn.toFixed(2)}deg)`;
      item.style.opacity = place.opacity.toFixed(3);
      const nearness = Math.round(Math.abs(offset) * 10);
      item.style.zIndex = String(shape === "around" ? nearness : 1000 - nearness);
    });
  };
  const loop = createFrameLoop(element, (elapsed) => {
    if (target !== undefined) {
      position = approach(position, target, 0.85, elapsed);
      if (position === target) target = undefined;
    } else if (!dragging) {
      velocity = approach(velocity, paused ? 0 : speed, 0.97, elapsed);
      position += (velocity * elapsed) / 1000;
      // Without drifting it comes to rest with a picture in the middle.
      if ((paused || speed === 0) && Math.abs(velocity) < 0.05) target = Math.round(position);
    }
    draw();
    return (
      dragging || target !== undefined || Math.abs(velocity) > 0.001 || (!paused && speed !== 0)
    );
  });
  const goTo = (index: number) => {
    target = position + wrapAround(index - position, items.length);
    loop.wake();
  };

  const tracker = new VelocityTracker(100);
  let lastX = 0;
  let lastScroll = window.scrollY;
  return combine(
    describeAsGroup(element, "carousel"),
    listen(element, {
      pointerdown: (event: PointerEvent) => {
        if (event.button !== 0) return;
        dragging = true;
        target = undefined;
        lastX = event.clientX;
        tracker.reset();
        element.setPointerCapture?.(event.pointerId);
        loop.wake();
      },
      pointermove: (event: PointerEvent) => {
        if (!dragging) return;
        position -= (event.clientX - lastX) / pitch;
        lastX = event.clientX;
        tracker.add(position, event.timeStamp);
        loop.wake();
      },
      pointerup: (event: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        velocity = clamp(tracker.velocity(event.timeStamp), -8, 8);
        loop.wake();
      },
      pointercancel: () => ((dragging = false), loop.wake()),
      pointerenter: () => (paused = true),
      pointerleave: () => ((paused = false), loop.wake()),
      wheel: (event: WheelEvent) => {
        // Only sideways swipes: an up-and-down wheel still scrolls the page.
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        target = undefined;
        position += event.deltaX / pitch;
        loop.wake();
      },
      keydown: (event: KeyboardEvent) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        goTo(Math.round(target ?? position) + (event.key === "ArrowRight" ? 1 : -1));
      },
      focusin: (event: FocusEvent) => {
        paused = true;
        const index = items.findIndex((item) => item.contains(event.target as Node));
        if (index >= 0) goTo(index);
      },
      focusout: () => ((paused = false), loop.wake()),
    }),
    listen(
      window,
      {
        scroll: () => {
          const moved = window.scrollY - lastScroll;
          lastScroll = window.scrollY;
          if (!loop.visible || dragging) return;
          position += (moved / pitch) * 0.4;
          loop.wake();
        },
        resize: () => {
          pitch = widest() + 16;
          loop.wake();
        },
      },
      { passive: true },
    ),
    () => loop.destroy(),
    () => items.forEach((item) => itemStyles.forEach((name) => item.style.removeProperty(name))),
    restore,
  );
};
