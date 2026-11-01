import { afterEach, describe, expect, it } from "vitest";
import {
  type AppBridge,
  createAppBridge,
  type BridgeMessageEvent,
  type BridgeWindow,
} from "./app-bridge.js";
import { type AdminMessage, readAppMessage, wrapMessage } from "./protocol.js";

const LINTEL = "https://admin.example.com";

/** A session token as the admin would pass it; the bridge only reads `dest` from it. */
function tokenFor(dest: string): string {
  const payload = btoa(JSON.stringify({ dest, sub: "user-1" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

const context = {
  appId: "app-1",
  extension: "page",
  user: { id: "user-1", name: "Ana" },
  theme: "light",
  locale: "en",
} as const;

/** A frame's window whose parent records what the app sends. */
function fakeFrame(search = `?lintelOrigin=${encodeURIComponent(LINTEL)}`) {
  const sent: Array<{ message: unknown; targetOrigin: string }> = [];
  const listeners = new Set<(event: BridgeMessageEvent) => void>();
  const parent = {
    postMessage: (message: unknown, targetOrigin: string) => sent.push({ message, targetOrigin }),
  };
  const frameWindow: BridgeWindow = {
    parent,
    location: { search },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  return {
    frameWindow,
    sent,
    parent,
    /** A message arriving at the frame. */
    deliver(message: AdminMessage, from: { origin?: string; source?: unknown } = {}) {
      for (const listener of listeners) {
        listener({
          data: wrapMessage(message),
          origin: from.origin ?? LINTEL,
          source: from.source ?? parent,
        });
      }
    },
    listenerCount: () => listeners.size,
  };
}

describe("createAppBridge", () => {
  let bridge: AppBridge | undefined;
  afterEach(() => bridge?.destroy());

  it("says it is ready, only to the Lintel admin, and receives the context and a token", async () => {
    const frame = fakeFrame();
    bridge = createAppBridge({ window: frame.frameWindow });

    const ready = bridge.ready();
    expect(frame.sent).toEqual([{ message: wrapMessage({ type: "ready" }), targetOrigin: LINTEL }]);
    const sessionToken = tokenFor(LINTEL);
    frame.deliver({ type: "context", context, sessionToken, expiresAt: inMinutes(5) });

    await expect(ready).resolves.toEqual({ context, sessionToken });
    await expect(bridge.getSessionToken()).resolves.toBe(sessionToken);
  });

  it("ignores messages from other origins, other windows, and tokens for another admin", async () => {
    const frame = fakeFrame();
    bridge = createAppBridge({ window: frame.frameWindow, timeoutMilliseconds: 50 });
    const ready = bridge.ready();

    const message = {
      type: "context",
      context,
      sessionToken: tokenFor(LINTEL),
      expiresAt: inMinutes(5),
    } as const;
    frame.deliver(message, { origin: "https://evil.example.com" });
    frame.deliver(message, { source: { postMessage: () => undefined } });
    frame.deliver({ ...message, sessionToken: tokenFor("https://evil.example.com") });

    await expect(ready).rejects.toThrow("didn't answer");
  });

  it("asks for a new session token when the one it has is about to run out", async () => {
    const frame = fakeFrame();
    bridge = createAppBridge({ window: frame.frameWindow });
    const ready = bridge.ready();
    frame.deliver({
      type: "context",
      context,
      sessionToken: tokenFor(LINTEL),
      expiresAt: inMinutes(0.5),
    });
    await ready;

    const fresh = bridge.getSessionToken();
    const request = readAppMessage(frame.sent.at(-1)?.message);
    expect(request?.type).toBe("request-session-token");
    const requestId = request?.type === "request-session-token" ? request.requestId : "";
    const newToken = `${tokenFor(LINTEL)}2`;
    frame.deliver({
      type: "session-token",
      requestId,
      sessionToken: newToken,
      expiresAt: inMinutes(5),
    });

    await expect(fresh).resolves.toBe(newToken);
  });

  it("passes on the admin's reason when no token can be had", async () => {
    const frame = fakeFrame();
    bridge = createAppBridge({ window: frame.frameWindow });

    const fresh = bridge.getSessionToken();
    const request = readAppMessage(frame.sent.at(-1)?.message);
    const requestId = request?.type === "request-session-token" ? request.requestId : "";
    frame.deliver({ type: "session-token-failed", requestId, message: "You were signed out" });

    await expect(fresh).rejects.toThrow("You were signed out");
  });

  it("sends the session token to the app's own server with fetch", async () => {
    const frame = fakeFrame();
    const calls: Array<{ input: string | URL | Request; init: RequestInit | undefined }> = [];
    frame.frameWindow.fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response("{}");
    };
    bridge = createAppBridge({ window: frame.frameWindow });
    const ready = bridge.ready();
    const sessionToken = tokenFor(LINTEL);
    frame.deliver({ type: "context", context, sessionToken, expiresAt: inMinutes(5) });
    await ready;

    await bridge.fetch("/api/stock", { method: "POST" });

    expect(calls[0]?.input).toBe("/api/stock");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(
      `Bearer ${sessionToken}`,
    );
  });

  it("resizes, shows toasts and opens admin screens", () => {
    const frame = fakeFrame();
    bridge = createAppBridge({ window: frame.frameWindow });

    bridge.resize(321.4);
    bridge.toast("Saved", { tone: "success" });
    bridge.navigate("/content/pages");

    expect(frame.sent.map((sent) => readAppMessage(sent.message))).toEqual([
      { type: "resize", height: 322 },
      { type: "toast", message: "Saved", tone: "success" },
      { type: "navigate", path: "/content/pages" },
    ]);
    expect(frame.sent.every((sent) => sent.targetOrigin === LINTEL)).toBe(true);
  });

  it("needs to know Lintel's origin, and stops listening when destroyed", () => {
    expect(() => createAppBridge({ window: fakeFrame("").frameWindow })).toThrow(
      "Lintel's origin is missing",
    );
    expect(() =>
      createAppBridge({ window: fakeFrame("?lintelOrigin=javascript:alert(1)").frameWindow }),
    ).toThrow("isn't a web origin");

    const frame = fakeFrame();
    const own = createAppBridge({ window: frame.frameWindow, lintelOrigin: `${LINTEL}/some/path` });
    expect(own.lintelOrigin).toBe(LINTEL);
    own.destroy();
    expect(frame.listenerCount()).toBe(0);
  });
});

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
