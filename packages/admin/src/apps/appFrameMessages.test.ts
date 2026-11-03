import { wrapMessage } from "@lintel/app-bridge/protocol";
import { describe, expect, it } from "vitest";
import { acceptAppMessage, frameAddress, mayFrameOrigin } from "./appFrameMessages.js";

const APP = "https://stock.example.com";
const frameWindow = { name: "the app's frame" };
const frame = { origin: APP, window: frameWindow };

describe("messages from an app's frame", () => {
  it("are accepted from the app's origin and its own frame", () => {
    expect(
      acceptAppMessage(
        { data: wrapMessage({ type: "ready" }), origin: APP, source: frameWindow },
        frame,
      ),
    ).toEqual({ type: "ready" });
  });

  it("are ignored from any other origin, even with the right frame", () => {
    for (const origin of [
      "https://evil.example.com",
      "http://stock.example.com",
      "null",
      APP + ":8443",
    ]) {
      expect(
        acceptAppMessage(
          { data: wrapMessage({ type: "ready" }), origin, source: frameWindow },
          frame,
        ),
        origin,
      ).toBeUndefined();
    }
  });

  it("are ignored from another window on the same origin, such as a popup or another frame", () => {
    expect(
      acceptAppMessage(
        { data: wrapMessage({ type: "ready" }), origin: APP, source: { name: "a popup" } },
        frame,
      ),
    ).toBeUndefined();
    expect(
      acceptAppMessage(
        { data: wrapMessage({ type: "ready" }), origin: APP, source: null },
        {
          origin: APP,
          window: null,
        },
      ),
    ).toBeUndefined();
  });

  it("are ignored when they aren't bridge messages, or ask to leave the admin", () => {
    const from = { origin: APP, source: frameWindow };
    expect(acceptAppMessage({ ...from, data: { type: "ready" } }, frame)).toBeUndefined();
    expect(
      acceptAppMessage(
        { ...from, data: wrapMessage({ type: "navigate", path: "https://evil.example.com" }) },
        frame,
      ),
    ).toBeUndefined();
  });
});

describe("framing an app", () => {
  it("is refused on the admin's own origin and for addresses that aren't web pages", () => {
    expect(mayFrameOrigin(APP, "https://admin.example.com")).toBe(true);
    expect(mayFrameOrigin("https://admin.example.com", "https://admin.example.com")).toBe(false);
    expect(mayFrameOrigin("javascript:alert(1)", "https://admin.example.com")).toBe(false);
    expect(mayFrameOrigin("not an address", "https://admin.example.com")).toBe(false);
  });

  it("tells the page where it is and who to talk to, keeping the app's own query", () => {
    const address = new URL(
      frameAddress(`${APP}/widget?shop=1`, {
        extension: "widget",
        extensionId: "low-stock",
        adminOrigin: "https://admin.example.com",
      }),
    );
    expect(address.origin).toBe(APP);
    expect(Object.fromEntries(address.searchParams)).toEqual({
      shop: "1",
      lintelOrigin: "https://admin.example.com",
      extension: "widget",
      extensionId: "low-stock",
    });
  });
});
