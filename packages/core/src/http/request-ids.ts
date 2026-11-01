import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * Every request gets an id, logged with each line about it and sent back in `x-request-id`.
 * An id from a proxy in front (Caddy, a load balancer) is kept, so one request can be
 * followed through both logs; anything odd-looking is replaced, so a visitor can't put
 * arbitrary text into the logs.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestIdFor(request: IncomingMessage): string {
  const fromProxy = request.headers["x-request-id"];
  if (typeof fromProxy === "string" && SAFE_REQUEST_ID.test(fromProxy)) {
    return fromProxy;
  }
  return randomUUID();
}
