import { approach } from "../effects/maths/smoothing.js";

/**
 * Smooth scrolling for a whole page: the mouse wheel's steps become one soft, weighted glide.
 *
 * It moves the page's real scroll position a little each frame rather than faking it with a
 * transform, so everything that reads the scroll position stays in step on its own: the
 * scrollbar, `position: sticky`, scroll triggers and scroll scenes (in script or in the
 * browser's own scroll timelines), find in page and links to a part of the page. Only the
 * wheel is taken over. Keys, the scrollbar, touch and jumps made by the page or the browser
 * scroll as usual, and the glide simply starts again from wherever they leave the page.
 *
 * The wheel is left alone over anything that scrolls by itself (a list, a code box, a map),
 * while a key is held for zooming or sideways scrolling, inside a pop-up, and anywhere marked
 * `data-lintel-native-scroll`. People who ask for less motion get the browser's own
 * scrolling, even if they change the setting while the page is open.
 */

export type SmoothScrollStrength = "gentle" | "strong";

/** How much of the distance is still to go after 1/60 s: higher glides for longer. */
export const smoothingFor: Record<SmoothScrollStrength, number> = {
  gentle: 0.87,
  strong: 0.93,
};

export interface SmoothScrollOptions {
  strength: SmoothScrollStrength;
}

export interface SmoothScroll {
  /** Where the glide is heading, in pixels from the top. */
  readonly target: number;
  /** Stops it and gives the wheel back to the browser. */
  destroy(): void;
}

/** Wheel steps in pixels, whatever unit the device reports them in. */
export function wheelPixels(event: Pick<WheelEvent, "deltaY" | "deltaMode">, page: number) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * page;
  return event.deltaY;
}

const scrollsByItself = /(auto|scroll|overlay)/;

/**
 * Whether something between the wheel and the page should scroll instead: an element that
 * scrolls on its own and still has room to go that way, a pop-up, or a marked area.
 */
export function wheelBelongsToInnerArea(start: EventTarget | null, downwards: boolean): boolean {
  let element = start instanceof Element ? start : null;
  while (element && element !== document.body && element !== document.documentElement) {
    if (
      element.hasAttribute("data-lintel-native-scroll") ||
      (element instanceof HTMLDialogElement && element.open) ||
      element.getAttribute("aria-modal") === "true"
    ) {
      return true;
    }
    if (element.scrollHeight > element.clientHeight + 1) {
      const overflow = getComputedStyle(element).overflowY;
      if (scrollsByItself.test(overflow)) {
        const roomLeft = downwards
          ? element.scrollTop + element.clientHeight < element.scrollHeight - 1
          : element.scrollTop > 0;
        if (roomLeft) return true;
      }
    }
    element = element.parentElement;
  }
  return false;
}

/** The page can't scroll at all: a pop-up or menu has locked it. */
function pageIsLocked(view: Window): boolean {
  const { documentElement, body } = view.document;
  const hidden = (element: Element) => getComputedStyle(element).overflowY === "hidden";
  return hidden(documentElement) || (body !== null && hidden(body));
}

export function startSmoothScroll(view: Window, options: SmoothScrollOptions): SmoothScroll {
  const root = view.document.documentElement;
  const reducedQuery = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const smoothing = smoothingFor[options.strength];
  let current = view.scrollY;
  let target = current;
  // The last position this wrote, to tell its own scrolling from anyone else's.
  let written = current;
  let frame = 0;
  let last = 0;
  // While a glide runs, the wheel's steps keep landing on the same element: it belongs to
  // the page until the glide ends, or the wheel moves to another element or turns round. So
  // the styles of the page and the element's ancestors are read once a glide, not on every
  // step (a click or key, as when a pop-up opens, ends the glide).
  let glideTarget: EventTarget | null = null;

  const furthest = () => Math.max(0, root.scrollHeight - root.clientHeight);
  const stop = () => {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    glideTarget = null;
    root.removeAttribute("data-lintel-gliding");
  };
  const adoptPagePosition = () => {
    stop();
    current = target = written = view.scrollY;
  };

  const step = (now: number) => {
    frame = 0;
    // Keys, the scrollbar or the page itself moved it since the last frame: let them have it.
    if (Math.abs(view.scrollY - written) > 2) {
      adoptPagePosition();
      return;
    }
    const elapsed = last ? Math.min(now - last, 64) : 16;
    last = now;
    current = approach(current, target, smoothing, elapsed);
    if (Math.abs(current - target) < 0.5) current = target;
    view.scrollTo({ top: current, behavior: "instant" });
    written = view.scrollY;
    if (current === target) {
      stop();
      return;
    }
    frame = view.requestAnimationFrame(step);
  };

  const onWheel = (event: WheelEvent) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
      event.deltaY === 0 ||
      reducedQuery?.matches === true
    ) {
      return;
    }
    const downwards = event.deltaY > 0;
    const sameAsGlide = frame && glideTarget === event.target && downwards === target > current;
    if (!sameAsGlide && (wheelBelongsToInnerArea(event.target, downwards) || pageIsLocked(view))) {
      return;
    }
    event.preventDefault();
    if (!frame) current = target = written = view.scrollY;
    target = Math.min(
      furthest(),
      Math.max(0, target + wheelPixels(event, root.clientHeight * 0.9)),
    );
    if (!frame && target !== current) {
      root.setAttribute("data-lintel-gliding", "");
      frame = view.requestAnimationFrame(step);
    }
    if (frame) glideTarget = event.target;
  };

  const onScroll = () => {
    if (!frame) current = target = written = view.scrollY;
  };
  // A click, a key or a pinch takes over from the glide straight away.
  const onTakeOver = () => {
    if (frame) adoptPagePosition();
  };
  const onReducedChange = () => {
    if (reducedQuery?.matches) adoptPagePosition();
  };

  view.addEventListener("wheel", onWheel, { passive: false });
  view.addEventListener("scroll", onScroll, { passive: true });
  view.addEventListener("pointerdown", onTakeOver, { passive: true });
  view.addEventListener("keydown", onTakeOver);
  view.addEventListener("hashchange", adoptPagePosition);
  reducedQuery?.addEventListener?.("change", onReducedChange);
  root.setAttribute("data-lintel-smooth-scroll", options.strength);

  return {
    get target() {
      return target;
    },
    destroy() {
      stop();
      view.removeEventListener("wheel", onWheel);
      view.removeEventListener("scroll", onScroll);
      view.removeEventListener("pointerdown", onTakeOver);
      view.removeEventListener("keydown", onTakeOver);
      view.removeEventListener("hashchange", adoptPagePosition);
      reducedQuery?.removeEventListener?.("change", onReducedChange);
      root.removeAttribute("data-lintel-smooth-scroll");
    },
  };
}
