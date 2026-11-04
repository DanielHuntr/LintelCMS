import { liveCloseCodes } from "@lintel/builder-model";

export interface LinkEvents {
  /** The connection is open. Whatever the tab wants has to be said again. */
  onUp: () => void;
  /** It closed, and what that means: `offline` is still trying, `unavailable` hardly at all. */
  onDown: (status: "offline" | "unavailable" | "signedOut") => void;
  onMessage: (text: string) => void;
}

export interface LiveLink {
  send: (text: string) => void;
  close: () => void;
}

const FIRST_RETRY_MS = 1000;
const LONGEST_RETRY_MS = 30_000;
/** Blocked connections (some shared hosting) stop being tried often after this many goes. */
const TRIES_BEFORE_UNAVAILABLE = 5;
const RETRY_WHEN_UNAVAILABLE_MS = 5 * 60_000;
const PING_EVERY_MS = 20_000;
/** Longer than this without hearing anything, the connection has quietly died. */
const SILENT_FOR_MS = 45_000;

/** Waits longer after each failure, with a little randomness so browsers don't retry together. */
export function retryDelay(failures: number, random: () => number = Math.random): number {
  if (failures >= TRIES_BEFORE_UNAVAILABLE) return RETRY_WHEN_UNAVAILABLE_MS;
  const base = Math.min(LONGEST_RETRY_MS, FIRST_RETRY_MS * 2 ** failures);
  return base * (0.75 + random() * 0.5);
}

/**
 * The WebSocket itself: opens it, keeps it alive and reopens it when it drops. If it can't be
 * opened at all (a host that blocks WebSockets) it tries a few times, says `unavailable`, and
 * after that tries only now and then; nothing depends on it working.
 */
export class SocketLink implements LiveLink {
  private socket: WebSocket | null = null;
  private failures = 0;
  private retryTimer = 0;
  private pingTimer = 0;
  private lastHeard = 0;
  private isClosed = false;

  constructor(
    private readonly url: string,
    private readonly ping: () => string,
    private readonly events: LinkEvents,
  ) {
    this.open();
    globalThis.addEventListener?.("online", this.retryNow);
    globalThis.addEventListener?.("offline", this.closeNow);
  }

  send(text: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(text);
  }

  close(): void {
    this.isClosed = true;
    globalThis.removeEventListener?.("online", this.retryNow);
    globalThis.removeEventListener?.("offline", this.closeNow);
    window.clearTimeout(this.retryTimer);
    window.clearInterval(this.pingTimer);
    this.socket?.close();
  }

  /** The browser knows the network has gone, so there's no waiting for the socket to notice. */
  private readonly closeNow = () => this.socket?.close();

  private readonly retryNow = () => {
    if (this.socket || this.isClosed) return;
    window.clearTimeout(this.retryTimer);
    this.open();
  };

  private open(): void {
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.failures = 0;
      this.lastHeard = Date.now();
      this.pingTimer = window.setInterval(() => this.keepAlive(), PING_EVERY_MS);
      this.events.onUp();
    };
    socket.onmessage = (event) => {
      this.lastHeard = Date.now();
      if (typeof event.data === "string") this.events.onMessage(event.data);
    };
    socket.onclose = (event) => {
      window.clearInterval(this.pingTimer);
      this.socket = null;
      if (this.isClosed) return;
      if (event.code === liveCloseCodes.signedOut) {
        this.events.onDown("signedOut");
        return;
      }
      this.failures += 1;
      this.events.onDown(this.failures >= TRIES_BEFORE_UNAVAILABLE ? "unavailable" : "offline");
      this.scheduleRetry();
    };
  }

  private keepAlive(): void {
    if (Date.now() - this.lastHeard > SILENT_FOR_MS) {
      this.socket?.close();
      return;
    }
    this.send(this.ping());
  }

  private scheduleRetry(): void {
    this.retryTimer = window.setTimeout(() => this.open(), retryDelay(this.failures));
  }
}
