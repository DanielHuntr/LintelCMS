import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readSwitch, readText } from "../kit/params.js";
import { addStyleOnce, setStyles } from "../kit/styles.js";
import {
  capThrow,
  createBody,
  keepInside,
  type PlaygroundBody,
  playgroundFeels,
  type PlaygroundWorld,
  stepWorld,
} from "../maths/playground.js";
import { VelocityTracker } from "../maths/velocity.js";

/**
 * "Let visitors drag and throw these": a container's items (stickers, cards, badges) can be
 * picked up, thrown, bumped into each other and, with gravity, left in a pile. Items start
 * where the design put them and every move is a `translate`, so the page's layout never
 * changes and a reload puts everything back.
 *
 * Only the items stop the page scrolling under a finger; the container's empty space still
 * scrolls. Arrow keys move the focused item (Shift for further), and "Tidy up" puts
 * everything back. With less motion asked for, nothing moves: the layout stays as designed.
 */

const keyboardStep = 24;
const quietFramesBeforeRest = 20;
const tidySmoothing = 10;

const tidyCss = `
.lintel-tidy-up{position:absolute;right:.75rem;bottom:.75rem;z-index:3;padding:.4rem .9rem;border:1px solid var(--lintel-color-border,#d4d4d4);border-radius:999px;background:var(--lintel-color-background,#fff);color:var(--lintel-color-text,#111);font:inherit;font-size:.875rem;cursor:pointer}
.lintel-tidy-up[hidden]{display:none}`;

interface Item {
  element: HTMLElement;
  body: PlaygroundBody;
  homeLeft: number;
  homeTop: number;
}

function readItems(container: HTMLElement): Item[] {
  const box = container.getBoundingClientRect();
  return [...container.children]
    .filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        !child.hasAttribute("data-lintel-tidy") &&
        child.getClientRects().length > 0,
    )
    .map((element) => {
      const own = element.getBoundingClientRect();
      const left = own.left - box.left - container.clientLeft;
      const top = own.top - box.top - container.clientTop;
      return {
        element,
        body: createBody(left, top, own.width, own.height),
        homeLeft: left,
        homeTop: top,
      };
    });
}

const dragPlayground: EffectBehaviour = (container, params, context) => {
  if (context.reduced) return;
  const feel = playgroundFeels[readText(params, "feel", "drift")] ?? playgroundFeels.drift!;
  const world: PlaygroundWorld = {
    width: container.clientWidth,
    height: container.clientHeight,
    ...feel,
    bodies: [],
  };
  let items: Item[] = [];
  const draw = (item: Item) => {
    const x = item.body.left - item.homeLeft;
    const y = item.body.top - item.homeTop;
    item.element.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    item.element.style.rotate = item.body.tilt ? `${item.body.tilt.toFixed(2)}deg` : "";
  };
  let tidying = false;
  let quiet = 0;
  const loop = createFrameLoop(container, (elapsed) => {
    let moving = false;
    if (tidying) {
      const share = 1 - Math.exp(-tidySmoothing * (elapsed / 1000));
      for (const { body, homeLeft, homeTop } of items) {
        body.left += (homeLeft - body.left) * share;
        body.top += (homeTop - body.top) * share;
        body.tilt += (0 - body.tilt) * share;
        if (Math.hypot(body.left - homeLeft, body.top - homeTop) > 0.5) moving = true;
        else Object.assign(body, { left: homeLeft, top: homeTop, tilt: 0 });
      }
      tidying = moving;
    } else {
      moving = stepWorld(world, elapsed / 1000);
    }
    items.forEach(draw);
    quiet = moving ? 0 : quiet + 1;
    return quiet < quietFramesBeforeRest;
  });

  const restoreContainer = setStyles(
    container,
    getComputedStyle(container).position === "static" ? { position: "relative" } : {},
  );
  let tidyButton: HTMLButtonElement | undefined;
  const showTidyButton = () => {
    if (tidyButton) tidyButton.hidden = false;
  };
  if (readSwitch(params, "tidyButton", true)) {
    addStyleOnce("lintel-tidy-up-style", tidyCss);
    tidyButton = document.createElement("button");
    tidyButton.type = "button";
    tidyButton.className = "lintel-tidy-up";
    tidyButton.setAttribute("data-lintel-tidy", "");
    tidyButton.textContent = readText(params, "tidyLabel", "Tidy up") || "Tidy up";
    tidyButton.hidden = true;
    tidyButton.addEventListener("click", () => {
      for (const { body } of items)
        Object.assign(body, { pinned: true, velocityX: 0, velocityY: 0 });
      tidying = true;
      loop.wake();
    });
    container.append(tidyButton);
  }

  const restores: Array<() => void> = [];
  const setUp = () => {
    restores.splice(0).forEach((restore) => restore());
    items.forEach((item) => {
      item.element.style.translate = "";
      item.element.style.rotate = "";
    });
    items = readItems(container);
    world.width = container.clientWidth;
    world.height = container.clientHeight;
    world.bodies = items.map((item) => item.body);
    for (const item of items) {
      // Floating items stay where the design put them until someone moves them.
      item.body.pinned = feel.gravity === 0;
      keepInside(world, item.body);
      const own = item.element;
      restores.push(
        setStyles(own, {
          "touch-action": "none",
          "user-select": "none",
          cursor: "grab",
          "will-change": "translate, rotate",
        }),
      );
      if (!own.hasAttribute("tabindex") && own.tabIndex < 0) {
        own.tabIndex = 0;
        restores.push(() => own.removeAttribute("tabindex"));
      }
      if (!own.hasAttribute("aria-roledescription")) {
        own.setAttribute("aria-roledescription", "draggable");
        restores.push(() => own.removeAttribute("aria-roledescription"));
      }
    }
    loop.wake();
  };
  setUp();

  const itemFor = (target: EventTarget | null) =>
    items.find((item) => target instanceof Node && item.element.contains(target));
  let drag:
    { item: Item; offsetX: number; offsetY: number; moved: boolean; pointerId: number } | undefined;
  let draggedJustNow = false;
  const trackers = { x: new VelocityTracker(), y: new VelocityTracker() };
  const box = () => container.getBoundingClientRect();
  const handlers = {
    pointerdown: (event: PointerEvent) => {
      const item = itemFor(event.target);
      if (!item || event.button !== 0 || tidying) return;
      const bounds = box();
      drag = {
        item,
        offsetX: event.clientX - bounds.left - item.body.left,
        offsetY: event.clientY - bounds.top - item.body.top,
        moved: false,
        pointerId: event.pointerId,
      };
      // Everything wakes on the first touch: floating and tidied items move again.
      for (const { body } of items) body.pinned = false;
      Object.assign(item.body, { held: true, velocityX: 0, velocityY: 0 });
      // A pointer the browser has already let go of can't be captured; the drag still works.
      try {
        item.element.setPointerCapture?.(event.pointerId);
      } catch {
        // Nothing to do.
      }
      item.element.style.cursor = "grabbing";
      item.element.style.zIndex = "2";
      trackers.x.reset();
      trackers.y.reset();
      loop.wake();
    },
    pointermove: (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const bounds = box();
      const { body } = drag.item;
      const left = event.clientX - bounds.left - drag.offsetX;
      const top = event.clientY - bounds.top - drag.offsetY;
      if (Math.hypot(left - body.left, top - body.top) > 3) drag.moved = true;
      body.left = left;
      body.top = top;
      keepInside(world, body);
      trackers.x.add(body.left, event.timeStamp);
      trackers.y.add(body.top, event.timeStamp);
      if (drag.moved) showTidyButton();
      loop.wake();
    },
    pointerup: (event: PointerEvent) => release(event),
    pointercancel: (event: PointerEvent) => release(event),
    dragstart: (event: DragEvent) => {
      if (itemFor(event.target)) event.preventDefault();
    },
    keydown: (event: KeyboardEvent) => {
      const item = items.find((candidate) => candidate.element === event.target);
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const move = moves[event.key];
      if (!item || !move) return;
      event.preventDefault();
      const distance = keyboardStep * (event.shiftKey ? 4 : 1);
      Object.assign(item.body, {
        pinned: true,
        velocityX: 0,
        velocityY: 0,
        left: item.body.left + move[0] * distance,
        top: item.body.top + move[1] * distance,
      });
      keepInside(world, item.body);
      showTidyButton();
      loop.wake();
    },
  };
  const release = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { item, moved } = drag;
    drag = undefined;
    const [velocityX, velocityY] = capThrow(
      trackers.x.velocity(event.timeStamp),
      trackers.y.velocity(event.timeStamp),
    );
    Object.assign(item.body, { held: false, velocityX, velocityY });
    item.element.style.cursor = "grab";
    item.element.style.zIndex = "";
    draggedJustNow = moved;
    loop.wake();
  };
  // A link or button inside a thrown sticker shouldn't also be followed when it lands.
  const swallowClick = (event: MouseEvent) => {
    if (draggedJustNow && itemFor(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
    draggedJustNow = false;
  };
  const resize =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (
            Math.abs(container.clientWidth - world.width) > 1 ||
            Math.abs(container.clientHeight - world.height) > 1
          )
            setUp();
        })
      : undefined;
  resize?.observe(container);

  return combine(
    listen(container, handlers),
    listen(container, { click: swallowClick }, { capture: true }),
    () => {
      resize?.disconnect();
      loop.destroy();
      restores.splice(0).forEach((restore) => restore());
      for (const { element } of items) {
        element.style.translate = "";
        element.style.rotate = "";
        element.style.zIndex = "";
      }
      tidyButton?.remove();
      restoreContainer();
    },
  );
};

export const behaviours: EffectModule["behaviours"] = { dragPlayground };
