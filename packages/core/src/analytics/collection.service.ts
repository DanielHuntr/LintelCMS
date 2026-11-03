import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { removePathPrefix } from "../sites/site-addresses.js";
import type { Site } from "../sites/sites.table.js";
import type { NewAnalyticsEvent } from "./analytics.table.js";
import { insertEvent } from "./analytics.repository.js";
import type { CollectRequest } from "./analytics.schema.js";
import { hashVisitor, saltForDay } from "./visitor-hash.js";
import { VisitorLimiter } from "./visitor-limiter.js";
import {
  asksNotToBeCounted,
  cleanName,
  cleanPath,
  cleanTag,
  countedDuration,
  countryFromLanguage,
  dayOf,
  deviceFromWidth,
  looksLikeRobot,
  referrerDomain,
} from "./visitor-signals.js";

/**
 * Recording what a visitor's page reported. Nobody is counted who asked not to be (Do Not
 * Track, Global Privacy Control), robots aren't counted, and the address and browser are used
 * only to make the day's visitor hash, then dropped.
 */

/** What the request says about the visitor; none of it is stored. */
export interface VisitorRequest {
  ipAddress: string;
  headers: Readonly<Record<string, unknown>>;
}

export type CollectOutcome = "counted" | "not counted";

const limiter = new VisitorLimiter();

export async function recordVisitorEvent(
  database: DatabaseOrTransaction,
  site: Site,
  visitor: VisitorRequest,
  report: CollectRequest,
  now: Date = new Date(),
): Promise<CollectOutcome> {
  const userAgent = headerText(visitor.headers["user-agent"]);
  if (asksNotToBeCounted(visitor.headers) || looksLikeRobot(userAgent)) return "not counted";

  const day = dayOf(now);
  const salt = await saltForDay(database, DEFAULT_TENANT_ID, day);
  const visitorHash = hashVisitor(salt, {
    siteId: site.id,
    ipAddress: visitor.ipAddress,
    userAgent: userAgent ?? "",
  });
  // "/fr/about" on a site served under /fr is that site's "/about", as its entries know it.
  const path = removePathPrefix(site.pathPrefix, cleanPath(report.path));
  if (!limiter.allows(visitorHash, report.kind, path, now.getTime())) return "not counted";

  const described = describeReport(report);
  if (!isWorthKeeping(described)) return "not counted";

  await insertEvent(database, {
    ...described,
    tenantId: DEFAULT_TENANT_ID,
    siteId: site.id,
    occurredAt: now,
    day,
    visitorHash,
    path,
    country:
      report.kind === "view"
        ? countryFromLanguage(headerText(visitor.headers["accept-language"]))
        : "",
  });
  return "counted";
}

/** The parts of the event that depend on its kind. */
function describeReport(report: CollectRequest): Partial<NewAnalyticsEvent> & {
  kind: NewAnalyticsEvent["kind"];
} {
  switch (report.kind) {
    case "view":
      return {
        kind: "view",
        source: cleanTag(report.source) || referrerDomain(report.referrer, report.host),
        campaign: cleanTag(report.campaign),
        device: deviceFromWidth(report.width),
      };
    case "leave":
      return { kind: "leave", durationMs: countedDuration(report.durationMs) };
    case "outbound":
      return { kind: "outbound", name: referrerDomain(report.name, report.host) };
    case "custom":
      return { kind: "custom", name: cleanName(report.name) };
  }
}

/** Links to the site itself, unnamed events and leaving without a time say nothing. */
function isWorthKeeping(event: Partial<NewAnalyticsEvent>): boolean {
  if (event.kind === "outbound" || event.kind === "custom") return Boolean(event.name);
  if (event.kind === "leave") return event.durationMs !== null;
  return true;
}

function headerText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** For tests: start each one with no visitors remembered. */
export function forgetRecentVisitors(): void {
  limiter.clear();
}
