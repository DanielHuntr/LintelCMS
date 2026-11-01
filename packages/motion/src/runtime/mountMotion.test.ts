// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findPreset } from "../presets/index.js";
import { defineMotion } from "../spec/motion.schema.js";
import { cloakAttribute, mountMotion } from "./mountMotion.js";
import { mountMotionList } from "./mountMotionList.js";

/*
 * jsdom has no Web Animations, so these tests record what the runtime asks for.
 * The browser tests (src/browser-tests) check what actually happens on screen.
 */

interface RecordedAnimation {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  calls: string[];
}

let recorded: RecordedAnimation[] = [];

function fakeAnimate(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  const record: RecordedAnimation = { element: this, keyframes, options, calls: [] };
  recorded.push(record);
  const animation = {
    currentTime: 0,
    playbackRate: 1,
    playState: "paused",
    finished: Promise.resolve(),
    effect: { getComputedTiming: () => ({ endTime: Number(options.duration ?? 0) }) },
    // Pretend some time passes once it plays, so reversing has somewhere to go.
    play: () => {
      record.calls.push("play");
      animation.currentTime = 100;
    },
    pause: () => record.calls.push("pause"),
    cancel: () => record.calls.push("cancel"),
    finish: () => record.calls.push("finish"),
  };
  return animation;
}

beforeEach(() => {
  recorded = [];
  Object.defineProperty(Element.prototype, "animate", { value: fakeAnimate, configurable: true });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

const fadeUp = findPreset("fade-up")!.spec;

describe("mounting an animation", () => {
  it("creates paused animations showing the first keyframe, then uncloaks", () => {
    document.body.innerHTML = `<div id="card" ${cloakAttribute}></div>`;
    const card = document.getElementById("card")!;
    mountMotion(card, { ...fadeUp, trigger: { type: "hover", onLeave: "reverse" } });
    expect(recorded.map((animation) => Object.keys(animation.keyframes[0]!))).toEqual([
      ["offset", "easing", "opacity"],
      ["offset", "easing", "translate"],
    ]);
    expect(recorded[0]?.options).toMatchObject({ fill: "both", duration: 700, easing: "linear" });
    expect(recorded[0]?.calls).toEqual(["pause"]);
    expect(card.hasAttribute(cloakAttribute)).toBe(false);
  });

  it("plays on hover and reverses when the pointer leaves", () => {
    const card = document.createElement("div");
    mountMotion(card, { ...fadeUp, trigger: { type: "hover", onLeave: "reverse" } });
    card.dispatchEvent(new Event("pointerenter"));
    card.dispatchEvent(new Event("pointerleave"));
    expect(recorded[0]?.calls).toEqual(["pause", "play", "play"]);
  });

  it("staggers split words and restores the text when destroyed", () => {
    document.body.innerHTML = `<h1 id="title">Hello there world</h1>`;
    const title = document.getElementById("title")!;
    const controller = mountMotion(title, findPreset("words-rise")!.spec);
    const delays = recorded
      .filter((animation) => "opacity" in animation.keyframes[0]!)
      .map((animation) => animation.options.delay);
    expect(delays).toEqual([0, 70, 140]);
    expect(controller.span).toBe(140 + 700);
    controller.destroy();
    expect(title.innerHTML).toBe("Hello there world");
  });

  it("listens to nothing in manual mode, so a preview can seek", () => {
    const card = document.createElement("div");
    const controller = mountMotion(
      card,
      { ...fadeUp, trigger: { type: "load" } },
      { mode: "manual" },
    );
    expect(recorded[0]?.calls).toEqual(["pause"]);
    controller.seek(0.5);
    expect(recorded[0]?.calls).toEqual(["pause", "pause"]);
  });

  it("plays the reduced version, or nothing at all", () => {
    const card = document.createElement("div");
    const controller = mountMotion(card, fadeUp, { reducedMotion: "reduce" });
    expect(controller.reduced).toBe(true);
    expect(recorded.map((animation) => Object.keys(animation.keyframes[0]!)[2])).toEqual([
      "opacity",
    ]);
    recorded = [];
    mountMotion(card, { ...fadeUp, reducedMotion: "none" }, { reducedMotion: "reduce" });
    expect(recorded).toEqual([]);
  });

  it("repeats forever and swings back and forth when asked", () => {
    const spec = defineMotion({ ...fadeUp, repeat: { times: "forever", yoyo: true } });
    mountMotion(document.createElement("div"), spec);
    expect(recorded[0]?.options).toMatchObject({ iterations: Infinity, direction: "alternate" });
  });
});

describe("mounting a page", () => {
  it("finds nodes by id and waits for page exits", async () => {
    document.body.innerHTML = `<main data-node-id="page"></main><p data-node-id="intro"></p>`;
    const page = mountMotionList([
      { nodeId: "page", spec: findPreset("page-fade-out")!.spec },
      { nodeId: "intro", spec: fadeUp },
      { nodeId: "gone", spec: fadeUp },
    ]);
    expect(page.controllers).toHaveLength(2);
    await page.exitPage();
    const exit = recorded.find(
      (animation) => animation.element.getAttribute("data-node-id") === "page",
    );
    expect(exit?.calls).toContain("play");
    page.destroy();
    expect(exit?.calls.at(-1)).toBe("cancel");
  });
});
