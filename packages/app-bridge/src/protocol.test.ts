import { describe, expect, it } from "vitest";
import {
  BRIDGE_PROTOCOL,
  isAdminPath,
  MAXIMUM_FRAME_HEIGHT,
  readAdminMessage,
  readAppMessage,
  wrapMessage,
} from "./protocol.js";

describe("reading an app's messages", () => {
  it("accepts each kind of message, wrapped", () => {
    expect(readAppMessage(wrapMessage({ type: "ready" }))).toEqual({ type: "ready" });
    expect(readAppMessage(wrapMessage({ type: "resize", height: 480.2 }))).toEqual({
      type: "resize",
      height: 481,
    });
    expect(
      readAppMessage({ protocol: BRIDGE_PROTOCOL, version: 1, type: "toast", message: "Hi" }),
    ).toEqual({ type: "toast", message: "Hi", tone: "neutral" });
  });

  it("ignores other scripts' messages and other versions", () => {
    expect(readAppMessage({ type: "ready" })).toBeUndefined();
    expect(
      readAppMessage({ protocol: BRIDGE_PROTOCOL, version: 2, type: "ready" }),
    ).toBeUndefined();
    expect(readAppMessage("ready")).toBeUndefined();
    expect(readAppMessage(null)).toBeUndefined();
    expect(readAppMessage({ protocol: BRIDGE_PROTOCOL, version: 1, type: "eval" })).toBeUndefined();
  });

  it("refuses sizes, toasts and tones out of bounds", () => {
    const resize = (height: unknown) => ({
      protocol: BRIDGE_PROTOCOL,
      version: 1,
      type: "resize",
      height,
    });
    expect(readAppMessage(resize(-1))).toBeUndefined();
    expect(readAppMessage(resize(Number.POSITIVE_INFINITY))).toBeUndefined();
    expect(readAppMessage(resize("100px"))).toBeUndefined();
    expect(readAppMessage(resize(1e9))).toEqual({ type: "resize", height: MAXIMUM_FRAME_HEIGHT });

    const toast = (fields: object) => ({
      protocol: BRIDGE_PROTOCOL,
      version: 1,
      type: "toast",
      ...fields,
    });
    expect(readAppMessage(toast({ message: "" }))).toBeUndefined();
    expect(readAppMessage(toast({ message: "x".repeat(201) }))).toBeUndefined();
    expect(readAppMessage(toast({ message: "Hi", tone: "<b>loud</b>" }))).toBeUndefined();
  });

  it("only lets an app open screens inside the admin", () => {
    expect(isAdminPath("/content/pages?status=draft")).toBe(true);
    for (const path of [
      "https://evil.example.com",
      "//evil.example.com",
      "/\\evil.example.com",
      "javascript:alert(1)",
      "content",
      "/content\n/pages",
      "",
    ]) {
      expect(isAdminPath(path), path).toBe(false);
      expect(readAppMessage(wrapMessage({ type: "navigate", path }))).toBeUndefined();
    }
  });
});

describe("reading the admin's messages", () => {
  const context = {
    appId: "app-1",
    extension: "panel",
    extensionId: "stock",
    user: { id: "user-1", name: "Ana" },
    theme: "dark",
    locale: "en",
    entry: { id: null, collection: "pages", slug: "", title: "" },
  } as const;

  it("accepts the context and token answers", () => {
    const message = {
      type: "context",
      context,
      sessionToken: "a.b.c",
      expiresAt: "2026-11-01T12:05:00Z",
    } as const;
    expect(readAdminMessage(wrapMessage(message))).toEqual(message);
    expect(
      readAdminMessage(
        wrapMessage({ type: "session-token-failed", requestId: "1", message: "No" }),
      ),
    ).toEqual({ type: "session-token-failed", requestId: "1", message: "No" });
  });

  it("refuses a context that is missing who is looking", () => {
    const withoutUser = { ...context, user: undefined };
    expect(
      readAdminMessage({
        protocol: BRIDGE_PROTOCOL,
        version: 1,
        type: "context",
        context: withoutUser,
        sessionToken: "a.b.c",
        expiresAt: "2026-11-01T12:05:00Z",
      }),
    ).toBeUndefined();
  });
});
