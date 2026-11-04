import { type LinkEvents, type LiveLink, SocketLink } from "./liveSocket.js";

type ChannelMessage =
  | { kind: "up" }
  | { kind: "down"; status: "offline" | "unavailable" | "signedOut" }
  | { kind: "fromServer"; text: string }
  | { kind: "toServer"; text: string }
  /** A tab has just opened and asks whether the connection is up. */
  | { kind: "isItUp" };

/**
 * One connection for the whole browser. The first tab takes a lock and opens the socket;
 * the others talk to the server through it over a BroadcastChannel. When that tab closes the
 * browser hands the lock to another, which opens the socket, and every tab says again what
 * it wants.
 *
 * Browsers without either (or a page on plain HTTP, where locks aren't offered) just open a
 * connection per tab.
 */
export function openSharedLink(
  url: string,
  /** Tabs share only with tabs signed in as the same person. */
  scope: string,
  ping: () => string,
  events: LinkEvents,
): LiveLink {
  if (typeof BroadcastChannel === "undefined" || !globalThis.navigator?.locks) {
    return new SocketLink(url, ping, events);
  }
  const channel = new BroadcastChannel(`lintel-live:${scope}`);
  const post = (message: ChannelMessage) => channel.postMessage(message);
  let socket: SocketLink | null = null;
  let isSocketUp = false;
  let giveUpLock: (() => void) | null = null;
  const stopWaitingForLock = new AbortController();

  channel.onmessage = ({ data }: MessageEvent<ChannelMessage>) => {
    if (socket) {
      if (data.kind === "toServer") socket.send(data.text);
      if (data.kind === "isItUp" && isSocketUp) post({ kind: "up" });
      return;
    }
    if (data.kind === "up") events.onUp();
    if (data.kind === "down") events.onDown(data.status);
    if (data.kind === "fromServer") events.onMessage(data.text);
  };

  void navigator.locks
    .request(`lintel-live:${scope}`, { signal: stopWaitingForLock.signal }, () => {
      socket = new SocketLink(url, ping, {
        onUp: () => {
          isSocketUp = true;
          post({ kind: "up" });
          events.onUp();
        },
        onDown: (status) => {
          isSocketUp = false;
          post({ kind: "down", status });
          events.onDown(status);
        },
        onMessage: (text) => {
          post({ kind: "fromServer", text });
          events.onMessage(text);
        },
      });
      return new Promise<void>((resolve) => {
        giveUpLock = resolve;
      });
    })
    .catch(() => undefined);
  post({ kind: "isItUp" });

  return {
    send: (text) => (socket ? socket.send(text) : post({ kind: "toServer", text })),
    close: () => {
      stopWaitingForLock.abort();
      if (socket) post({ kind: "down", status: "offline" });
      socket?.close();
      giveUpLock?.();
      channel.close();
    },
  };
}
