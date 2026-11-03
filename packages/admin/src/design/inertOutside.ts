/**
 * Makes everything on the page except `element` (and what holds it) inert, as a modal
 * dialog does: Tab, clicks and screen readers stay inside it. Returns a function that puts
 * the page back, leaving alone anything that was inert already.
 */
export function inertOutside(element: HTMLElement): () => void {
  const madeInert: Element[] = [];
  let inside: Element = element;
  while (inside.parentElement && inside !== document.body) {
    for (const sibling of inside.parentElement.children) {
      if (sibling === inside || sibling.hasAttribute("inert")) continue;
      if (sibling instanceof HTMLScriptElement || sibling instanceof HTMLStyleElement) continue;
      sibling.setAttribute("inert", "");
      madeInert.push(sibling);
    }
    inside = inside.parentElement;
  }
  return () => {
    for (const each of madeInert) each.removeAttribute("inert");
  };
}
