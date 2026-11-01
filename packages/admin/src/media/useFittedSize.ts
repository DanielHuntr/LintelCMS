import { type RefCallback, useCallback, useState } from "react";

/**
 * The largest size with the given width-to-height ratio that fits inside an element, kept
 * up to date as the element resizes. CSS alone can't size a box to an image's shape within
 * both a maximum width and a maximum height, and the focal point marker needs exactly the
 * picture's box to sit on.
 */
export function useFittedSize(
  aspectRatio: number,
): [RefCallback<HTMLElement>, { width: number; height: number } | undefined] {
  const [available, setAvailable] = useState<{ width: number; height: number }>();

  const measure = useCallback<RefCallback<HTMLElement>>((element) => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!available || available.width === 0 || available.height === 0) {
    return [measure, undefined];
  }
  const width = Math.min(available.width, available.height * aspectRatio);
  return [measure, { width, height: width / aspectRatio }];
}
