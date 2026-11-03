/**
 * Makes an element one stop for the keyboard, announced as a group of its own kind ("card
 * stack", "gallery"), so arrow keys can move through what is inside. Returns how to undo it.
 */
export function describeAsGroup(element: HTMLElement, label: string) {
  const before = {
    tabIndex: element.getAttribute("tabindex"),
    role: element.getAttribute("role"),
    description: element.getAttribute("aria-roledescription"),
  };
  if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
  if (!before.role) element.setAttribute("role", "group");
  element.setAttribute("aria-roledescription", label);
  return () => {
    if (before.tabIndex === null) element.removeAttribute("tabindex");
    if (!before.role) element.removeAttribute("role");
    if (before.description === null) element.removeAttribute("aria-roledescription");
    else element.setAttribute("aria-roledescription", before.description);
  };
}
