import { useEffect, useState } from "react";

/** Below these widths of the page area, the bar gives up its words, then the switch. */
const WORDS_NEED_PX = 780;
const SWITCH_NEEDS_PX = 600;

export interface BarRoom {
  /** View page and Preview become icons, and the name stands alone without the pages above it. */
  isTight: boolean;
  /** Not even that leaves room for the view switch, so it sits just under the bar. */
  movesSwitch: boolean;
}

/**
 * How much room the page's top bar has. That depends on the page area rather than the window:
 * a laptop with the tree open has less than a big screen with it folded.
 */
export function useBarRoom(element: HTMLElement | null): BarRoom {
  const [width, setWidth] = useState(Number.POSITIVE_INFINITY);
  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { isTight: width < WORDS_NEED_PX, movesSwitch: width < SWITCH_NEEDS_PX };
}
