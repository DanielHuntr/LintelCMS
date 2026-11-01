/** Small helpers for the styles behaviours add, so every one can be taken away again. */

/** Adds a stylesheet to the page once, however many elements use it. */
export function addStyleOnce(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}

/** Sets inline styles and returns a function that puts back what was there. */
export function setStyles(element: HTMLElement, styles: Record<string, string>): () => void {
  const before = Object.keys(styles).map((name) => [name, element.style.getPropertyValue(name)]);
  for (const [name, value] of Object.entries(styles)) element.style.setProperty(name, value);
  return () => {
    for (const [name, value] of before) {
      if (value) element.style.setProperty(name as string, value as string);
      else element.style.removeProperty(name as string);
    }
  };
}

/** A layer laid over (or under) an element without changing its layout. */
export function addOverlay(element: HTMLElement, tagName: "div" | "canvas" = "div", under = false) {
  const restore =
    getComputedStyle(element).position === "static"
      ? setStyles(element, { position: "relative" })
      : () => undefined;
  const overlay = document.createElement(tagName);
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: under ? "0" : "2",
    borderRadius: "inherit",
  });
  if (under) element.prepend(overlay);
  else element.append(overlay);
  return {
    overlay,
    remove: () => {
      overlay.remove();
      restore();
    },
  };
}
