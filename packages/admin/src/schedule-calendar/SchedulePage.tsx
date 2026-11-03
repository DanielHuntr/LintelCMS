import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { useIsNarrowScreen } from "../design/useIsNarrowScreen.js";
import { formattingLocale } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import {
  addMonths,
  type CalendarDay,
  dayKey,
  gridRange,
  type Month,
  monthGrid,
  monthOf,
} from "./monthGrid.js";
import { listScheduledEntries, type ScheduledEntry } from "./scheduleCalendar.api.js";

interface SchedulePageProps {
  month: Month;
  onMonthChange: (month: Month) => void;
  /** Swapped in tests, so "today" stays put. */
  today?: Date;
}

/**
 * /content/schedule: what is due to be published, a month at a time. On a wide screen it is
 * a calendar with each day's entries in it; on a phone, a list grouped by day. Each entry
 * links to its editor, where its schedule can be changed.
 */
export function SchedulePage({ month, onMonthChange, today = new Date() }: SchedulePageProps) {
  const isNarrow = useIsNarrowScreen();
  const weeks = useMemo(() => monthGrid(month), [month]);
  const range = useMemo(() => gridRange(weeks), [weeks]);
  const scheduled = useQuery({
    queryKey: ["entries", "scheduled", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => listScheduledEntries(range),
  });
  const byDay = useMemo(() => groupByDay(scheduled.data?.entries ?? []), [scheduled.data]);
  const monthName = new Intl.DateTimeFormat(formattingLocale(), {
    month: "long",
    year: "numeric",
  }).format(new Date(month.year, month.month - 1, 1));
  const isThisMonth = month.year === monthOf(today).year && month.month === monthOf(today).month;
  const entriesThisMonth = (scheduled.data?.entries ?? []).filter((entry) => {
    const due = new Date(entry.scheduledFor);
    return due.getFullYear() === month.year && due.getMonth() === month.month - 1;
  });

  return (
    <Page width="wide">
      <LargeTitle title={t("schedule.title")} />

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <IconLinkButton
            label={t("schedule.previousMonth")}
            icon={ChevronLeft}
            onClick={() => onMonthChange(addMonths(month, -1))}
          />
          <IconLinkButton
            label={t("schedule.nextMonth")}
            icon={ChevronRight}
            onClick={() => onMonthChange(addMonths(month, 1))}
          />
        </div>
        <h2 className="text-title text-label" aria-live="polite">
          {monthName}
        </h2>
        {!isThisMonth && (
          <Button variant="plain" size="small" onClick={() => onMonthChange(monthOf(today))}>
            {t("schedule.thisMonth")}
          </Button>
        )}
      </div>

      {scheduled.isError && (
        <LoadError error={scheduled.error} onRetry={() => void scheduled.refetch()} />
      )}
      {scheduled.isPending && (
        <LoadingRegion label={t("schedule.loading")}>
          <Skeleton className="h-96 rounded-card" />
        </LoadingRegion>
      )}
      {scheduled.data &&
        (isNarrow ? (
          <DayList entriesThisMonth={entriesThisMonth} monthName={monthName} today={today} />
        ) : (
          <>
            {entriesThisMonth.length === 0 && (
              <p className="mb-4 text-body text-label-secondary">
                <span className="font-medium text-label">
                  {t("schedule.empty.title", { month: monthName })}.
                </span>{" "}
                {t("schedule.empty.description")}
              </p>
            )}
            <MonthTable weeks={weeks} byDay={byDay} monthName={monthName} today={today} />
          </>
        ))}
      {scheduled.data && (
        <p className="mt-3 px-4 text-footnote text-label-secondary">{t("schedule.footer")}</p>
      )}
    </Page>
  );
}

function MonthTable({
  weeks,
  byDay,
  monthName,
  today,
}: {
  weeks: CalendarDay[][];
  byDay: ReadonlyMap<string, ScheduledEntry[]>;
  monthName: string;
  today: Date;
}) {
  const weekdays = (weeks[0] ?? []).map((day) => ({
    short: new Intl.DateTimeFormat(formattingLocale(), { weekday: "short" }).format(day.date),
    long: new Intl.DateTimeFormat(formattingLocale(), { weekday: "long" }).format(day.date),
  }));
  const todayKey = dayKey(today);
  const fullDate = new Intl.DateTimeFormat(formattingLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="overflow-hidden rounded-card bg-surface">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{t("schedule.calendarLabel", { month: monthName })}</caption>
        <thead>
          <tr>
            {weekdays.map((weekday) => (
              <th
                key={weekday.long}
                scope="col"
                abbr={weekday.long}
                className="px-2 py-2 text-start text-footnote font-medium text-label-secondary"
              >
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.key}>
              {week.map((day) => {
                const due = byDay.get(day.key) ?? [];
                const isToday = day.key === todayKey;
                return (
                  <td
                    key={day.key}
                    className={classNames(
                      "h-28 min-w-0 border-s-[0.5px] border-separator px-1.5 pt-1.5 pb-2 align-top hairline-top first:border-s-0",
                      !day.isInMonth && "bg-fill/40",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={classNames(
                        "mb-1 flex size-7 items-center justify-center rounded-full text-footnote tabular-nums",
                        isToday
                          ? "bg-accent-fill font-semibold text-on-accent"
                          : day.isInMonth
                            ? "text-label"
                            : "text-label-tertiary",
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                    <span className="sr-only">
                      {t("schedule.dayLabel", {
                        date: fullDate.format(day.date),
                        count: due.length,
                      })}
                      {isToday && `, ${t("schedule.today")}`}
                    </span>
                    {due.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {due.map((entry) => (
                          <li key={entry.id}>
                            <EntryChip entry={entry} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryChip({ entry }: { entry: ScheduledEntry }) {
  const time = formatTime(entry.scheduledFor);
  return (
    <Link
      to="/content/$collection/$entryId"
      params={{ collection: entry.collectionHandle, entryId: entry.id }}
      search={{ locale: undefined }}
      title={`${entry.title || t("schedule.untitled")} · ${entry.collectionName}`}
      className="flex min-w-0 flex-col rounded-control bg-fill px-2 py-1 text-start hover:bg-fill-strong focus-visible:focus-ring"
    >
      <span className="line-clamp-2 text-footnote font-medium break-words text-label">
        {entry.title || t("schedule.untitled")}
      </span>
      <span className="truncate text-caption text-label-secondary">
        <span className="sr-only">{t("schedule.publishes", { time })}</span>
        <span aria-hidden="true">
          {time} · {entry.collectionName}
        </span>
      </span>
    </Link>
  );
}

/** On a phone: only the days with something due, each a group of rows. */
function DayList({
  entriesThisMonth,
  monthName,
  today,
}: {
  entriesThisMonth: readonly ScheduledEntry[];
  monthName: string;
  today: Date;
}) {
  if (entriesThisMonth.length === 0) {
    return (
      <EmptyState
        size="page"
        icon={CalendarClock}
        title={t("schedule.empty.title", { month: monthName })}
        description={t("schedule.empty.description")}
      />
    );
  }
  const days = [...groupByDay(entriesThisMonth)];
  const heading = new Intl.DateTimeFormat(formattingLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const todayKey = dayKey(today);
  return (
    <div className="flex flex-col gap-6">
      {days.map(([key, entries]) => {
        const first = entries[0];
        const date = first ? new Date(first.scheduledFor) : today;
        const label = heading.format(date);
        return (
          <GroupedList
            key={key}
            header={key === todayKey ? `${t("schedule.today")} · ${label}` : label}
          >
            {entries.map((entry) => (
              <GroupedListRow
                key={entry.id}
                label={entry.title || t("schedule.untitled")}
                description={entry.collectionName}
                detail={formatTime(entry.scheduledFor)}
                to={`/content/${encodeURIComponent(entry.collectionHandle)}/${entry.id}`}
              />
            ))}
          </GroupedList>
        );
      })}
    </div>
  );
}

function IconLinkButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof ChevronLeft;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full text-accent hover:bg-fill focus-visible:focus-ring"
    >
      <Icon aria-hidden="true" strokeWidth={2} className="size-5" />
    </button>
  );
}

/** Entries by the day they're due, in the browser's time zone, soonest first. */
function groupByDay(entries: readonly ScheduledEntry[]): Map<string, ScheduledEntry[]> {
  const days = new Map<string, ScheduledEntry[]>();
  for (const entry of entries) {
    const key = dayKey(new Date(entry.scheduledFor));
    days.set(key, [...(days.get(key) ?? []), entry]);
  }
  return days;
}

function formatTime(isoDate: string): string {
  return new Intl.DateTimeFormat(formattingLocale(), { timeStyle: "short" }).format(
    new Date(isoDate),
  );
}
