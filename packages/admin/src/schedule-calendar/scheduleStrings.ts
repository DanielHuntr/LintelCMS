/** Words for the schedule calendar (see README.md). Spread into i18n/strings.ts. */
export const scheduleStrings = {
  "schedule.nav": "Schedule",
  "schedule.title": "Schedule",
  "schedule.previousMonth": "Previous month",
  "schedule.nextMonth": "Next month",
  "schedule.thisMonth": "This month",
  "schedule.loading": "Loading what’s scheduled",
  "schedule.calendarLabel": "Scheduled in {month}",
  "schedule.today": "Today",
  "schedule.dayLabel": "{date}, {count, plural, =0 {nothing due} one {1 due} other {# due}}",
  "schedule.publishes": "Publishes at {time}",
  "schedule.untitled": "Untitled",
  "schedule.empty.title": "Nothing scheduled in {month}",
  "schedule.empty.description":
    "To publish something later, open it and choose Schedule in its Status panel. It shows here until it goes live.",
  "schedule.footer":
    "Times are in your own time zone. Pages and posts publish on their own at the time shown.",
} as const;
