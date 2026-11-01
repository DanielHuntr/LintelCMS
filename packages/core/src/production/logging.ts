import type { FastifyServerOptions } from "fastify";

/**
 * Logs as one JSON object per line (pino, which Fastify uses), so a hosting platform or a
 * log service can search and filter them. Every line about a request carries its
 * `requestId`. Cookies, passwords and tokens never reach the log.
 */
export const HIDDEN_LOG_FIELDS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-setup-code"]',
  'res.headers["set-cookie"]',
  "headers.cookie",
  "headers.authorization",
  "*.password",
  "*.token",
];

export function productionLoggerOptions(level: string): FastifyServerOptions["logger"] {
  return {
    level,
    base: { service: "lintel" },
    redact: { paths: HIDDEN_LOG_FIELDS, censor: "[hidden]" },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  };
}
