import { createHmac } from "node:crypto";
import type { VersionKey } from "./experiments.schema.js";

/**
 * Which version of a tested page a visitor sees, decided on the server so the page never
 * flickers from one version to another. Nothing is stored to decide it: no cookie and no
 * identifier. The choice is worked out afresh on every visit from the test's secret and
 * what the browser sends anyway (its network address, user agent and languages), so the same
 * browser on the same network keeps seeing the same version. The address is used only for
 * that sum and then forgotten. See docs/decisions/0044-ab-testing.md.
 *
 * Search engines, link previews and other automated visitors always get the original, and
 * so does anyone whose browser asks not to be tracked (Do Not Track or Global Privacy
 * Control); none of them is counted.
 */

/** What the server knows about a visit, read from its request. */
export interface Visitor {
  address: string;
  userAgent: string;
  acceptLanguage: string;
  /** Do Not Track or Global Privacy Control is on. */
  optedOut: boolean;
}

/** Headers as Fastify gives them. */
type RequestHeaders = Readonly<Record<string, string | string[] | undefined>>;

function header(headers: RequestHeaders, name: string): string {
  const value = headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function readVisitor(headers: RequestHeaders, address: string): Visitor {
  return {
    address,
    userAgent: header(headers, "user-agent"),
    acceptLanguage: header(headers, "accept-language"),
    optedOut: header(headers, "dnt") === "1" || header(headers, "sec-gpc") === "1",
  };
}

/**
 * Crawlers, link previews, monitors, command-line tools and headless browsers. A visit
 * without a user agent counts as automated too: every real browser sends one.
 */
const automatedAgent =
  /bot\b|bot\/|crawl|spider|slurp|archiver|facebookexternalhit|embedly|preview|whatsapp|telegram|discord|slack|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|java\/|go-http|axios|node-fetch|undici|monitor|uptime|pingdom|validator|feed|\bscan/i;

export function isAutomatedVisitor(visitor: Pick<Visitor, "userAgent">): boolean {
  return visitor.userAgent.trim() === "" || automatedAgent.test(visitor.userAgent);
}

/** Visitors who see a test's versions and are counted: people, who haven't opted out. */
export function takesPartInTests(visitor: Visitor): boolean {
  return !visitor.optedOut && !isAutomatedVisitor(visitor);
}

/**
 * A number from 0 to 9999 for this visitor in this test, the same on every visit from the
 * same browser and network. Different tests (different secrets) give unrelated numbers.
 */
export function visitorBucket(visitor: Visitor, secret: string): number {
  const digest = createHmac("sha256", secret)
    .update(`${visitor.address}\n${visitor.userAgent}\n${visitor.acceptLanguage}`)
    .digest();
  return digest.readUInt32BE(0) % 10000;
}

/**
 * The version for a bucket: the split's shares (whole percent, original first) laid end to
 * end from 0 to 100, and the version whose stretch the bucket falls in.
 */
export function versionForBucket(
  bucket: number,
  split: readonly number[],
  keys: readonly VersionKey[],
): VersionKey {
  const point = bucket / 100;
  let end = 0;
  for (const [index, key] of keys.entries()) {
    end += split[index] ?? 0;
    if (point < end) return key;
  }
  return "original";
}

/** The version a visitor sees: always the original for those who don't take part. */
export function chooseVersion(
  visitor: Visitor,
  test: { secret: string; split: readonly number[]; keys: readonly VersionKey[] },
): VersionKey {
  if (!takesPartInTests(visitor)) return "original";
  return versionForBucket(visitorBucket(visitor, test.secret), test.split, test.keys);
}
