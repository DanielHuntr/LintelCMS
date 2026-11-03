import type { DeviceClass } from "./analytics-events.js";

/**
 * Reading what a visit says about itself, without keeping anything personal: pure functions,
 * so each rule is easy to test and to change.
 */

/** Robots, link previews, uptime checks and scripts. Real browsers never say these words. */
const robotPattern =
  /bot\b|bot\/|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|pingdom|uptime|monitor|curl\/|wget|python|java\/|go-http|axios|node-fetch|okhttp|phantom|selenium|playwright|puppeteer/i;

export function looksLikeRobot(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.length < 20) return true;
  // Every browser people use says "Mozilla/5.0" first.
  if (!userAgent.startsWith("Mozilla/")) return true;
  return robotPattern.test(userAgent);
}

/** Do Not Track or Global Privacy Control: the visitor asked not to be counted. */
export function asksNotToBeCounted(headers: Readonly<Record<string, unknown>>): boolean {
  return headers.dnt === "1" || headers["sec-gpc"] === "1";
}

/** From the window's width: phones are narrow, tablets in between, the rest desktop. */
export function deviceFromWidth(width: number | undefined): DeviceClass | null {
  if (width === undefined || !Number.isFinite(width) || width <= 0) return null;
  if (width < 600) return "phone";
  if (width < 1025) return "tablet";
  return "desktop";
}

/**
 * The visitor's country, guessed from the region in their browser's first language
 * ("en-GB" is GB), with no lookup anywhere. A language without a region says nothing.
 */
export function countryFromLanguage(acceptLanguage: string | undefined): string {
  const first = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim();
  if (!first) return "";
  try {
    const region = new Intl.Locale(first).region;
    return region && /^[A-Z]{2}$/.test(region) ? region : "";
  } catch {
    return "";
  }
}

/** "https://www.google.com/search?q=x" is "google.com". Visits from the site itself are "". */
export function referrerDomain(referrer: string | undefined, pageHost: string | undefined): string {
  if (!referrer) return "";
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const host = withoutWww(url.hostname.toLowerCase());
    // The page's host may carry a port ("localhost:3000"); the hostname never does.
    const pageHostname = pageHost?.toLowerCase().replace(/:\d+$/, "");
    if (pageHostname && host === withoutWww(pageHostname)) return "";
    return host.slice(0, 100);
  } catch {
    return "";
  }
}

function withoutWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** The page's path only: queries and anchors can hold names, emails or tokens. */
export function cleanPath(path: string | undefined): string {
  if (!path) return "/";
  const bare = path.split(/[?#]/)[0] ?? "/";
  const decoded = bare.startsWith("/") ? bare : `/${bare}`;
  return decoded.slice(0, 300);
}

/** Names for goals and events: letters, numbers, spaces, dashes, dots and colons. */
export function cleanName(name: string | undefined): string {
  return (name ?? "")
    .replace(/[^\p{L}\p{N} _.:-]/gu, "")
    .trim()
    .slice(0, 60);
}

/** A tag from a `utm_` parameter, kept short and plain. */
export function cleanTag(tag: string | undefined): string {
  return cleanName(tag).toLowerCase().slice(0, 60);
}

/** The longest time on a page that is counted: longer means the tab was left open. */
export const LONGEST_COUNTED_VISIT_MS = 30 * 60 * 1000;

export function countedDuration(durationMs: number | undefined): number | null {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  return Math.min(Math.round(durationMs), LONGEST_COUNTED_VISIT_MS);
}

/** "2026-11-03", the day in UTC. */
export function dayOf(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}
