import {
  clockComponent,
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  formatClockTime,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clockText, setUpClocks } from "../../site-behaviours/clock-behaviours.js";
import { resistedOffset, slowedSpeed } from "../../site-behaviours/drag-scroll.js";
import { renderPage } from "../render-page.js";
import { standardRegistry } from "../stand-in-components.js";

function page(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("e");
  const empty = createEmptyPage();
  return {
    ...empty,
    root: {
      ...empty.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, createId)),
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("the live clock", () => {
  it("is found in Insert by the words people use, and starts on London in 24 hours", () => {
    expect(clockComponent.keywords).toContain("time zone");
    expect(clockComponent.defaultProps).toEqual({ zone: "Europe/London", hours: "24", label: "" });
  });

  it("draws the place and a placeholder on the site, needing the elements script", () => {
    const rendered = renderPage(
      page({ type: "clock", props: { zone: "Asia/Tokyo" } }),
      standardRegistry,
    );
    expect(rendered.html).toContain('data-behaviour="clock"');
    expect(rendered.html).toContain('data-zone="Asia/Tokyo"');
    expect(rendered.html).toContain('<span class="lintel-clock__place">Tokyo</span>');
    expect(rendered.html).toContain(">--:--</time>");
    expect(rendered.usesBehaviours).toBe(true);
  });

  it("shows the time itself on the canvas, and the visitor's own time has no place name", () => {
    const rendered = renderPage(
      page({ type: "clock", props: { zone: "local", label: "" } }),
      standardRegistry,
      {
        mode: "canvas",
      },
    );
    expect(rendered.html).not.toContain("lintel-clock__place");
    expect(rendered.html).toMatch(/<time class="lintel-clock__time">\d{1,2}:\d{2}/);
  });

  it("reads the time as the model does, for 24 and 12 hours, and copes with an unknown zone", () => {
    const moment = new Date("2026-11-03T13:05:00Z");
    for (const hours of ["24", "12"] as const) {
      expect(clockText(moment, "America/New_York", hours, "en-GB")).toBe(
        formatClockTime(moment, "America/New_York", hours, "en-GB"),
      );
    }
    expect(clockText(moment, "Europe/London", "24", "en-GB")).toBe("13:05");
    expect(clockText(moment, "Nowhere/Atlantis", "24", "en-GB")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("fills in the time when the page loads and changes on the minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T13:05:30Z"));
    document.body.innerHTML = `<div lang="en-GB"><p data-behaviour="clock" data-zone="Europe/London" data-hours="24"><time class="lintel-clock__time">--:--</time></p></div>`;
    setUpClocks(document);
    const time = document.querySelector("time");
    expect(time?.textContent).toBe("13:05");
    vi.advanceTimersByTime(31_000);
    expect(time?.textContent).toBe("13:06");
  });
});

describe("the Slider dragged freely", () => {
  it("can be switched on, and then neither loops nor snaps", () => {
    const rendered = renderPage(
      page({ type: "carousel", props: { freeDrag: true } }),
      standardRegistry,
    );
    expect(rendered.html).toContain("lintel-carousel--free");
    expect(rendered.html).toContain('data-free-drag=""');
    expect(rendered.html).not.toContain("data-loop");
    const plain = renderPage(page({ type: "carousel" }), standardRegistry);
    expect(plain.html).not.toContain("data-free-drag");
  });

  it("gives less and less the further it's pulled past an end, never more than a little", () => {
    expect(resistedOffset(0, 800)).toBe(0);
    const small = resistedOffset(50, 800);
    const large = resistedOffset(2000, 800);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(50);
    expect(large).toBeLessThan(800 * 0.15);
    expect(resistedOffset(-50, 800)).toBe(-small);
  });

  it("slows the same at any frame rate", () => {
    const twoFrames = slowedSpeed(slowedSpeed(1, 1000 / 60), 1000 / 60);
    expect(slowedSpeed(1, 2000 / 60)).toBeCloseTo(twoFrames, 6);
  });
});
