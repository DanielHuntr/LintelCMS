import {
  type AdminMessage,
  type AppContext,
  type AppMessage,
  readAdminMessage,
  type ToastTone,
  wrapMessage,
} from "./protocol.js";

/**
 * The app's side of the bridge. It runs in the app's page inside the Lintel admin's frame
 * and needs nothing else: no framework, no build step, any backend.
 *
 *   const lintel = createAppBridge();
 *   const { context, sessionToken } = await lintel.ready();
 *   await lintel.fetch("/api/stock");          // sends a fresh session token to your server
 *   lintel.autoResize();
 *   lintel.toast("Stock updated", { tone: "success" });
 *
 * Only messages from the Lintel admin's origin, sent by the window that embeds the page,
 * are listened to. The session token is how the app's own server knows who is looking: it
 * must verify it with the client secret before trusting anything in it.
 */

/** The parts of `window` the bridge uses, so tests can hand in their own. */
export interface BridgeWindow {
  parent: { postMessage(message: unknown, targetOrigin: string): void };
  location: { search: string };
  addEventListener(type: "message", listener: (event: BridgeMessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: BridgeMessageEvent) => void): void;
  fetch?: typeof fetch;
}

export interface BridgeMessageEvent {
  data: unknown;
  origin: string;
  source: unknown;
}

export interface AppBridgeOptions {
  /**
   * The Lintel admin's origin, like "https://admin.example.com". Defaults to the
   * `lintelOrigin` the admin adds to the frame's address. Setting it in your own code is
   * safer still: then a page that embeds yours can't choose it.
   */
  lintelOrigin?: string;
  /** How long to wait for the admin to answer. Defaults to ten seconds. */
  timeoutMilliseconds?: number;
  window?: BridgeWindow;
}

export interface ReadyResult {
  context: AppContext;
  sessionToken: string;
}

export interface AppBridge {
  /** The Lintel admin's origin this bridge talks to. */
  readonly lintelOrigin: string;
  /** Tells the admin the page is ready, and waits for who is looking and a session token. */
  ready(): Promise<ReadyResult>;
  /** A session token with at least a minute left, asking the admin for a new one if needed. */
  getSessionToken(): Promise<string>;
  /** `fetch` with `Authorization: Bearer <session token>`, for calls to the app's own server. */
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
  /** Sets the frame's height, in CSS pixels. */
  resize(height: number): void;
  /** Keeps the frame as tall as the page. Returns a function that stops it. */
  autoResize(element?: HTMLElement): () => void;
  toast(message: string, options?: { tone?: ToastTone }): void;
  /** Opens a screen of the Lintel admin, like "/content/pages". */
  navigate(path: string): void;
  /** Stops listening. */
  destroy(): void;
}

/** A token with less than this left is replaced before it is used. */
const REFRESH_BEFORE_EXPIRY_MILLISECONDS = 60_000;
const DEFAULT_TIMEOUT_MILLISECONDS = 10_000;

export class AppBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppBridgeError";
  }
}

export function createAppBridge(options: AppBridgeOptions = {}): AppBridge {
  const frameWindow = options.window ?? (window as unknown as BridgeWindow);
  const lintelOrigin = findLintelOrigin(options.lintelOrigin, frameWindow.location.search);
  const timeout = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;

  let current: { token: string; expiresAt: number } | undefined;
  let readyResult: Promise<ReadyResult> | undefined;
  let resolveReady: ((result: ReadyResult) => void) | undefined;
  const waitingForTokens = new Map<
    string,
    { resolve: (token: string) => void; reject: (error: Error) => void }
  >();
  let requestCount = 0;

  function send(message: AppMessage): void {
    // Never "*": only the Lintel admin may read what the app says.
    frameWindow.parent.postMessage(wrapMessage(message), lintelOrigin);
  }

  function receive(event: BridgeMessageEvent): void {
    if (event.origin !== lintelOrigin || event.source !== frameWindow.parent) {
      return;
    }
    const message = readAdminMessage(event.data);
    if (!message || !isMeantForThisAdmin(message, lintelOrigin)) {
      return;
    }
    handle(message);
  }

  function handle(message: AdminMessage): void {
    if (message.type === "context") {
      current = { token: message.sessionToken, expiresAt: Date.parse(message.expiresAt) };
      resolveReady?.({ context: message.context, sessionToken: message.sessionToken });
      resolveReady = undefined;
      return;
    }
    const waiting = waitingForTokens.get(message.requestId);
    if (!waiting) {
      return;
    }
    waitingForTokens.delete(message.requestId);
    if (message.type === "session-token") {
      current = { token: message.sessionToken, expiresAt: Date.parse(message.expiresAt) };
      waiting.resolve(message.sessionToken);
    } else {
      waiting.reject(new AppBridgeError(message.message));
    }
  }

  frameWindow.addEventListener("message", receive);

  function withTimeout<Value>(promise: Promise<Value>, what: string): Promise<Value> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new AppBridgeError(`The Lintel admin didn't answer (${what})`)),
        timeout,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new AppBridgeError(String(error)));
        },
      );
    });
  }

  function requestSessionToken(): Promise<string> {
    requestCount += 1;
    const requestId = `token-${requestCount}-${Date.now()}`;
    const answer = new Promise<string>((resolve, reject) => {
      waitingForTokens.set(requestId, { resolve, reject });
    });
    send({ type: "request-session-token", requestId });
    return withTimeout(answer, "a new session token").finally(() =>
      waitingForTokens.delete(requestId),
    );
  }

  const bridge: AppBridge = {
    lintelOrigin,

    ready() {
      readyResult ??= withTimeout(
        new Promise<ReadyResult>((resolve) => {
          resolveReady = resolve;
          send({ type: "ready" });
        }),
        "the page's context",
      );
      return readyResult;
    },

    async getSessionToken() {
      if (current && current.expiresAt - Date.now() > REFRESH_BEFORE_EXPIRY_MILLISECONDS) {
        return current.token;
      }
      return requestSessionToken();
    },

    async fetch(input, init = {}) {
      const token = await bridge.getSessionToken();
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${token}`);
      const send = frameWindow.fetch ?? fetch;
      return send(input, { ...init, headers });
    },

    resize(height) {
      send({ type: "resize", height: Math.max(0, Math.ceil(height)) });
    },

    autoResize(element) {
      // The body's own height, not the document's: the document is at least as tall as the
      // frame, so measuring it would let the frame grow but never shrink.
      const target = element ?? document.body;
      const report = () => {
        const style = getComputedStyle(target);
        const margins = parseFloat(style.marginTop) + parseFloat(style.marginBottom);
        bridge.resize(target.getBoundingClientRect().height + (margins || 0));
      };
      report();
      const observer = new ResizeObserver(report);
      observer.observe(target);
      return () => observer.disconnect();
    },

    toast(message, toastOptions = {}) {
      send({ type: "toast", message, tone: toastOptions.tone ?? "neutral" });
    },

    navigate(path) {
      send({ type: "navigate", path });
    },

    destroy() {
      frameWindow.removeEventListener("message", receive);
      for (const waiting of waitingForTokens.values()) {
        waiting.reject(new AppBridgeError("The bridge was closed"));
      }
      waitingForTokens.clear();
    },
  };
  return bridge;
}

function findLintelOrigin(given: string | undefined, search: string): string {
  const candidate = given ?? new URLSearchParams(search).get("lintelOrigin") ?? undefined;
  if (!candidate) {
    throw new AppBridgeError(
      "Lintel's origin is missing. Open this page from the Lintel admin, or pass lintelOrigin.",
    );
  }
  try {
    const { origin } = new URL(candidate);
    if (origin === "null") {
      throw new AppBridgeError(`${candidate} isn't a web origin`);
    }
    return origin;
  } catch (error) {
    throw error instanceof AppBridgeError
      ? error
      : new AppBridgeError(`${candidate} isn't a web origin`);
  }
}

/**
 * A session token names the admin it was made for (`dest`). One for another admin is
 * ignored here; the app's server still has to verify the signature, which is what counts.
 */
function isMeantForThisAdmin(message: AdminMessage, lintelOrigin: string): boolean {
  if (message.type === "session-token-failed") {
    return true;
  }
  return readDestination(message.sessionToken) === lintelOrigin;
}

function readDestination(token: string): string | undefined {
  const payload = token.split(".")[1];
  if (!payload) {
    return undefined;
  }
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof claims === "object" && claims !== null && "dest" in claims
      ? String(claims.dest)
      : undefined;
  } catch {
    return undefined;
  }
}
