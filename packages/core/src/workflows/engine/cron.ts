/**
 * Five-field cron schedules ("minute hour day-of-month month day-of-week"), read in UTC.
 * Each field takes `*`, a number, a range `1-5`, a list `1,15` and steps `*\/15` or `0-30/10`.
 * Day of week runs 0 (Sunday) to 6, and 7 is Sunday too. As in classic cron, when both
 * day fields are restricted a day matching either counts.
 *
 * Small on purpose: the builder offers presets ("Every day at 9:00") that become these.
 */
const fieldRanges = [
  { minimum: 0, maximum: 59 },
  { minimum: 0, maximum: 23 },
  { minimum: 1, maximum: 31 },
  { minimum: 1, maximum: 12 },
  { minimum: 0, maximum: 7 },
] as const;

interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  dayOfMonthRestricted: boolean;
  dayOfWeekRestricted: boolean;
}

export function isValidCron(expression: string): boolean {
  return parseCron(expression) !== undefined;
}

/** Whether the schedule fires in the minute containing `date`. */
export function matchesCron(expression: string, date: Date): boolean {
  const cron = parseCron(expression);
  if (!cron) {
    return false;
  }
  const dayOfMonthMatches = cron.daysOfMonth.has(date.getUTCDate());
  const dayOfWeekMatches = cron.daysOfWeek.has(date.getUTCDay());
  const dayMatches =
    cron.dayOfMonthRestricted && cron.dayOfWeekRestricted
      ? dayOfMonthMatches || dayOfWeekMatches
      : dayOfMonthMatches && dayOfWeekMatches;
  return (
    cron.minutes.has(date.getUTCMinutes()) &&
    cron.hours.has(date.getUTCHours()) &&
    cron.months.has(date.getUTCMonth() + 1) &&
    dayMatches
  );
}

function parseCron(expression: string): ParsedCron | undefined {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return undefined;
  }
  const sets = fields.map((field, index) => parseField(field, fieldRanges[index]!));
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = sets;
  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) {
    return undefined;
  }
  if (daysOfWeek.has(7)) {
    daysOfWeek.add(0);
  }
  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
    dayOfMonthRestricted: fields[2] !== "*",
    dayOfWeekRestricted: fields[4] !== "*",
  };
}

function parseField(
  field: string,
  range: { minimum: number; maximum: number },
): Set<number> | undefined {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!match) {
      return undefined;
    }
    const [, base = "", stepText] = match;
    const step = stepText === undefined ? 1 : Number(stepText);
    let start = range.minimum;
    let end = range.maximum;
    if (base !== "*") {
      const [from = "", to] = base.split("-");
      start = Number(from);
      end = to === undefined ? (stepText === undefined ? start : range.maximum) : Number(to);
    }
    if (step < 1 || start < range.minimum || end > range.maximum || start > end) {
      return undefined;
    }
    for (let value = start; value <= end; value += step) {
      values.add(value);
    }
  }
  return values;
}
