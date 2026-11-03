import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSubmissionRow } from "../forms/submissions.repository.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import { findSiteForAddress } from "../website/site-for-address.js";
import { formGoalName, ORDER_GOAL } from "./analytics-events.js";
import { insertEvent } from "./analytics.repository.js";
import { cleanPath, dayOf } from "./visitor-signals.js";

/**
 * Goals the server records itself, from what happened rather than from the page, so they
 * count even when the page's script didn't run: a form sent ("form.submitted") and an order
 * paid ("order.paid"). They carry no visitor hash: the payment service, not the visitor,
 * usually reports a payment, and a count is all a goal needs. Conversion rate is goals for
 * every 100 visitors.
 */

export async function recordFormGoal(
  database: DatabaseOrTransaction,
  form: { id: string; handle: string },
  submissionId: string,
  now: Date = new Date(),
): Promise<void> {
  const submission = await findSubmissionRow(database, DEFAULT_TENANT_ID, form.id, submissionId);
  const page = pageOf(submission?.sourceUrl ?? null);
  const { site, path } = page
    ? await findSiteForAddress(database, page)
    : { site: await findOrCreateDefaultSite(database), path: "" };
  await insertEvent(database, {
    tenantId: DEFAULT_TENANT_ID,
    siteId: site.id,
    occurredAt: now,
    day: dayOf(now),
    kind: "goal",
    name: formGoalName(form.handle),
    path: path ? cleanPath(path) : "",
  });
}

export async function recordOrderGoal(
  database: DatabaseOrTransaction,
  order: { total: number; currency: string },
  now: Date = new Date(),
): Promise<void> {
  // The shop belongs to the whole install, so its orders are counted on the main site.
  const site = await findOrCreateDefaultSite(database);
  await insertEvent(database, {
    tenantId: DEFAULT_TENANT_ID,
    siteId: site.id,
    occurredAt: now,
    day: dayOf(now),
    kind: "goal",
    name: ORDER_GOAL,
    value: Math.max(0, Math.round(order.total)),
    currency: order.currency,
  });
}

function pageOf(sourceUrl: string | null): { host: string; path: string } | null {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    return { host: url.host, path: url.pathname };
  } catch {
    return null;
  }
}
