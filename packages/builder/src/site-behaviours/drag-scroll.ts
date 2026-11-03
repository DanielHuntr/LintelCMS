import { prefersReducedMotion } from "./behaviour-helpers.js";

/**
 * A sideways row people can drag with a mouse: it follows the pointer, carries on with the
 * speed it was let go at and slows to a stop, and gives a little at either end before
 * springing back. Touch screens, trackpads and the wheel already scroll the row natively
 * (with their own momentum), so only a mouse or pen drag is handled here. With less motion
 * asked for, it follows the drag exactly and stops where it is let go.
 *
 * The row stays a real scrolling element, so the arrow keys, Previous and Next and the dots
 * keep working. A drag that moves more than a few pixels doesn't count as a click on a link
 * inside it.
 */

/** How much of the speed is left after 1/60 s of gliding. */
const friction = 0.95;
/** How far past an end it can be pulled, as a share of its width, at most. */
const giveAtTheEnds = 0.15;

/** Pulling past an end: the further it goes, the harder it gets. */
export function resistedOffset(beyond: number, width: number): number {
  if (width <= 0 || beyond === 0) return 0;
  const limit = width * giveAtTheEnds;
  return Math.sign(beyond) * limit * (1 - 1 / ((Math.abs(beyond) * 0.55) / limit + 1));
}

/** The speed after `elapsed` milliseconds of gliding. */
export function slowedSpeed(speed: number, elapsed: number): number {
  return speed * Math.pow(friction, elapsed / (1000 / 60));
}

export function enableDragScroll(track: HTMLElement): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startScroll = 0;
  let moved = false;
  // Set for the click that ends a drag only, so keyboard clicks are never swallowed.
  let swallowClick = false;
  let offset = 0;
  let speed = 0;
  let samples: Array<{ x: number; time: number }> = [];
  let frame = 0;
  let last = 0;

  const furthest = () => Math.max(0, track.scrollWidth - track.clientWidth);
  const setOffset = (value: number) => {
    offset = value;
    track.style.setProperty("--lintel-drag-offset", `${value.toFixed(2)}px`);
  };
  const stopGliding = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };

  const glide = (now: number) => {
    const elapsed = last ? Math.min(now - last, 64) : 16;
    last = now;
    if (speed !== 0) {
      const before = track.scrollLeft;
      track.scrollLeft = before - speed * elapsed;
      speed = slowedSpeed(speed, elapsed);
      // Ran into an end: what speed is left becomes a small bounce.
      if (track.scrollLeft === before && Math.abs(speed) > 0.05) {
        setOffset(resistedOffset(speed * 60, track.clientWidth));
        speed = 0;
      }
      if (Math.abs(speed) < 0.02) speed = 0;
    }
    if (offset !== 0) {
      const next = offset * Math.pow(0.8, elapsed / (1000 / 60));
      setOffset(Math.abs(next) < 0.5 ? 0 : next);
    }
    frame = speed !== 0 || offset !== 0 ? requestAnimationFrame(glide) : 0;
    if (!frame) last = 0;
  };

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    stopGliding();
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = track.scrollLeft;
    moved = false;
    speed = 0;
    samples = [{ x: event.clientX, time: event.timeStamp }];
  });

  track.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    const travelled = event.clientX - startX;
    if (!moved && Math.abs(travelled) < 5) return;
    if (!moved) {
      moved = true;
      track.setPointerCapture(event.pointerId);
      track.setAttribute("data-dragging", "");
    }
    const wanted = startScroll - travelled;
    const end = furthest();
    track.scrollLeft = Math.min(end, Math.max(0, wanted));
    const beyond = wanted < 0 ? -wanted : wanted > end ? end - wanted : 0;
    if (!prefersReducedMotion()) setOffset(resistedOffset(beyond, track.clientWidth));
    samples = [...samples, { x: event.clientX, time: event.timeStamp }].filter(
      (sample) => event.timeStamp - sample.time < 100,
    );
  });

  const release = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    track.removeAttribute("data-dragging");
    if (!moved) return;
    swallowClick = true;
    window.setTimeout(() => (swallowClick = false), 0);
    const first = samples[0];
    const latest = samples.at(-1);
    const span = first && latest ? latest.time - first.time : 0;
    speed =
      first && latest && span > 0 && !prefersReducedMotion() ? (latest.x - first.x) / span : 0;
    if (prefersReducedMotion()) setOffset(0);
    if (speed !== 0 || offset !== 0) frame = requestAnimationFrame(glide);
  };
  track.addEventListener("pointerup", release);
  track.addEventListener("pointercancel", release);

  // A drag isn't a click on whatever it started over.
  track.addEventListener(
    "click",
    (event) => {
      if (!swallowClick) return;
      event.preventDefault();
      event.stopPropagation();
      swallowClick = false;
    },
    true,
  );
  track.addEventListener("dragstart", (event) => event.preventDefault());
  // The wheel, keys or a swipe take over from a glide.
  track.addEventListener("wheel", stopGliding, { passive: true });
  track.addEventListener("keydown", stopGliding);
}
