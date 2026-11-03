/**
 * Whether a click on this link can wait for an animation before going to the next page:
 * a plain left click on a same-site link. New tabs, downloads, anchors on the same page and
 * modified clicks are left to the browser. Used by page transitions and page-exit animations.
 */
export function isTransitionableClick(
  event: MouseEvent,
  link: HTMLAnchorElement,
  here: Location,
): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return false;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return false;
  const url = new URL(link.href, here.href);
  if (url.origin !== here.origin) return false;
  return !(url.pathname === here.pathname && url.search === here.search && url.hash !== "");
}
