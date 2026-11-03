import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { testsScript } from "./tests-script.js";

/**
 * The counting script as a browser runs it: what it keeps in localStorage and what it
 * reports, with Visitors' goals and with "count only after they accept".
 */

const testId = "0f6c2a8e-6a55-4b4b-9a0e-8c3c3c1a2b10";

interface Page {
  window: JSDOM["window"];
  reports: () => Promise<{ experiment: string; version: string; event: string }[]>;
  stored: () => unknown;
}

function openPage(
  settings: Record<string, unknown>,
  options: { body?: string; doNotTrack?: boolean; stored?: string; allows?: string[] } = {},
): Page {
  const sent: Blob[] = [];
  const config = JSON.stringify({ endpoint: "/_lintel/tests", ...settings });
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <template data-lintel-test="${testId}" data-lintel-version="b"></template>
      ${options.body ?? ""}
      <script type="application/json" id="lintel-tests">${config}</script>
    </body></html>`,
    {
      url: "https://bakery.test/bakery",
      runScripts: "outside-only",
      beforeParse(window) {
        Object.defineProperty(window.navigator, "sendBeacon", {
          value: (_url: string, body: Blob) => sent.push(body) > 0,
        });
        if (options.doNotTrack) {
          Object.defineProperty(window.navigator, "doNotTrack", { value: "1" });
        }
        if (options.stored) window.localStorage.setItem("lintel-tests", options.stored);
        if (options.allows) {
          const allowed = options.allows;
          Object.assign(window, {
            lintelConsent: { allows: (id: string) => allowed.includes(id) },
          });
        }
      },
    },
  );
  dom.window.eval(testsScript.code);
  return {
    window: dom.window,
    reports: async () => Promise.all(sent.map(async (blob) => JSON.parse(await blob.text()))),
    stored: () => JSON.parse(dom.window.localStorage.getItem("lintel-tests") ?? "null"),
  };
}

const formOn = (handle: string) =>
  `<form action="/_lintel/api/forms/${handle}/submissions"><button>Send</button></form>`;

function sendForm(page: Page) {
  const form = page.window.document.querySelector("form");
  form?.dispatchEvent(new page.window.CustomEvent("lintel:form-sent", { bubbles: true }));
}

describe("the A/B counting script", () => {
  it("counts a visit at once when no consent is asked for", async () => {
    const page = openPage({ tests: [{ id: testId, goal: { kind: "form" } }] });
    expect(await page.reports()).toEqual([{ experiment: testId, version: "b", event: "visit" }]);
    expect(page.stored()).toEqual({ [testId]: { v: "b" } });
  });

  it("counts a particular form Visitors knows as the goal, not any other form", async () => {
    const other = openPage(
      { tests: [{ id: testId, goal: { kind: "analytics", name: "form:contact" } }] },
      { body: formOn("newsletter") },
    );
    sendForm(other);
    expect((await other.reports()).map((report) => report.event)).toEqual(["visit"]);

    const page = openPage(
      { tests: [{ id: testId, goal: { kind: "analytics", name: "form:contact" } }] },
      { body: formOn("contact") },
    );
    sendForm(page);
    sendForm(page);
    expect((await page.reports()).map((report) => report.event)).toEqual(["visit", "conversion"]);
    expect(page.stored()).toEqual({ [testId]: { v: "b", c: 1 } });
  });

  it("counts a named event the site sends to Visitors", async () => {
    const page = openPage({ tests: [{ id: testId, goal: { kind: "analytics", name: "signup" } }] });
    const track = (name: string) =>
      page.window.document.dispatchEvent(
        new page.window.CustomEvent("lintel:track", { detail: { name } }),
      );
    track("newsletter");
    expect((await page.reports()).map((report) => report.event)).toEqual(["visit"]);
    track("signup");
    expect((await page.reports()).map((report) => report.event)).toEqual(["visit", "conversion"]);
  });

  it("stores and sends nothing until the cookie notice allows it, when asked to wait", async () => {
    const page = openPage({
      consent: "required",
      tests: [{ id: testId, goal: { kind: "form" } }],
    });
    expect(await page.reports()).toEqual([]);
    expect(page.stored()).toBeNull();

    page.window.document.dispatchEvent(
      new page.window.CustomEvent("lintel:consent", { detail: { allowed: ["youtube"] } }),
    );
    expect(await page.reports()).toEqual([]);
    page.window.document.dispatchEvent(
      new page.window.CustomEvent("lintel:consent", {
        detail: { allowed: ["plugin:experiments"] },
      }),
    );
    expect(await page.reports()).toEqual([{ experiment: testId, version: "b", event: "visit" }]);
    expect(page.stored()).toEqual({ [testId]: { v: "b" } });
  });

  it("counts at once with a choice made on an earlier visit", async () => {
    const page = openPage(
      { consent: "required", tests: [{ id: testId, goal: { kind: "form" } }] },
      { allows: ["plugin:experiments"] },
    );
    expect((await page.reports()).map((report) => report.event)).toEqual(["visit"]);
  });

  it("forgets what an earlier visit kept once the visitor turns it down", async () => {
    const page = openPage(
      { consent: "required", tests: [{ id: testId, goal: { kind: "form" } }] },
      { allows: [], stored: JSON.stringify({ [testId]: { v: "original" } }) },
    );
    page.window.dispatchEvent(new page.window.Event("load"));
    expect(page.stored()).toBeNull();
    expect(await page.reports()).toEqual([]);
  });

  it("does nothing for browsers asking not to be tracked", async () => {
    const page = openPage(
      { tests: [{ id: testId, goal: { kind: "form" } }] },
      { doNotTrack: true },
    );
    expect(await page.reports()).toEqual([]);
    expect(page.stored()).toBeNull();
  });
});
