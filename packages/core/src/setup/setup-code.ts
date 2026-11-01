import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

/**
 * Until the first user exists, the setup endpoints are open to anyone who can reach the
 * server. That is fine on your own computer, but on a public server a stranger could get
 * there first. So setup from anywhere other than this computer needs a one-time code,
 * which is printed in the terminal where Lintel runs: only the person who started it
 * can see it.
 */
export const SETUP_CODE_HEADER = "x-lintel-setup-code";

/** Eight digits, shown as "4821-0937". With the setup rate limit, guessing is hopeless. */
export function generateSetupCode(): string {
  const digits = String(randomInt(0, 100_000_000)).padStart(8, "0");
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/**
 * Compares in constant time, so response times don't reveal how many digits were right.
 * Spaces and dashes are ignored, so "4821 0937" and "48210937" work too.
 */
export function setupCodeMatches(expected: string, given: string): boolean {
  return timingSafeEqual(digest(expected), digest(given));
}

/**
 * True only for a request made on this computer itself. A request that passed through a
 * proxy (nginx, Caddy...) also arrives from 127.0.0.1, so any forwarding header means it
 * came from somewhere else.
 *
 * The address it was sent to must be this computer's too. Otherwise a website you visit
 * during setup could point its own domain name at 127.0.0.1 ("DNS rebinding") and have
 * your browser create the first admin for it: the request would come from this computer,
 * but with that website's name in the Host header.
 */
export function isLocalRequest(request: FastifyRequest): boolean {
  const forwarded =
    request.headers["x-forwarded-for"] ?? request.headers.forwarded ?? request.headers["x-real-ip"];
  if (forwarded !== undefined) {
    return false;
  }

  const address = request.socket.remoteAddress ?? "";
  const fromThisComputer =
    address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127.");
  return fromThisComputer && isLocalHostHeader(request.headers.host);
}

/** "localhost:4000", "127.0.0.1:4000" or "[::1]:4000", with or without the port. */
export function isLocalHostHeader(host: string | undefined): boolean {
  if (host === undefined) {
    return false;
  }
  const name = host
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^\[(.*)\]$/, "$1");
  return name === "localhost" || name === "::1" || /^127(\.\d{1,3}){3}$/.test(name);
}

function digest(code: string): Buffer {
  return createHash("sha256").update(code.replace(/[\s-]/g, "")).digest();
}
