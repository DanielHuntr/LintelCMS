import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  deleteEventsBeforeDay,
  deleteSaltsExcept,
  listDaysWithEvents,
  listEventsForDay,
  listSiteIdsWithEvents,
  replaceDailyFigures,
} from "./analytics.repository.js";
import { rollUpEvents } from "./daily-rollups.js";
import { dayOf } from "./visitor-signals.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeping the daily figures up to date and the single visits short-lived. The scheduled job
 * (register-analytics.ts) rolls up today and yesterday every few minutes, every day still
 * holding visits once when the server starts, and deletes what is past its retention.
 */

export async function rollUpSiteDay(
  database: DatabaseOrTransaction,
  siteId: string,
  day: string,
): Promise<void> {
  const events = await listEventsForDay(database, DEFAULT_TENANT_ID, siteId, day);
  await replaceDailyFigures(database, DEFAULT_TENANT_ID, siteId, day, rollUpEvents(events));
}

export async function rollUpDays(
  database: DatabaseOrTransaction,
  days: readonly string[],
): Promise<void> {
  if (days.length === 0) return;
  const siteIds = await listSiteIdsWithEvents(database, DEFAULT_TENANT_ID, days);
  for (const day of days) {
    for (const siteId of siteIds) {
      await rollUpSiteDay(database, siteId, day);
    }
  }
}

/** Today and yesterday: late visits (a tab left open past midnight) land in yesterday. */
export async function rollUpRecentDays(database: DatabaseOrTransaction, now: Date): Promise<void> {
  await rollUpDays(database, [dayOf(new Date(now.getTime() - ONE_DAY_MS)), dayOf(now)]);
}

/** Every day that still has single visits, after the server was stopped for a while. */
export async function rollUpEveryKeptDay(database: DatabaseOrTransaction): Promise<void> {
  await rollUpDays(database, await listDaysWithEvents(database, DEFAULT_TENANT_ID));
}

/**
 * Deletes single visits from days older than the retention, and every salt but today's.
 * Whole days go at once, so a day still holding visits always holds all of them, and each
 * is counted one last time first, so nothing is lost but the detail.
 */
export async function applyRetention(
  database: DatabaseOrTransaction,
  retentionDays: number,
  now: Date,
): Promise<number> {
  const firstKeptDay = dayOf(new Date(now.getTime() - (retentionDays - 1) * ONE_DAY_MS));
  const goingDays = (await listDaysWithEvents(database, DEFAULT_TENANT_ID)).filter(
    (day) => day < firstKeptDay,
  );
  await rollUpDays(database, goingDays);
  await deleteSaltsExcept(database, DEFAULT_TENANT_ID, dayOf(now));
  return deleteEventsBeforeDay(database, DEFAULT_TENANT_ID, firstKeptDay);
}
