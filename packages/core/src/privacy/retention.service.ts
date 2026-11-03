import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { FormsContext } from "../forms/forms-context.js";
import { deleteSubmissionsAndFiles } from "../forms/submissions.service.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import {
  anonymiseArchivedOrders,
  anonymiseCheckout,
  anonymiseOrders,
  deleteCarts,
  deleteSecurityEvents,
  listArchivedOrdersByIds,
  listOrdersByIds,
} from "./personal-data.repository.js";
import {
  type RetentionResponse,
  type RetentionRuleId,
  type RetentionRules,
  retentionChoices,
  retentionRuleIds,
  retentionRulesSchema,
} from "./privacy.schema.js";
import {
  countPastCutoff,
  findOldestKept,
  listIdsPastCutoff,
  type RetainedKind,
  retainedKinds,
} from "./retention.repository.js";

/**
 * Retention rules: how long each kind of personal data is kept before it is deleted (or, for
 * orders, has the person taken out). They run every hour with the server's other jobs
 * (src/scheduler). Forms with a "keep entries for" of their own keep following it; the
 * form entries rule covers the rest.
 */

const ONE_DAY = 24 * 60 * 60_000;
const PER_RUN = 200;

/** What each rule covers: the kinds it touches, and the plugin that must be on for it to apply. */
const ruleKinds: Record<RetentionRuleId, { kinds: RetainedKind[]; pluginId: string | null }> = {
  formEntries: { kinds: [retainedKinds.formEntries], pluginId: "forms" },
  abandonedCarts: {
    kinds: [retainedKinds.carts, retainedKinds.expiredCheckouts],
    pluginId: "commerce",
  },
  activityLogs: { kinds: [retainedKinds.securityEvents], pluginId: null },
  orders: { kinds: [retainedKinds.orders, retainedKinds.archivedOrders], pluginId: "commerce" },
};

export async function readRetentionRules(database: DatabaseOrTransaction): Promise<RetentionRules> {
  return (await readSetting(database, "privacy")).retention;
}

export async function updateRetentionRules(
  database: DatabaseOrTransaction,
  changes: Partial<RetentionRules>,
): Promise<RetentionRules> {
  const settings = await readSetting(database, "privacy");
  const retention = retentionRulesSchema.parse({ ...settings.retention, ...changes });
  await writeSetting(database, "privacy", { ...settings, retention });
  return retention;
}

const cutoffFor = (now: Date, days: number) => new Date(now.getTime() - days * ONE_DAY);

/** Each rule with what its next run would do, and when the next thing after that is due. */
export async function describeRetention(
  database: DatabaseOrTransaction,
  now = new Date(),
): Promise<RetentionResponse> {
  const [rules, enabledPlugins] = await Promise.all([
    readRetentionRules(database),
    findEnabledPluginIds(database),
  ]);
  const described = await Promise.all(
    retentionRuleIds.map(async (id) => {
      const rule = rules[id];
      const { kinds, pluginId } = ruleKinds[id];
      const cutoff = cutoffFor(now, rule.days);
      const dueNow = await Promise.all(
        kinds.map((kind) => countPastCutoff(database, kind, DEFAULT_TENANT_ID, cutoff)),
      );
      const oldest = await Promise.all(
        kinds.map((kind) => findOldestKept(database, kind, DEFAULT_TENANT_ID, cutoff)),
      );
      const nextOldest = oldest
        .filter((date): date is Date => date !== null)
        .sort((first, second) => first.getTime() - second.getTime())[0];
      return {
        id,
        enabled: rule.enabled,
        days: rule.days,
        choices: [...retentionChoices[id]],
        applies: pluginId === null || enabledPlugins.includes(pluginId),
        dueNow: dueNow.reduce((total, count) => total + count, 0),
        nextDueAt: nextOldest
          ? new Date(nextOldest.getTime() + rule.days * ONE_DAY).toISOString()
          : null,
      };
    }),
  );
  return { rules: described };
}

export type RetentionRunResult = Record<RetentionRuleId, number>;

/**
 * Applies every rule that is on. Rules apply whether or not their feature is switched on,
 * because the data stays when a feature is switched off. Works in batches, so a first run
 * over years of data doesn't hold the database for long.
 */
export async function runRetentionRules(
  context: { database: DatabaseOrTransaction; forms: () => FormsContext },
  now = new Date(),
): Promise<RetentionRunResult> {
  const rules = await readRetentionRules(context.database);
  const result: RetentionRunResult = {
    formEntries: 0,
    abandonedCarts: 0,
    activityLogs: 0,
    orders: 0,
  };
  for (const id of retentionRuleIds) {
    const rule = rules[id];
    if (!rule.enabled) continue;
    const cutoff = cutoffFor(now, rule.days);
    for (const kind of ruleKinds[id].kinds) {
      result[id] += await applyToKind(context, kind, cutoff);
    }
  }
  return result;
}

async function applyToKind(
  context: { database: DatabaseOrTransaction; forms: () => FormsContext },
  kind: RetainedKind,
  cutoff: Date,
): Promise<number> {
  const { database } = context;
  let total = 0;
  for (;;) {
    const ids = await listIdsPastCutoff(database, kind, DEFAULT_TENANT_ID, cutoff, PER_RUN);
    if (ids.length === 0) return total;
    const changed = await removeOrAnonymise(context, kind, ids);
    total += changed;
    // Nothing changed means the same rows would come back again: stop rather than spin.
    if (changed === 0) return total;
  }
}

async function removeOrAnonymise(
  context: { database: DatabaseOrTransaction; forms: () => FormsContext },
  kind: RetainedKind,
  ids: string[],
): Promise<number> {
  const { database } = context;
  switch (kind) {
    case retainedKinds.formEntries:
      return deleteSubmissionsAndFiles({ ...context.forms(), database }, ids);
    case retainedKinds.carts:
      return deleteCarts(database, ids);
    case retainedKinds.expiredCheckouts:
      for (const id of ids) await anonymiseCheckout(database, id);
      return ids.length;
    case retainedKinds.securityEvents:
      return deleteSecurityEvents(database, ids);
    case retainedKinds.orders:
      return anonymiseOrders(database, await listOrdersByIds(database, ids));
    case retainedKinds.archivedOrders:
      return anonymiseArchivedOrders(database, await listArchivedOrdersByIds(database, ids));
    default:
      return 0;
  }
}
