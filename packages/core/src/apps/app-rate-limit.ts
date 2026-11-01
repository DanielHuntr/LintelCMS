import type { FastifyReply, FastifyRequest } from "fastify";
import { readBearerToken } from "../api-tokens/api-token-secrets.js";
import { hashClientSecret, isClientSecret } from "./app-credentials.js";
import { AppRateLimitedError } from "./apps.errors.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Counts each app's requests, so one busy app can't slow the site down (see src/apps). */
    appRequestLimiter: AppRequestLimiter;
  }
}

/** Generous for an integration, far below what would trouble the server. */
export const DEFAULT_APP_REQUESTS_PER_MINUTE = 240;

const WINDOW_MILLISECONDS = 60_000;
/** Forgotten windows are cleared out once there are this many, so memory stays small. */
const PRUNE_AT = 1_000;

/**
 * A fixed one-minute window per app, kept in memory. Behind a load balancer each server
 * counts on its own, which only makes the limit kinder; it is there to stop runaway loops,
 * not to bill anyone.
 */
export class AppRequestLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly requestsPerMinute: number = DEFAULT_APP_REQUESTS_PER_MINUTE) {}

  /** Counts a request. Undefined when it may go ahead, otherwise seconds until it may. */
  take(key: string, now = Date.now()): number | undefined {
    const window = this.windows.get(key);
    if (!window || now - window.startedAt >= WINDOW_MILLISECONDS) {
      this.prune(now);
      this.windows.set(key, { startedAt: now, count: 1 });
      return undefined;
    }
    if (window.count >= this.requestsPerMinute) {
      return Math.ceil((window.startedAt + WINDOW_MILLISECONDS - now) / 1000);
    }
    window.count += 1;
    return undefined;
  }

  private prune(now: number): void {
    if (this.windows.size < PRUNE_AT) {
      return;
    }
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= WINDOW_MILLISECONDS) {
        this.windows.delete(key);
      }
    }
  }
}

/**
 * Runs before every request (registered in server.ts). Only requests carrying an app's
 * client secret are counted, keyed by the secret's hash, so this needs no database.
 * A wrong secret is counted too, then refused by the usual check, which also slows down
 * anyone guessing.
 */
export async function limitAppRequests(request: FastifyRequest, reply: FastifyReply) {
  const bearer = readBearerToken(request.headers.authorization);
  if (bearer === undefined || !isClientSecret(bearer)) {
    return;
  }
  const waitSeconds = request.server.appRequestLimiter.take(hashClientSecret(bearer));
  if (waitSeconds !== undefined) {
    reply.header("retry-after", String(waitSeconds));
    throw new AppRateLimitedError(waitSeconds);
  }
}
