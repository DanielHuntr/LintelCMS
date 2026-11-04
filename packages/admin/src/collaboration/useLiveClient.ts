import { useOptionalSession } from "../session/SessionContext.js";
import { apiUrl } from "../api/client.js";
import { LiveClient } from "./LiveClient.js";
import { openSharedLink } from "./sharedLink.js";

/** The address of the live connection: the API's, with ws in place of http. */
export function liveAddress(api: string = apiUrl): string {
  return `${api.replace(/^http/, "ws")}/live`;
}

let current: { personId: string; client: LiveClient } | null = null;

/** For tests: the client screens use. Tests start with none, so nothing connects by itself. */
export function provideLiveClient(personId: string, client: LiveClient | null): void {
  current = client ? { personId, client } : null;
}

function startClient(personId: string): LiveClient {
  const client: LiveClient = new LiveClient((events) =>
    openSharedLink(liveAddress(), personId, () => client.pingMessage(), events),
  );
  globalThis.addEventListener?.("pagehide", () => client.close(), { once: true });
  return client;
}

/** Ends the connection, when signing out. */
export function closeLiveClient(): void {
  current?.client.close();
  current = null;
}

/** The connection for a person: the open one, or a new one once there is a person to be. */
function liveClientFor(personId: string): LiveClient | null {
  if (current?.personId === personId) return current.client;
  if (import.meta.env.MODE === "test") return null;
  closeLiveClient();
  current = { personId, client: startClient(personId) };
  return current.client;
}

/**
 * The live connection, for the person signed in. It stays open across screens, so moving from
 * the tree to a page and to its design is one connection. Null where there can't be one.
 */
export function useLiveClient(): LiveClient | null {
  const personId = useOptionalSession()?.user.id;
  if (!personId || typeof WebSocket === "undefined") return null;
  return liveClientFor(personId);
}
