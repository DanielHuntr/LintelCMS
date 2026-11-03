import { Download, Settings2, Users } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { downloadVisitorStats, type StatsChoice, type StatsRange } from "./analytics.api.js";
import { useVisitorStats } from "./analytics.queries.js";
import { BreakdownCard } from "./BreakdownCard.js";
import { StatTiles } from "./StatTiles.js";
import { TestVersionsCard } from "./TestVersionsCard.js";
import { VisitorSettingsDialog } from "./VisitorSettingsDialog.js";
import { VisitorsChart } from "./VisitorsChart.js";
import { countryLabel, deviceLabel, goalLabel, pageLabel, sourceLabel } from "./visitorLabels.js";

const ranges: readonly StatsRange[] = ["today", "7d", "30d", "custom"];

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** /visitors: how many people visit the site being worked on, and what they read. */
export function VisitorsPage() {
  const canChangeSettings = useCan("settings:update");
  const [range, setRange] = useState<StatsRange>("7d");
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 13 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const choice: StatsChoice = range === "custom" ? { range, from, to } : { range };
  const customReady = range !== "custom" || (from !== "" && to !== "" && from <= to);
  const stats = useVisitorStats(choice, customReady);
  const plain = (key: string) => key;

  return (
    <>
      <LargeTitle
        title={t("visitors.title")}
        subtitle={t("visitors.subtitle")}
        actions={
          <>
            {canChangeSettings && (
              <Button
                variant="plain"
                icon={<Settings2 aria-hidden="true" />}
                onClick={() => setSettingsOpen(true)}
              >
                {t("visitors.settings")}
              </Button>
            )}
            <Button
              variant="tinted"
              icon={<Download aria-hidden="true" />}
              onClick={() => void downloadVisitorStats(choice)}
              disabled={!customReady}
            >
              {t("visitors.export")}
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SegmentedControl
          label={t("visitors.range.label")}
          options={ranges.map((value) => ({ value, label: t(`visitors.range.${value}`) }))}
          value={range}
          onChange={setRange}
        />
        {range === "custom" && (
          <div className="flex gap-3">
            <TextField
              type="date"
              label={t("visitors.from")}
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
            <TextField
              type="date"
              label={t("visitors.to")}
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        )}
      </div>

      {stats.isError && <LoadError error={stats.error} onRetry={() => void stats.refetch()} />}
      {stats.isPending && customReady && (
        <LoadingRegion label={t("visitors.loading")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-28 rounded-card" />
            ))}
          </div>
          <Skeleton className="mt-4 h-56 rounded-card" />
        </LoadingRegion>
      )}
      {stats.data && (
        <div className="flex flex-col gap-4">
          <StatTiles totals={stats.data.totals} previous={stats.data.previousTotals} />
          {stats.data.totals.views === 0 && stats.data.totals.conversions === 0 ? (
            <Card>
              <EmptyState
                size="page"
                icon={Users}
                title={t("visitors.empty.title")}
                description={t("visitors.empty.description")}
              />
            </Card>
          ) : (
            <>
              <VisitorsChart days={stats.data.days} />
              <div className="grid gap-4 md:grid-cols-2">
                <BreakdownCard
                  title={t("visitors.pages")}
                  keyHeading={t("visitors.column.page")}
                  valueHeading={t("visitors.column.visitors")}
                  rows={stats.data.pages.filter((row) => row.views > 0)}
                  label={pageLabel}
                  value={(row) => row.visitors}
                  emptyText=""
                />
                <BreakdownCard
                  title={t("visitors.sources")}
                  keyHeading={t("visitors.column.source")}
                  valueHeading={t("visitors.column.visitors")}
                  rows={stats.data.sources}
                  label={sourceLabel}
                  value={(row) => row.visitors}
                  emptyText=""
                />
                <BreakdownCard
                  title={t("visitors.devices")}
                  keyHeading={t("visitors.column.device")}
                  valueHeading={t("visitors.column.visitors")}
                  rows={stats.data.devices}
                  label={deviceLabel}
                  value={(row) => row.visitors}
                  emptyText=""
                />
                <BreakdownCard
                  title={t("visitors.countries")}
                  keyHeading={t("visitors.column.country")}
                  valueHeading={t("visitors.column.visitors")}
                  rows={stats.data.countries}
                  label={countryLabel}
                  value={(row) => row.visitors}
                  hint={t("visitors.countriesHint")}
                  emptyText=""
                />
                <BreakdownCard
                  title={t("visitors.goals")}
                  keyHeading={t("visitors.column.goal")}
                  valueHeading={t("visitors.column.reached")}
                  rows={stats.data.goals}
                  label={goalLabel}
                  value={(row) => row.conversions}
                  emptyText={t("visitors.goalsEmpty")}
                />
                <TestVersionsCard rows={stats.data.versions ?? []} />
                <BreakdownCard
                  title={t("visitors.campaigns")}
                  keyHeading={t("visitors.column.campaign")}
                  valueHeading={t("visitors.column.visitors")}
                  rows={stats.data.campaigns}
                  label={plain}
                  value={(row) => row.visitors}
                />
                <BreakdownCard
                  title={t("visitors.events")}
                  keyHeading={t("visitors.column.event")}
                  valueHeading={t("visitors.column.reached")}
                  rows={stats.data.events}
                  label={plain}
                  value={(row) => row.views}
                />
                <BreakdownCard
                  title={t("visitors.outbound")}
                  keyHeading={t("visitors.column.link")}
                  valueHeading={t("visitors.column.clicks")}
                  rows={stats.data.outbound}
                  label={plain}
                  value={(row) => row.views}
                />
              </div>
            </>
          )}
        </div>
      )}
      {canChangeSettings && (
        <VisitorSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
