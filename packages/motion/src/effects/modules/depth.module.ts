import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { setStyles } from "../kit/styles.js";
import { approach, clamp } from "../maths/smoothing.js";
import { VelocityTracker } from "../maths/velocity.js";

/**
 * 3D with plain CSS transforms: a perspective scene, a stack of cards, a cylinder gallery,
 * a cover-flow row and flip cards. The elements stay in the page's reading order, so screen
 * readers and the keyboard meet them as ordinary content; arrow keys turn the stack and the
 * cylinder, and focusing an item brings it to the front.
 */

const perspectiveScene: EffectBehaviour = (element, params, context) => {
  const depth = readNumber(params, "depth", 80);
  const turn = context.reduced ? 0 : readNumber(params, "angle", 8);
  const layers = Array.from(element.children) as HTMLElement[];
  const restore = setStyles(element, { perspective: "1200px", "transform-style": "preserve-3d" });
  layers.forEach((layer, index) => {
    layer.style.transform = `translateZ(${(index - (layers.length - 1) / 2) * depth}px)`;
  });
  const target = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  const scene = layers[0]?.parentElement ?? element;
  const loop = createFrameLoop(element, (elapsed) => {
    eased.x = approach(eased.x, target.x, 0.9, elapsed);
    eased.y = approach(eased.y, target.y, 0.9, elapsed);
    layers.forEach((layer, index) => {
      layer.style.transform = `rotateX(${-eased.y * turn}deg) rotateY(${eased.x * turn}deg) translateZ(${(index - (layers.length - 1) / 2) * depth}px)`;
    });
    return eased.x !== target.x || eased.y !== target.y;
  });
  return combine(
    turn
      ? listen(scene, {
          pointermove: (event: PointerEvent) => {
            Object.assign(target, pointerWithin(element, event));
            loop.wake();
          },
          pointerleave: () => {
            target.x = target.y = 0;
            loop.wake();
          },
        })
      : undefined,
    () => loop.destroy(),
    () => layers.forEach((layer) => layer.style.removeProperty("transform")),
    restore,
  );
};

function describeAsGroup(element: HTMLElement, label: string) {
  const before = {
    tabIndex: element.getAttribute("tabindex"),
    role: element.getAttribute("role"),
    description: element.getAttribute("aria-roledescription"),
  };
  if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
  if (!before.role) element.setAttribute("role", "group");
  element.setAttribute("aria-roledescription", label);
  return () => {
    if (before.tabIndex === null) element.removeAttribute("tabindex");
    if (!before.role) element.removeAttribute("role");
    if (before.description === null) element.removeAttribute("aria-roledescription");
    else element.setAttribute("aria-roledescription", before.description);
  };
}

/**
 * Cards piled one on another. Click, swipe or press the arrow keys to send the top card to
 * the back; it can also turn by itself every few seconds (paused while hovered or focused).
 */
const cardStack: EffectBehaviour = (element, params, context) => {
  const cards = Array.from(element.children) as HTMLElement[];
  if (cards.length < 2) return;
  const spread = readNumber(params, "spread", 14);
  const every = readNumber(params, "autoplay", 0) * 1000;
  const restore = setStyles(element, { display: "grid", perspective: "1000px" });
  let order = cards.map((_, index) => index);
  const draw = () => {
    order.forEach((cardIndex, position) => {
      const card = cards[cardIndex]!;
      Object.assign(card.style, {
        gridArea: "1 / 1",
        zIndex: String(cards.length - position),
        transition: context.reduced
          ? "opacity 200ms"
          : "transform 500ms cubic-bezier(.2,.8,.2,1), opacity 300ms",
        transform: `translate3d(0, ${position * spread}px, ${-position * spread * 3}px) rotate(${context.reduced ? 0 : (position % 2 ? 1 : -1) * position * 1.5}deg)`,
        opacity: position > 3 ? "0" : "1",
      });
      card.inert = position !== 0;
    });
  };
  const turn = (direction = 1) => {
    order =
      direction > 0
        ? [...order.slice(1), order[0]!]
        : [order[order.length - 1]!, ...order.slice(0, -1)];
    draw();
  };
  draw();
  let pointerStart: number | undefined;
  let paused = false;
  const timer =
    every > 0 && !context.reduced ? window.setInterval(() => !paused && turn(), every) : 0;
  return combine(
    describeAsGroup(element, "card stack"),
    listen(element, {
      keydown: (event: KeyboardEvent) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") turn(1);
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") turn(-1);
        else return;
        event.preventDefault();
      },
      pointerdown: (event: PointerEvent) => (pointerStart = event.clientX),
      pointerup: (event: PointerEvent) => {
        if (pointerStart === undefined) return;
        const moved = event.clientX - pointerStart;
        pointerStart = undefined;
        if (Math.abs(moved) > 40) turn(moved < 0 ? 1 : -1);
        else if (!(event.target as Element).closest("a, button, input")) turn(1);
      },
      pointerenter: () => (paused = true),
      pointerleave: () => (paused = false),
      focusin: () => (paused = true),
      focusout: () => (paused = false),
    }),
    () => window.clearInterval(timer),
    () =>
      cards.forEach((card) => {
        card.inert = false;
        ["grid-area", "z-index", "transition", "transform", "opacity"].forEach((name) =>
          card.style.removeProperty(name),
        );
      }),
    restore,
  );
};

/**
 * Items around a turning cylinder. Drag to spin it (it carries on and slows down), use the
 * arrow keys to step, or let it turn slowly by itself. With less motion asked for it is a
 * plain row you can swipe.
 */
const cylinderGallery: EffectBehaviour = (element, params, context) => {
  const items = Array.from(element.children) as HTMLElement[];
  if (items.length < 3) return;
  if (context.reduced) {
    return setStyles(element, {
      display: "flex",
      "overflow-x": "auto",
      gap: "1rem",
      "scroll-snap-type": "x mandatory",
    });
  }
  const step = 360 / items.length;
  const speed = readNumber(params, "speed", 6);
  const tiltAngle = readNumber(params, "tilt", -6);
  const ring = document.createElement("div");
  ring.append(...items);
  element.append(ring);
  const restore = setStyles(element, {
    perspective: "1400px",
    display: "grid",
    "place-items": "center",
    overflow: "hidden",
  });
  Object.assign(ring.style, {
    transformStyle: "preserve-3d",
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
  });
  const width = () => Math.max(...items.map((item) => item.offsetWidth), 1);
  let radius = width() / 2 / Math.tan(Math.PI / items.length) + 24;
  items.forEach((item, index) => {
    Object.assign(item.style, { gridArea: "1 / 1", backfaceVisibility: "hidden" });
    item.style.transform = `rotateY(${index * step}deg) translateZ(${radius}px)`;
  });
  let angle = 0;
  let velocity = 0;
  let target: number | undefined;
  let dragging = false;
  let hovering = false;
  const tracker = new VelocityTracker(100);
  const loop = createFrameLoop(element, (elapsed) => {
    if (target !== undefined) {
      angle = approach(angle, target, 0.85, elapsed);
      if (angle === target) target = undefined;
    } else if (!dragging) {
      velocity *= Math.pow(0.94, elapsed / 16);
      if (Math.abs(velocity) < 2 && !hovering) velocity = approach(velocity, -speed, 0.97, elapsed);
      angle += (velocity * elapsed) / 1000;
    }
    ring.style.transform = `translateZ(${-radius}px) rotateX(${tiltAngle}deg) rotateY(${angle}deg)`;
    return speed !== 0 || target !== undefined || Math.abs(velocity) > 0.5 || dragging;
  });
  const bringToFront = (index: number) => {
    const goal = -index * step;
    target = angle + ((((goal - angle) % 360) + 540) % 360) - 180;
    loop.wake();
  };
  let lastX = 0;
  return combine(
    describeAsGroup(element, "gallery"),
    listen(element, {
      pointerdown: (event: PointerEvent) => {
        dragging = true;
        target = undefined;
        lastX = event.clientX;
        tracker.reset();
        element.setPointerCapture?.(event.pointerId);
      },
      pointermove: (event: PointerEvent) => {
        if (!dragging) return;
        angle += (event.clientX - lastX) * 0.3;
        lastX = event.clientX;
        tracker.add(angle, event.timeStamp);
        loop.wake();
      },
      pointerup: (event: PointerEvent) => {
        dragging = false;
        velocity = clamp(tracker.velocity(event.timeStamp), -720, 720);
        loop.wake();
      },
      pointerenter: () => (hovering = true),
      pointerleave: () => ((hovering = false), loop.wake()),
      keydown: (event: KeyboardEvent) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const current = Math.round(-angle / step);
        bringToFront(current + (event.key === "ArrowRight" ? 1 : -1));
      },
      focusin: (event: FocusEvent) => {
        const index = items.findIndex((item) => item.contains(event.target as Node));
        if (index >= 0) bringToFront(index);
      },
    }),
    listen(window, {
      resize: () => (radius = width() / 2 / Math.tan(Math.PI / items.length) + 24),
    }),
    () => loop.destroy(),
    () => {
      element.append(...items);
      ring.remove();
      items.forEach((item) =>
        ["grid-area", "backface-visibility", "transform"].forEach((name) =>
          item.style.removeProperty(name),
        ),
      );
    },
    restore,
  );
};

/** A row that scrolls normally (and snaps), its items turning away as they leave the middle. */
const coverFlow: EffectBehaviour = (element, params, context) => {
  const items = Array.from(element.children) as HTMLElement[];
  const turnAngle = context.reduced ? 0 : readNumber(params, "angle", 40);
  const restore = setStyles(element, {
    display: "flex",
    "overflow-x": "auto",
    "scroll-snap-type": "x mandatory",
    perspective: "1000px",
    "padding-inline": "35%",
    gap: "0.5rem",
  });
  items.forEach((item) => {
    item.style.scrollSnapAlign = "center";
    item.style.flex = "0 0 auto";
  });
  const draw = () => {
    const box = element.getBoundingClientRect();
    const middle = box.left + box.width / 2;
    items.forEach((item) => {
      const itemBox = item.getBoundingClientRect();
      const offset = clamp((itemBox.left + itemBox.width / 2 - middle) / (box.width / 2), -1, 1);
      item.style.transform = `rotateY(${-offset * turnAngle}deg) scale(${1 - Math.abs(offset) * 0.2})`;
      item.style.zIndex = String(100 - Math.round(Math.abs(offset) * 100));
    });
  };
  draw();
  return combine(
    listen(element, { scroll: () => requestAnimationFrame(draw) }, { passive: true }),
    listen(window, { resize: draw }),
    () =>
      items.forEach((item) =>
        ["scroll-snap-align", "flex", "transform", "z-index"].forEach((name) =>
          item.style.removeProperty(name),
        ),
      ),
    restore,
  );
};

/**
 * Turns over to show its second child. Hover and keyboard focus are handled by the page's
 * stylesheet (see the effect's static CSS), so the card works before this runs; this adds
 * flipping by click or tap, and says which side shows.
 */
const flipCard: EffectBehaviour = (element, params) => {
  if (readText(params, "trigger", "hover") !== "click") return;
  const back = element.children[1] as HTMLElement | undefined;
  const front = element.children[0] as HTMLElement | undefined;
  if (!front || !back) return;
  const set = (flipped: boolean) => {
    element.toggleAttribute("data-flipped", flipped);
    front.inert = flipped;
    back.inert = !flipped;
    element.setAttribute("aria-pressed", String(flipped));
  };
  const restoreFocus = describeAsGroup(element, "flip card");
  element.setAttribute("role", "button");
  set(false);
  return combine(
    listen(element, {
      click: (event: MouseEvent) => {
        if ((event.target as Element).closest("a, input, select, textarea")) return;
        set(!element.hasAttribute("data-flipped"));
      },
      keydown: (event: KeyboardEvent) => {
        if (event.target !== element || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        set(!element.hasAttribute("data-flipped"));
      },
    }),
    () => {
      element.removeAttribute("data-flipped");
      element.removeAttribute("aria-pressed");
      front.inert = back.inert = false;
    },
    restoreFocus,
  );
};

export const behaviours = { perspectiveScene, cardStack, cylinderGallery, coverFlow, flipCard };
export default { behaviours } satisfies EffectModule;
