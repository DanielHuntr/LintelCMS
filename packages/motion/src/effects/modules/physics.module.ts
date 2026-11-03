import { inertia, spring } from "motion";
import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";
import { setStyles } from "../kit/styles.js";
import { clamp } from "../maths/smoothing.js";
import { VelocityTracker } from "../maths/velocity.js";

/**
 * Things that feel physical: dragging with momentum and snapping, springy toggles and
 * presses, pull-to-reveal, a jelly wobble and a before/after slider that glides. The spring
 * and momentum curves come from the `motion` library's value generators (MIT), which are
 * small and well tested; everything else is ours.
 *
 * Every draggable also moves by keyboard (arrow keys, Enter and Space), touch works like a
 * mouse, and with less motion asked for things move straight to where they end up.
 */

interface Generator {
  next: (time: number) => { value: number; done: boolean };
}

/** Plays a generator frame by frame; returns a function that stops it early. */
function play(generator: Generator, onValue: (value: number) => void, onDone?: () => void) {
  let frame = 0;
  const started = performance.now();
  const step = (now: number) => {
    const { value, done } = generator.next(now - started);
    onValue(value);
    if (done) onDone?.();
    else frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

function springTo(
  from: number,
  to: number,
  velocity: number,
  onValue: (value: number) => void,
  bounce = 0.35,
  reduced = false,
) {
  if (reduced) {
    onValue(to);
    return () => undefined;
  }
  return play(spring({ keyframes: [from, to], velocity, bounce, visualDuration: 0.45 }), onValue);
}

function makeFocusable(element: HTMLElement, label: string) {
  const hadTabIndex = element.hasAttribute("tabindex");
  if (!hadTabIndex) element.tabIndex = 0;
  if (!element.hasAttribute("aria-roledescription"))
    element.setAttribute("aria-roledescription", label);
  return () => {
    if (!hadTabIndex) element.removeAttribute("tabindex");
    element.removeAttribute("aria-roledescription");
  };
}

/**
 * Drag it anywhere inside its parent; let go and it carries on, slows down and, if asked,
 * snaps to a grid or springs back home. Arrow keys move it too.
 */
const dragMomentum: EffectBehaviour = (element, params, context) => {
  const axis = readText(params, "axis", "both");
  const snap = readText(params, "snap", "none");
  const grid = readNumber(params, "grid", 80);
  const position = { x: 0, y: 0 };
  const draw = () => (element.style.translate = `${position.x}px ${position.y}px`);
  const restore = setStyles(element, {
    "touch-action": "none",
    cursor: "grab",
    "user-select": "none",
  });
  const bounds = () => {
    const parent = element.parentElement?.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    if (!parent) return { x: [-Infinity, Infinity], y: [-Infinity, Infinity] };
    return {
      x: [position.x + parent.left - own.left, position.x + parent.right - own.right],
      y: [position.y + parent.top - own.top, position.y + parent.bottom - own.bottom],
    };
  };
  const stops: Array<() => void> = [];
  const stopAll = () => stops.splice(0).forEach((stop) => stop());
  const settle = (key: "x" | "y", velocity: number, range: number[]) => {
    const [min = -Infinity, max = Infinity] = range;
    const update = (value: number) => ((position[key] = value), draw());
    if (snap === "home")
      return stops.push(springTo(position[key], 0, velocity, update, 0.3, context.reduced));
    if (context.reduced) {
      update(
        clamp(snap === "grid" ? Math.round(position[key] / grid) * grid : position[key], min, max),
      );
      return;
    }
    stops.push(
      play(
        inertia({
          keyframes: [position[key]],
          velocity,
          min,
          max,
          power: 0.6,
          timeConstant: 320,
          bounceStiffness: 300,
          bounceDamping: 30,
          modifyTarget:
            snap === "grid" ? (target: number) => Math.round(target / grid) * grid : undefined,
        }),
        update,
      ),
    );
  };
  const trackers = { x: new VelocityTracker(), y: new VelocityTracker() };
  let start: { x: number; y: number; pointerX: number; pointerY: number } | undefined;
  return combine(
    makeFocusable(element, "draggable"),
    listen(element, {
      pointerdown: (event: PointerEvent) => {
        stopAll();
        start = { x: position.x, y: position.y, pointerX: event.clientX, pointerY: event.clientY };
        trackers.x.reset();
        trackers.y.reset();
        element.setPointerCapture?.(event.pointerId);
        element.style.cursor = "grabbing";
      },
      pointermove: (event: PointerEvent) => {
        if (!start) return;
        if (axis !== "y") position.x = start.x + event.clientX - start.pointerX;
        if (axis !== "x") position.y = start.y + event.clientY - start.pointerY;
        trackers.x.add(position.x, event.timeStamp);
        trackers.y.add(position.y, event.timeStamp);
        draw();
      },
      pointerup: (event: PointerEvent) => {
        if (!start) return;
        start = undefined;
        element.style.cursor = "grab";
        const range = bounds();
        if (axis !== "y") settle("x", trackers.x.velocity(event.timeStamp), range.x);
        if (axis !== "x") settle("y", trackers.y.velocity(event.timeStamp), range.y);
      },
      keydown: (event: KeyboardEvent) => {
        const distance = event.shiftKey ? grid : grid / 4;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-distance, 0],
          ArrowRight: [distance, 0],
          ArrowUp: [0, -distance],
          ArrowDown: [0, distance],
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        stopAll();
        const range = bounds();
        if (axis !== "y")
          position.x = clamp(position.x + move[0], range.x[0] ?? -Infinity, range.x[1] ?? Infinity);
        if (axis !== "x")
          position.y = clamp(position.y + move[1], range.y[0] ?? -Infinity, range.y[1] ?? Infinity);
        draw();
      },
    }),
    stopAll,
    () => element.style.removeProperty("translate"),
    restore,
  );
};

/** Drag it and it stretches; let go and it springs back where it was. */
const elasticDrag: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const give = readNumber(params, "give", 0.35);
  let start: { x: number; y: number } | undefined;
  const offset = { x: 0, y: 0 };
  const draw = () => (element.style.translate = `${offset.x}px ${offset.y}px`);
  let stops: Array<() => void> = [];
  const restore = setStyles(element, { "touch-action": "none" });
  return combine(
    listen(element, {
      pointerdown: (event: PointerEvent) => {
        stops.forEach((stop) => stop());
        start = { x: event.clientX - offset.x / give, y: event.clientY - offset.y / give };
        element.setPointerCapture?.(event.pointerId);
      },
      pointermove: (event: PointerEvent) => {
        if (!start) return;
        offset.x = (event.clientX - start.x) * give;
        offset.y = (event.clientY - start.y) * give;
        draw();
      },
      pointerup: () => {
        start = undefined;
        stops = [
          springTo(offset.x, 0, 0, (value) => ((offset.x = value), draw()), 0.5),
          springTo(offset.y, 0, 0, (value) => ((offset.y = value), draw()), 0.5),
        ];
      },
    }),
    () => stops.forEach((stop) => stop()),
    () => element.style.removeProperty("translate"),
    restore,
  );
};

/**
 * A switch that springs: clicking (or Enter and Space) turns it on and off, and its first
 * child, the knob, slides across with a little overshoot. Announced as a switch.
 */
const springToggle: EffectBehaviour = (element, _params, context) => {
  const knob = element.firstElementChild as HTMLElement | null;
  const hadRole = element.getAttribute("role");
  if (!hadRole) element.setAttribute("role", "switch");
  const hadTabIndex = element.hasAttribute("tabindex");
  if (!hadTabIndex && !(element instanceof HTMLButtonElement)) element.tabIndex = 0;
  let on = element.getAttribute("aria-checked") === "true";
  let stop = () => undefined as void;
  const travel = () => (knob ? element.clientWidth - knob.offsetWidth - 2 * knob.offsetLeft : 0);
  const set = (next: boolean) => {
    on = next;
    element.setAttribute("aria-checked", String(on));
    element.toggleAttribute("data-on", on);
    if (!knob) return;
    stop();
    const from = Number.parseFloat(knob.style.translate) || 0;
    stop = springTo(
      from,
      on ? travel() : 0,
      0,
      (value) => (knob.style.translate = `${value}px 0`),
      0.45,
      context.reduced,
    );
  };
  set(on);
  return combine(
    listen(element, {
      click: () => set(!on),
      keydown: (event: KeyboardEvent) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        set(!on);
      },
    }),
    () => stop(),
    () => {
      knob?.style.removeProperty("translate");
      if (!hadRole) element.removeAttribute("role");
      if (!hadTabIndex) element.removeAttribute("tabindex");
    },
  );
};

/** Squashes a little when pressed (pointer, Enter or Space) and bounces back. */
const springPress: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const depth = readNumber(params, "depth", 0.92);
  let scale = 1;
  let stop = () => undefined as void;
  const to = (target: number, bounce: number) => {
    stop();
    stop = springTo(
      scale,
      target,
      0,
      (value) => ((scale = value), (element.style.scale = String(value))),
      bounce,
    );
  };
  return combine(
    listen(element, {
      pointerdown: () => to(depth, 0.2),
      pointerup: () => to(1, 0.6),
      pointerleave: () => scale !== 1 && to(1, 0.6),
      keydown: (event: KeyboardEvent) =>
        (event.key === " " || event.key === "Enter") && !event.repeat && to(depth, 0.2),
      keyup: (event: KeyboardEvent) => (event.key === " " || event.key === "Enter") && to(1, 0.6),
    }),
    () => stop(),
    () => element.style.removeProperty("scale"),
  );
};

/** Wobbles like jelly when the pointer arrives or it gets focus. */
const jellyWobble: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const amount = readNumber(params, "amount", 0.12);
  let stop = () => undefined as void;
  const wobble = () => {
    stop();
    stop = play(
      spring({ keyframes: [0, 0], velocity: amount * 40, stiffness: 400, damping: 6 }),
      (value) => {
        element.style.scale = `${1 + value} ${1 - value}`;
      },
    );
  };
  return combine(
    listen(element, { pointerenter: wobble, focusin: wobble }),
    () => stop(),
    () => element.style.removeProperty("scale"),
  );
};

/**
 * Pull it (down, or to the left) to uncover what sits behind; past half way it stays open.
 * Enter or Space opens and closes it too.
 */
const pullToReveal: EffectBehaviour = (element, params, context) => {
  const horizontal = readText(params, "direction", "down") === "left";
  const distance = readNumber(params, "distance", 120);
  let offset = 0;
  let open = false;
  let start: number | undefined;
  let stop = () => undefined as void;
  const draw = (value: number) => {
    offset = value;
    element.style.translate = horizontal ? `${-value}px 0` : `0 ${value}px`;
  };
  const settle = (velocity: number) => {
    open = offset > distance / 2 || velocity > 500;
    element.setAttribute("aria-expanded", String(open));
    stop = springTo(offset, open ? distance : 0, velocity, draw, 0.3, context.reduced);
  };
  const restore = setStyles(element, {
    "touch-action": horizontal ? "pan-y" : "pan-x",
    position: "relative",
    "z-index": "1",
  });
  const tracker = new VelocityTracker();
  return combine(
    makeFocusable(element, "pull to reveal"),
    listen(element, {
      pointerdown: (event: PointerEvent) => {
        stop();
        start = (horizontal ? -event.clientX : event.clientY) - offset;
        tracker.reset();
        element.setPointerCapture?.(event.pointerId);
      },
      pointermove: (event: PointerEvent) => {
        if (start === undefined) return;
        const raw = (horizontal ? -event.clientX : event.clientY) - start;
        const pulled = raw <= distance ? Math.max(0, raw) : distance + (raw - distance) * 0.2;
        tracker.add(pulled, event.timeStamp);
        draw(pulled);
      },
      pointerup: (event: PointerEvent) => {
        if (start === undefined) return;
        start = undefined;
        settle(tracker.velocity(event.timeStamp));
      },
      keydown: (event: KeyboardEvent) => {
        if (event.target !== element || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        stop();
        offset = open ? 0 : distance;
        settle(0);
      },
    }),
    () => stop(),
    () => (element.style.removeProperty("translate"), element.removeAttribute("aria-expanded")),
    restore,
  );
};

/** For the before/after picture: the divider glides on after you let go, and settles. */
const glidingSlider: EffectBehaviour = (element, _params, context) => {
  const range = element.querySelector<HTMLInputElement>("input[type='range']");
  if (!range || context.reduced) return;
  const tracker = new VelocityTracker();
  let stop = () => undefined as void;
  const set = (value: number) => {
    range.value = String(value);
    range.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return combine(
    listen(range, {
      pointerdown: () => (stop(), tracker.reset()),
      input: (event: Event) => event.isTrusted && tracker.add(Number(range.value), event.timeStamp),
      pointerup: (event: PointerEvent) => {
        const velocity = tracker.velocity(event.timeStamp);
        if (Math.abs(velocity) < 20) return;
        stop = play(
          inertia({
            keyframes: [Number(range.value)],
            velocity,
            min: Number(range.min || 0),
            max: Number(range.max || 100),
            power: 0.4,
            timeConstant: 250,
            bounceStiffness: 400,
            bounceDamping: 25,
          }),
          (value) => set(Math.round(value * 10) / 10),
        );
      },
    }),
    () => stop(),
  );
};

/**
 * A round menu: its button (the first one inside) fans the links out in a circle with a
 * springy stagger. Enter or Space opens it, Escape closes it and returns focus, and the
 * arrow keys move round the links. Closed, the links are out of the tab order.
 */
const radialMenu: EffectBehaviour = (element, params, context) => {
  const toggle = element.querySelector<HTMLButtonElement>("button");
  const links = Array.from(element.querySelectorAll<HTMLElement>("li > a, li > button"));
  if (!toggle || links.length === 0) return;
  const radius = readNumber(params, "radius", 96);
  const spread = readNumber(params, "spread", 180);
  const restore = setStyles(element, { position: "relative" });
  const items = links.map((link) => link.parentElement as HTMLElement);
  items.forEach((item) =>
    Object.assign(item.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      translate: "-50% -50%",
      opacity: "0",
      pointerEvents: "none",
    }),
  );
  let open = false;
  let stops: Array<() => void> = [];
  const place = (item: HTMLElement, index: number, amount: number) => {
    const angle =
      ((-90 - spread / 2 + (spread * index) / Math.max(1, items.length - 1)) * Math.PI) / 180;
    item.style.transform = `translate(${Math.cos(angle) * radius * amount}px, ${Math.sin(angle) * radius * amount}px) scale(${0.4 + 0.6 * amount})`;
    item.style.opacity = String(Math.min(1, Math.max(0, amount)));
  };
  const set = (next: boolean, focusFirst = false) => {
    open = next;
    toggle.setAttribute("aria-expanded", String(open));
    stops.forEach((stop) => stop());
    stops = items.map((item, index) => {
      item.style.pointerEvents = open ? "auto" : "none";
      links[index]!.tabIndex = open ? 0 : -1;
      const from = Number.parseFloat(item.style.opacity) || 0;
      const update = (value: number) => place(item, index, value);
      if (context.reduced) {
        update(open ? 1 : 0);
        return () => undefined;
      }
      let stopSpring = () => undefined as void;
      const timer = window.setTimeout(
        () => (stopSpring = springTo(from, open ? 1 : 0, 0, update, 0.4)),
        open ? index * 40 : 0,
      );
      return () => (window.clearTimeout(timer), stopSpring());
    });
    if (open && focusFirst) links[0]?.focus();
  };
  set(false);
  return combine(
    listen(toggle, { click: () => set(!open) }),
    listen(element, {
      keydown: (event: KeyboardEvent) => {
        const at = links.indexOf(document.activeElement as HTMLElement);
        if (event.key === "Escape" && open) {
          set(false);
          toggle.focus();
        } else if (open && at >= 0 && (event.key === "ArrowRight" || event.key === "ArrowDown")) {
          event.preventDefault();
          links[(at + 1) % links.length]?.focus();
        } else if (open && at >= 0 && (event.key === "ArrowLeft" || event.key === "ArrowUp")) {
          event.preventDefault();
          links[(at - 1 + links.length) % links.length]?.focus();
        }
      },
      focusout: (event: FocusEvent) =>
        !element.contains(event.relatedTarget as Node) && open && set(false),
    }),
    () => stops.forEach((stop) => stop()),
    () => {
      items.forEach((item) =>
        ["position", "left", "top", "translate", "opacity", "pointer-events", "transform"].forEach(
          (name) => item.style.removeProperty(name),
        ),
      );
      links.forEach((link) => link.removeAttribute("tabindex"));
    },
    restore,
  );
};

/**
 * A sliding underline for tabs: it glides (and stretches) to whichever tab is chosen, by
 * pointer or keyboard. Works on any tab list inside the element.
 */
const tabSlider: EffectBehaviour = (element, params, context) => {
  const list = element.querySelector<HTMLElement>("[role='tablist']");
  if (!list) return;
  const restore = setStyles(list, { position: "relative" });
  const bar = document.createElement("span");
  bar.setAttribute("aria-hidden", "true");
  Object.assign(bar.style, {
    position: "absolute",
    bottom: "0",
    left: "0",
    height: `${readNumber(params, "thickness", 3)}px`,
    borderRadius: "999px",
    background: readText(params, "colour", "currentColor"),
    pointerEvents: "none",
  });
  list.append(bar);
  let x = 0;
  let width = 0;
  let stops: Array<() => void> = [];
  const draw = () => {
    bar.style.transform = `translateX(${x}px)`;
    bar.style.width = `${width}px`;
  };
  const move = () => {
    const tab = list.querySelector<HTMLElement>("[role='tab'][aria-selected='true']");
    if (!tab) return;
    const targetX = tab.offsetLeft;
    const targetWidth = tab.offsetWidth;
    stops.forEach((stop) => stop());
    stops = [
      springTo(
        x,
        targetX,
        0,
        (value) => ((x = value), draw()),
        0.2,
        context.reduced || width === 0,
      ),
      springTo(
        width,
        targetWidth,
        0,
        (value) => ((width = value), draw()),
        0.1,
        context.reduced || width === 0,
      ),
    ];
  };
  move();
  const observer = new MutationObserver(move);
  observer.observe(list, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
  return combine(
    listen(window, { resize: move }),
    () => observer.disconnect(),
    () => stops.forEach((stop) => stop()),
    () => bar.remove(),
    restore,
  );
};

export const behaviours = {
  radialMenu,
  tabSlider,
  dragMomentum,
  elasticDrag,
  springToggle,
  springPress,
  jellyWobble,
  pullToReveal,
  glidingSlider,
};
export default { behaviours } satisfies EffectModule;
