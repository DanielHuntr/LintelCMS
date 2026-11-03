/** Where a pointer is over an element, from -1 (left or top edge) to 1 (right or bottom). */
export function pointerWithin(
  element: Element,
  event: { clientX: number; clientY: number },
): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return {
    x: box.width ? ((event.clientX - box.left) / box.width) * 2 - 1 : 0,
    y: box.height ? ((event.clientY - box.top) / box.height) * 2 - 1 : 0,
  };
}

/** How far through the screen an element is: 0 entering at the bottom, 1 leaving at the top. */
export function progressThroughScreen(element: Element): number {
  const box = element.getBoundingClientRect();
  const travel = window.innerHeight + box.height;
  return travel > 0 ? Math.min(1, Math.max(0, (window.innerHeight - box.top) / travel)) : 0;
}

/**
 * An embedded frame (a YouTube or Vimeo player, a map) keeps the pointer's events to
 * itself: once the pointer is over one, the page no longer hears where it is.
 */
export function isEmbeddedFrame(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLIFrameElement ||
    target instanceof HTMLEmbedElement ||
    target instanceof HTMLObjectElement
  );
}

/** Whether the pointer is over an embedded frame, such as on entering an element filled by one. */
export function pointerOnFrame(event: { clientX: number; clientY: number }): boolean {
  return isEmbeddedFrame(document.elementFromPoint(event.clientX, event.clientY));
}

/**
 * Calls `onEnter` when the pointer moves onto an embedded frame and `onReturn` (with the
 * event, whose target is where it came back to) when it is back on the page, so anything
 * that follows the pointer can step aside rather than freeze on top of the frame.
 */
export function watchEmbeddedFrames(handlers: {
  onEnter: () => void;
  onReturn?: (event: PointerEvent) => void;
}): () => void {
  let overFrame = false;
  const over = (event: PointerEvent) => {
    if (isEmbeddedFrame(event.target)) {
      overFrame = true;
      handlers.onEnter();
    } else if (overFrame) {
      overFrame = false;
      handlers.onReturn?.(event);
    }
  };
  document.addEventListener("pointerover", over, { passive: true });
  return () => document.removeEventListener("pointerover", over);
}
