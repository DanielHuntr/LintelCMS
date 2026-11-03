import { type AppMessage, readAppMessage } from "@lintel/app-bridge/protocol";
import type { ExtensionKind } from "@lintel/app-bridge";

/**
 * The admin's side of the frame's conversation, kept apart from React so each check can be
 * tested on its own.
 */

/** What a message event carries that matters here. */
export interface IncomingMessage {
  data: unknown;
  origin: string;
  source: unknown;
}

/**
 * A message from the app's frame, or undefined for anything else. All three must hold: it
 * comes from the app's own origin, from this frame's window (not another app's frame or a
 * popup), and it is a well-formed bridge message.
 */
export function acceptAppMessage(
  event: IncomingMessage,
  frame: { origin: string; window: unknown },
): AppMessage | undefined {
  if (frame.window === null || frame.window === undefined) {
    return undefined;
  }
  if (event.origin !== frame.origin || event.source !== frame.window) {
    return undefined;
  }
  return readAppMessage(event.data);
}

/**
 * Whether the admin may frame this origin. The server already refuses apps on Lintel's own
 * addresses; this is the same rule again where the sandbox is applied, because a frame with
 * `allow-same-origin` on the admin's own origin could undo its sandbox.
 */
export function mayFrameOrigin(appOrigin: string, adminOrigin: string): boolean {
  try {
    const { protocol, origin } = new URL(appOrigin);
    return (protocol === "https:" || protocol === "http:") && origin !== adminOrigin;
  } catch {
    return false;
  }
}

/**
 * The frame's address: the app's own, plus where it is shown and the admin's origin, which
 * `@lintel/app-bridge` reads to know whom to talk to.
 */
export function frameAddress(
  url: string,
  where: { extension: ExtensionKind; extensionId?: string; adminOrigin: string },
): string {
  const address = new URL(url);
  address.searchParams.set("lintelOrigin", where.adminOrigin);
  address.searchParams.set("extension", where.extension);
  if (where.extensionId) {
    address.searchParams.set("extensionId", where.extensionId);
  }
  return address.href;
}

/**
 * The sandbox for every app frame. Scripts and forms run, and `allow-same-origin` lets the
 * app keep its own cookies and storage (it is never the admin's origin). Popups may open,
 * so "Connect your account" flows work, but the frame can't navigate the admin itself
 * (`allow-top-navigation` is left out): it asks through the bridge instead.
 */
export const APP_FRAME_SANDBOX = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-downloads",
].join(" ");

/** The shortest a frame gets, so a page that never reports its height is still usable. */
export const MINIMUM_FRAME_HEIGHT = 80;
