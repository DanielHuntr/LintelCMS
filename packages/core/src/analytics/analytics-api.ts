import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { EventProperties } from "./analytics-events.js";
import { insertEvent, listDailyFigures } from "./analytics.repository.js";
import { rollUpSiteDay } from "./rollups.service.js";
import { totalsOf } from "./stats.service.js";
import { hashVisitor, saltForDay } from "./visitor-hash.js";
import { cleanName, cleanPath, dayOf } from "./visitor-signals.js";

/**
 * What other features (experiments, first of all) may use from the Visitors plugin, in one
 * place. Everything else in this folder is internal and may change.
 *
 *   identifyVisitor   today's anonymous visitor hash for a request, the same one page views
 *                     get, so an exposure and a goal by the same visitor can be matched (for
 *                     that day only)
 *   recordGoal        a goal reached ("signup", "form:contact"), with an optional visitor
 *                     hash, page, value and properties ({ experiment, variant })
 *   countPageVisitors visitors, views and goals for one page (or the whole site) over days
 *
 * None of these check whether the plugin is on; callers decide that (`isPluginEnabled`).
 */

export async function identifyVisitor(
  database: DatabaseOrTransaction,
  visitor: { siteId: string; ipAddress: string; userAgent: string },
  now: Date = new Date(),
): Promise<string> {
  const salt = await saltForDay(database, DEFAULT_TENANT_ID, dayOf(now));
  return hashVisitor(salt, visitor);
}

export interface GoalToRecord {
  siteId: string;
  name: string;
  visitorHash?: string | null;
  path?: string;
  /** Money in the currency's smallest unit. */
  value?: number;
  currency?: string;
  properties?: EventProperties;
  now?: Date;
}

export async function recordGoal(database: DatabaseOrTransaction, goal: GoalToRecord) {
  const now = goal.now ?? new Date();
  const name = cleanName(goal.name);
  if (!name) return;
  await insertEvent(database, {
    tenantId: DEFAULT_TENANT_ID,
    siteId: goal.siteId,
    occurredAt: now,
    day: dayOf(now),
    kind: "goal",
    name,
    visitorHash: goal.visitorHash ?? null,
    path: goal.path ? cleanPath(goal.path) : "",
    value: Math.max(0, Math.round(goal.value ?? 0)),
    currency: goal.currency ?? "",
    properties: goal.properties ?? {},
  });
}

/**
 * Visitors for a page (`path`) or the whole site (`path` left out), from `from` to `to`
 * ("2026-11-01"), both included. Visitors are counted per day and added up.
 */
export async function countPageVisitors(
  database: DatabaseOrTransaction,
  query: { siteId: string; path?: string; from: string; to: string },
  now: Date = new Date(),
) {
  const today = dayOf(now);
  if (query.from <= today && today <= query.to) await rollUpSiteDay(database, query.siteId, today);
  const rows = await listDailyFigures(database, {
    tenantId: DEFAULT_TENANT_ID,
    siteId: query.siteId,
    fromDay: query.from,
    toDay: query.to,
    dimensions: [query.path === undefined ? "total" : "page"],
    ...(query.path === undefined ? {} : { key: cleanPath(query.path) }),
  });
  const totals = totalsOf(rows);
  return { visitors: totals.visitors, views: totals.views, conversions: totals.conversions };
}
