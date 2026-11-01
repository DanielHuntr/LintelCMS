import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no Web Animations. The studio's previews only need the calls to exist.
Object.defineProperty(Element.prototype, "animate", {
  configurable: true,
  value: function animate() {
    return {
      currentTime: 0,
      playbackRate: 1,
      playState: "paused",
      finished: Promise.resolve(),
      effect: { getComputedTiming: () => ({ endTime: 0 }) },
      play: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
      finish: vi.fn(),
    };
  },
});

window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as MediaQueryList;

// jsdom has no pointer capture; drags in tests call these.
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.hasPointerCapture = () => false;

afterEach(() => cleanup());
