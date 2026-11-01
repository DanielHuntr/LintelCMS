import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no scrolling. TanStack Router restores the scroll position on navigation,
// so give it a no-op instead of a "not implemented" warning in every router test.
window.scrollTo = () => undefined;

// jsdom has no <dialog> behaviour. These stand-ins open and close it, which is all tests need.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
};

// The rich text editor (ProseMirror) measures text to scroll the cursor into view. jsdom
// doesn't lay anything out, so measuring returns nothing rather than throwing.
const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getClientRects = noRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();
document.elementFromPoint = () => null;

afterEach(() => cleanup());
