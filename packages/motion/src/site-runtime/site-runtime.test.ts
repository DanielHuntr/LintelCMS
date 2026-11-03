// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mountMotionList } from "../runtime/mountMotionList.js";
import { playExitsBeforeLeaving, readPageAnimations, installSiteRuntime } from "./site-runtime.js";

describe("the site runtime", () => {
  it("reads the page's animations, and nothing when the list is missing or broken", () => {
    document.body.innerHTML = `<script type="application/json" id="lintel-motion">[{"nodeId":"a1","spec":{}}]</script>`;
    expect(readPageAnimations(document)).toEqual([{ nodeId: "a1", spec: {} }]);
    document.body.innerHTML = `<script type="application/json" id="lintel-motion">not json</script>`;
    expect(readPageAnimations(document)).toEqual([]);
    document.body.innerHTML = "";
    expect(readPageAnimations(document)).toEqual([]);
  });

  it("makes the runtime available to the builder's canvas", () => {
    installSiteRuntime(window);
    expect(typeof window.lintelMotion?.mountMotion).toBe("function");
  });

  it("knows when a page has animations for leaving it", () => {
    document.body.innerHTML = `<h1 data-node-id="title">Hello</h1>`;
    const spec = (type: "load" | "pageExit") => ({
      trigger: { type },
      timeline: { tracks: [] },
    });
    const leaving = mountMotionList([{ nodeId: "title", spec: spec("pageExit") }] as never);
    const arriving = mountMotionList([{ nodeId: "title", spec: spec("load") }] as never);
    expect(leaving.hasPageExits).toBe(true);
    expect(arriving.hasPageExits).toBe(false);
    leaving.destroy();
    arriving.destroy();
  });

  // LINTEL-FUNC-020: exit animations only played when a page transition asked for them.
  it("plays the exit animations on a same-site link click, then goes to the link", async () => {
    document.body.innerHTML = `
      <a id="inside" href="https://bakery.test/menu"><span>Menu</span></a>
      <a id="outside" href="https://example.com/">Elsewhere</a>
      <a id="tab" href="https://bakery.test/about" target="_blank">About</a>`;
    const target = new EventTarget();
    const location = {
      href: "https://bakery.test/",
      origin: "https://bakery.test",
      pathname: "/",
      search: "",
    };
    const fakeWindow = {
      location,
      addEventListener: target.addEventListener.bind(target),
      setTimeout: (run: () => void, wait: number) => setTimeout(run, wait),
    } as unknown as Window;
    let finishExits = () => {};
    const exitPage = vi.fn(() => new Promise<void>((resolve) => (finishExits = resolve)));
    playExitsBeforeLeaving(fakeWindow, { exitPage, resetPageExits: () => undefined });
    const click = (id: string, selector = `#${id}`) => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(event, "target", { value: document.querySelector(selector) });
      target.dispatchEvent(event);
      return event;
    };

    expect(click("outside").defaultPrevented).toBe(false);
    expect(click("tab").defaultPrevented).toBe(false);
    expect(exitPage).not.toHaveBeenCalled();

    expect(click("inside", "#inside span").defaultPrevented).toBe(true);
    expect(exitPage).toHaveBeenCalledTimes(1);
    expect(location.href).toBe("https://bakery.test/");
    finishExits();
    await vi.waitFor(() => expect(location.href).toBe("https://bakery.test/menu"));
  });

  it("leaves a click a page transition has already taken to the transition", () => {
    document.body.innerHTML = `<a id="inside" href="https://bakery.test/menu">Menu</a>`;
    const target = new EventTarget();
    const fakeWindow = {
      location: {
        href: "https://bakery.test/",
        origin: "https://bakery.test",
        pathname: "/",
        search: "",
      },
      addEventListener: target.addEventListener.bind(target),
      setTimeout,
    } as unknown as Window;
    const exitPage = vi.fn(() => Promise.resolve());
    playExitsBeforeLeaving(fakeWindow, { exitPage, resetPageExits: () => undefined });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(event, "target", { value: document.querySelector("#inside") });
    event.preventDefault();
    target.dispatchEvent(event);
    expect(exitPage).not.toHaveBeenCalled();
  });
});
