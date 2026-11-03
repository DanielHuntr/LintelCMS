import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { analyticsScript } from "./analytics-script.js";

/**
 * The Visitors beacon as a browser runs it: the A/B test version it tags a page view with,
 * the `lintel:track` event tests listen for, and waiting for the cookie notice.
 */

const testId = "0f6c2a8e-6a55-4b4b-9a0e-8c3c3c1a2b10";

function openPage(options: { marker?: string; consent?: boolean; doNotTrack?: boolean } = {}) {
  const sent: Record<string, unknown>[] = [];
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body>${options.marker ?? ""}</body></html>`,
    {
      url: "https://bakery.test/bakery",
      runScripts: "dangerously",
      beforeParse(window) {
        Object.defineProperty(window.navigator, "sendBeacon", {
          value: (_url: string, body: string) => sent.push(JSON.parse(body)) > 0,
        });
        if (options.doNotTrack) {
          Object.defineProperty(window.navigator, "doNotTrack", { value: "1" });
        }
      },
    },
  );
  const { document } = dom.window;
  // Run as a real <script> element, so `document.currentScript` and its data work.
  const element = document.createElement("script");
  element.setAttribute("data-site", "default");
  if (options.consent) element.setAttribute("data-consent", "required");
  element.textContent = analyticsScript;
  document.head.append(element);
  return { window: dom.window, sent };
}

const marker = (version: string) =>
  `<template data-lintel-test="${testId}" data-lintel-version="${version}"></template>`;

describe("the Visitors beacon", () => {
  it("tags the page view with the A/B test version the page shows", () => {
    const page = openPage({ marker: marker("b") });
    expect(page.sent).toEqual([
      expect.objectContaining({ kind: "view", experiment: testId, version: "b" }),
    ]);
  });

  it("tags nothing on a page without a test", () => {
    const page = openPage();
    expect(page.sent[0]).toMatchObject({ kind: "view" });
    expect(page.sent[0]).not.toHaveProperty("experiment");
  });

  it("tells the page's other scripts about a named event", () => {
    const page = openPage();
    const heard: string[] = [];
    page.window.document.addEventListener("lintel:track", (event) => {
      heard.push((event as CustomEvent<{ name: string }>).detail.name);
    });
    const lintelAnalytics = (
      page.window as unknown as { lintelAnalytics: { track(n: string): void } }
    ).lintelAnalytics;
    lintelAnalytics.track("signup");
    expect(heard).toEqual(["signup"]);
    expect(page.sent.at(-1)).toMatchObject({ kind: "custom", name: "signup" });
  });

  it("counts nobody until the cookie notice allows Visitor counts, when asked to wait", () => {
    const page = openPage({ consent: true, marker: marker("original") });
    expect(page.sent).toEqual([]);
    page.window.document.dispatchEvent(
      new page.window.CustomEvent("lintel:consent", {
        detail: { allowed: ["plugin:experiments"] },
      }),
    );
    expect(page.sent).toEqual([]);
    page.window.document.dispatchEvent(
      new page.window.CustomEvent("lintel:consent", { detail: { allowed: ["plugin:analytics"] } }),
    );
    expect(page.sent).toEqual([
      expect.objectContaining({ kind: "view", experiment: testId, version: "original" }),
    ]);
  });

  it("sends nothing, not even a tag, for browsers asking not to be tracked", () => {
    const page = openPage({ marker: marker("b"), doNotTrack: true });
    expect(page.sent).toEqual([]);
  });
});
