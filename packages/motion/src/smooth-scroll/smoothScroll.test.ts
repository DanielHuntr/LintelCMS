// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { safePictureAddress } from "../effects/modules/pointer.module.js";
import {
  smoothingFor,
  startSmoothScroll,
  wheelBelongsToInnerArea,
  wheelPixels,
} from "./smoothScroll.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("smooth scrolling", () => {
  it("reads wheel steps in pixels, lines or pages", () => {
    expect(wheelPixels({ deltaY: 100, deltaMode: 0 }, 700)).toBe(100);
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 700)).toBe(48);
    expect(wheelPixels({ deltaY: -1, deltaMode: 2 }, 700)).toBe(-700);
  });

  it("glides longer when strong than when gentle", () => {
    expect(smoothingFor.strong).toBeGreaterThan(smoothingFor.gentle);
  });

  it("leaves the wheel to pop-ups and to areas marked for the browser's own scrolling", () => {
    document.body.innerHTML = `
      <div data-lintel-native-scroll><p id="inside-marked">Code</p></div>
      <dialog open><p id="inside-dialog">Hello</p></dialog>
      <div role="dialog" aria-modal="true"><p id="inside-modal">Hi</p></div>
      <p id="plain">Words</p>`;
    expect(wheelBelongsToInnerArea(document.getElementById("inside-marked"), true)).toBe(true);
    expect(wheelBelongsToInnerArea(document.getElementById("inside-dialog"), true)).toBe(true);
    expect(wheelBelongsToInnerArea(document.getElementById("inside-modal"), false)).toBe(true);
    expect(wheelBelongsToInnerArea(document.getElementById("plain"), true)).toBe(false);
  });

  it("marks the page while it is on, and takes the mark away when stopped", () => {
    const smooth = startSmoothScroll(window, { strength: "gentle" });
    expect(document.documentElement.dataset.lintelSmoothScroll).toBe("gentle");
    smooth.destroy();
    expect(document.documentElement.dataset.lintelSmoothScroll).toBeUndefined();
  });

  it("reads the page's styles once a glide, not on every wheel step", () => {
    const root = document.documentElement;
    Object.defineProperty(root, "scrollHeight", { configurable: true, value: 5000 });
    Object.defineProperty(root, "clientHeight", { configurable: true, value: 800 });
    const frames = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const smooth = startSmoothScroll(window, { strength: "gentle" });
    const read = vi.spyOn(window, "getComputedStyle");
    const wheel = (deltaY: number) => {
      const event = new WheelEvent("wheel", { deltaY, cancelable: true, bubbles: true });
      document.body.dispatchEvent(event);
      return event;
    };
    for (let step = 0; step < 5; step += 1) expect(wheel(100).defaultPrevented).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    expect(smooth.target).toBe(500);
    // Turning round checks again: something inside may scroll the other way.
    wheel(-100);
    expect(read).toHaveBeenCalledTimes(4);
    read.mockRestore();
    frames.mockRestore();
    smooth.destroy();
    Reflect.deleteProperty(root, "scrollHeight");
    Reflect.deleteProperty(root, "clientHeight");
  });

  it("doesn't take over the wheel while zooming or scrolling sideways", () => {
    const smooth = startSmoothScroll(window, { strength: "strong" });
    const zoom = new WheelEvent("wheel", { deltaY: 100, ctrlKey: true, cancelable: true });
    const sideways = new WheelEvent("wheel", { deltaX: 100, deltaY: 4, cancelable: true });
    window.dispatchEvent(zoom);
    window.dispatchEvent(sideways);
    expect(zoom.defaultPrevented).toBe(false);
    expect(sideways.defaultPrevented).toBe(false);
    smooth.destroy();
  });
});

describe("the hover picture's address", () => {
  it("keeps addresses on the site and on the web, and drops other kinds", () => {
    expect(safePictureAddress("/media/cake.jpg")).toBe("/media/cake.jpg");
    expect(safePictureAddress("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
    expect(safePictureAddress("media/cake.jpg")).toBe("media/cake.jpg");
    expect(safePictureAddress("javascript:alert(1)")).toBe("");
    expect(safePictureAddress("data:text/html,hi")).toBe("");
  });
});
