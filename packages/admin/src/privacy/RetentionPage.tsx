import { LoadError } from "../api/LoadError.js";
import { describeError } from "../api/describeError.js";
import { BackLink } from "../design/BackLink.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { SelectField } from "../design/SelectField.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { formatDate } from "../i18n/formatting.js";
import { type StringKey, t } from "../i18n/strings.js";
import type { RetentionRule, RetentionRuleId } from "./privacy.api.js";
import { useRetention, useUpdateRetention } from "./privacy.queries.js";

const ruleNames: Record<RetentionRuleId, StringKey> = {
  formEntries: "privacy.retention.formEntries",
  abandonedCarts: "privacy.retention.abandonedCarts",
  activityLogs: "privacy.retention.activityLogs",
  orders: "privacy.retention.orders",
};

const ruleHints: Partial<Record<RetentionRuleId, StringKey>> = {
  formEntries: "privacy.retention.formEntriesHint",
  activityLogs: "privacy.retention.activityLogsHint",
  orders: "privacy.retention.ordersHint",
};

/** "90 days", "6 months", "7 years": the length as people say it. */
export function describeLength(days: number): string {
  if (days % 365 === 0) return t("privacy.retention.years", { count: days / 365 });
  if (days >= 180) return t("privacy.retention.months", { count: Math.round(days / 30) });
  return t("privacy.retention.days", { count: days });
}

/**
 * Settings → Privacy → How long data is kept: one card per rule, a switch and a length,
 * saved as soon as they change, with what the next run would remove under each.
 */
export function RetentionPage() {
  const retention = useRetention();
  const update = useUpdateRetention();

  const change = (rule: RetentionRule, next: { enabled?: boolean; days?: number }) =>
    update.mutate({
      [rule.id]: { enabled: next.enabled ?? rule.enabled, days: next.days ?? rule.days },
    });

  return (
    <Page width="readable">
      <BackLink to="/settings/privacy">{t("privacy.title")}</BackLink>
      <LargeTitle title={t("privacy.retention.title")} subtitle={t("privacy.retention.subtitle")} />
      {retention.isError && (
        <LoadError error={retention.error} onRetry={() => void retention.refetch()} />
      )}
      {retention.isPending && (
        <LoadingRegion label={t("privacy.retention.loading")}>
          <Skeleton className="h-64 rounded-card" />
        </LoadingRegion>
      )}
      {update.isError && (
        <p role="alert" className="mb-4 text-footnote text-danger">
          {describeError(update.error)}
        </p>
      )}
      {retention.data && (
        <div className="flex flex-col gap-1.5">
          <ul className="divide-y divide-separator overflow-hidden rounded-card bg-surface">
            {retention.data.rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                disabled={update.isPending}
                onChange={(next) => change(rule, next)}
              />
            ))}
          </ul>
          <p className="px-4 text-footnote text-label-secondary">{t("privacy.retention.footer")}</p>
        </div>
      )}
    </Page>
  );
}

function RuleRow({
  rule,
  disabled,
  onChange,
}: {
  rule: RetentionRule;
  disabled: boolean;
  onChange: (next: { enabled?: boolean; days?: number }) => void;
}) {
  const name = t(ruleNames[rule.id]);
  const hint = ruleHints[rule.id];
  return (
    <li className={`flex flex-col gap-3 px-4 py-3 ${rule.applies ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-body font-medium text-label">{name}</h2>
          {hint && <p className="text-footnote text-label-secondary">{t(hint)}</p>}
        </div>
        <Toggle
          label={name}
          labelVisibility="hidden"
          checked={rule.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
      </div>
      {rule.enabled && (
        <div className="max-w-56">
          <SelectField
            label={t("privacy.retention.keepFor")}
            value={String(rule.days)}
            disabled={disabled}
            options={rule.choices.map((days) => ({
              value: String(days),
              label: describeLength(days),
            }))}
            onValueChange={(value) => onChange({ days: Number(value) })}
          />
        </div>
      )}
      <p className="text-footnote text-label-secondary">{describeDue(rule)}</p>
    </li>
  );
}

function describeDue(rule: RetentionRule): string {
  if (!rule.applies && rule.dueNow === 0) return t("privacy.retention.notInUse");
  if (rule.dueNow > 0) {
    return rule.enabled
      ? t("privacy.retention.dueNow", { count: rule.dueNow })
      : t("privacy.retention.wouldGo", { count: rule.dueNow });
  }
  if (rule.enabled && rule.nextDueAt) {
    return t("privacy.retention.nextDue", { date: formatDate(rule.nextDueAt) });
  }
  return t("privacy.retention.nothing");
}
