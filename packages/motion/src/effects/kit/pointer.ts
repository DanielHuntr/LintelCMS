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
