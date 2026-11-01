import { z } from "zod";
import {
  optionalSetting,
  settingWithDefault,
  webAddress,
  wholeNumberSetting,
  yesOrNoSetting,
} from "../config-values.js";

/**
 * The settings for running Lintel on a server (see README.md). They are part of the one
 * config schema in src/config.ts, so a mistake in any of them stops the server at start
 * with a message naming the setting.
 */

/**
 * Proxies on this machine or a private network (Caddy, a platform's load balancer, a
 * Docker network) are trusted to say who the visitor is; anyone on the open internet is
 * not, so a visitor can't pretend to be someone else by sending X-Forwarded-For.
 */
export const DEFAULT_TRUST_PROXY = "loopback, linklocal, uniquelocal";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const adminPathSchema = z
  .string()
  .trim()
  .transform((path) => (path.length > 1 ? path.replace(/\/+$/, "") : path))
  .refine((path) => /^\/[a-zA-Z0-9/_-]+$/.test(path), {
    error: "Should be a path such as /admin: a slash, then letters, numbers, - or _",
  })
  .refine((path) => path !== "/api" && !path.startsWith("/api/"), {
    error: "Can't be /api, which is where the API lives",
  });

export type TrustProxy = boolean | number | string[];

/** "true", "false", a number of proxies in front, or a list of addresses and names. */
export function parseTrustProxy(value: string): TrustProxy {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/**
 * In the form Fastify's types accept. A number means "this many proxies in front": the
 * address that many hops from us is the visitor's.
 */
export function trustProxyOption(
  trustProxy: TrustProxy,
): boolean | string[] | ((address: string, hop: number) => boolean) {
  if (typeof trustProxy !== "number") return trustProxy;
  return (_address, hop) => hop < trustProxy;
}

export const productionSettings = {
  // Hosting platforms (Railway, Render, Fly.io) tell the app which port to use in PORT.
  PORT: optionalSetting(
    z.coerce
      .number({ error: "Should be a port number, such as 4000" })
      .int({ error: "Should be a whole number, such as 4000" })
      .min(1, { error: "Should be between 1 and 65535" })
      .max(65535, { error: "Should be between 1 and 65535" }),
  ),
  HOST: settingWithDefault(z.string().trim().min(1), "0.0.0.0"),
  // The address people type to reach the site, such as https://example.com.
  PUBLIC_URL: optionalSetting(
    webAddress.refine((value) => (URL.parse(value)?.pathname ?? "/") === "/", {
      error: "Should be just the site's address, such as https://example.com, with no path",
    }),
  ),
  ADMIN_PATH: settingWithDefault(adminPathSchema, "/admin"),
  TRUST_PROXY: settingWithDefault(z.string(), DEFAULT_TRUST_PROXY).transform(parseTrustProxy),
  LOG_LEVEL: settingWithDefault(
    z.enum(LOG_LEVELS, { error: `Should be one of ${LOG_LEVELS.join(", ")}` }),
    "info",
  ),
  SHUTDOWN_TIMEOUT_SECONDS: wholeNumberSetting(10),
  // Where the built-in database, uploads and saved settings live. Defaults to .lintel at
  // the repository root; the Docker image sets /data.
  LINTEL_FOLDER: optionalSetting(z.string().trim().min(1)),
  // Where the built admin is. Defaults to packages/admin/dist.
  ADMIN_BUILD_FOLDER: optionalSetting(z.string().trim().min(1)),
  ALLOW_INSECURE_HTTP: yesOrNoSetting(false),
};

interface ProductionSettingsToCheck {
  NODE_ENV: string;
  PUBLIC_URL?: string | undefined;
  ALLOW_INSECURE_HTTP: boolean;
}

/** Rules that need more than one setting. Called from config.ts. */
export function checkProductionSettings(
  settings: ProductionSettingsToCheck,
  context: z.RefinementCtx,
): void {
  if (settings.NODE_ENV === "development" || !settings.PUBLIC_URL) return;

  const url = URL.parse(settings.PUBLIC_URL);
  if (
    url &&
    url.protocol === "http:" &&
    !isLocalHost(url.hostname) &&
    !settings.ALLOW_INSECURE_HTTP
  ) {
    context.addIssue({
      code: "custom",
      path: ["PUBLIC_URL"],
      message:
        "Starts with http://, so browsers would refuse the sign-in cookie and nobody could " +
        "sign in. Use an https:// address (the Caddy service in docker-compose.yml sets up " +
        "HTTPS for you), or set ALLOW_INSECURE_HTTP=true on a test server you never use for real.",
    });
  }
}

export function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** The addresses a production server works out from its settings. */
export interface ProductionAddresses {
  port: number;
  /** The site's address, with no trailing slash. */
  publicUrl: string;
  /** Where browsers reach the API: `<publicUrl>/api` unless API_PUBLIC_URL says otherwise. */
  publicApiUrl: string;
  /** The admin is served from the same address, so this is the public URL's origin. */
  adminOrigin: string;
  adminUrl: string;
}

export const API_PREFIX = "/api";

export function productionAddresses(settings: {
  PORT?: number | undefined;
  API_PORT: number;
  PUBLIC_URL?: string | undefined;
  API_PUBLIC_URL?: string | undefined;
  ADMIN_PATH: string;
}): ProductionAddresses {
  const port = settings.PORT ?? settings.API_PORT;
  const publicUrl = (settings.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, "");
  return {
    port,
    publicUrl,
    publicApiUrl: settings.API_PUBLIC_URL ?? `${publicUrl}${API_PREFIX}`,
    adminOrigin: new URL(publicUrl).origin,
    adminUrl: `${publicUrl}${settings.ADMIN_PATH}`,
  };
}
