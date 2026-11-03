import { useEffect, useState } from "react";

/** Below this the bar can't hold the name, the switch and the buttons on one line. */
const SWITCH_NEEDS_PX = 620;

/**
 * Whether the page area is too narrow for the view switch in the top bar, however the room was
 * lost: a phone, or a laptop with the tree open. Then the switch sits just under the bar.
 */
export function useIsBarTight(element: HTMLElement | null): boolean {
  const [isTight, setIsTight] = useState(false);
  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setIsTight(entry.contentRect.width < SWITCH_NEEDS_PX);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return isTight;
}
