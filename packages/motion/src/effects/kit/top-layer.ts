/**
 * Things that follow the pointer (the site cursor, its word, a hover picture) sit at the end
 * of the page, above everything. A modal dialog, such as the phone menu's drawer, is drawn in
 * the browser's top layer, above even that, so while one is open they are moved inside it,
 * and back out when it closes. A follower taken off the page is forgotten.
 */

const followers = new Set<HTMLElement>();
let watching: MutationObserver | undefined;

function openModal(): HTMLElement | null {
  const open = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]")).filter(
    (dialog) => dialog.matches(":modal"),
  );
  return open[open.length - 1] ?? null;
}

function place(): void {
  const host = openModal() ?? document.body;
  followers.forEach((node) => {
    if (!node.isConnected) followers.delete(node);
    else if (node.parentElement !== host) host.append(node);
  });
  if (followers.size === 0) {
    watching?.disconnect();
    watching = undefined;
  }
}

/** Adds `node` to the page, kept above any modal dialog that opens. */
export function attachAboveDialogs(node: HTMLElement): void {
  document.body.append(node);
  followers.add(node);
  place();
  if (!watching) {
    watching = new MutationObserver(place);
    watching.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  }
}
