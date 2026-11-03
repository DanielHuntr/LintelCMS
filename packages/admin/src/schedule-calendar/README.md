# Schedule calendar

`/content/schedule`, reached from **Schedule** at the foot of the content tree (above the
recycle bin). It shows what is due to be published, a month at a time, so an editor can see
the coming week's pages and posts at a glance.

- **Wide screens:** a month calendar (a table, weeks starting on Monday) with each day's
  entries in it: title, time and collection. Each one links to its editor, where its
  schedule can be changed. Today's date is filled in, and days from the months either side
  are shaded. Screen readers hear each day's full date and how many things are due.
- **Phones** (`useIsNarrowScreen`): a list grouped by day, only the days with something due,
  as inset grouped lists with the time on the right. An empty month shows how to schedule.
- Previous month, Next month and This month move through months; the month is in the
  address (`?month=2026-11`), so it survives a reload and can be shared.
- Times are in the browser's time zone, and a day is the day on the person's own calendar.

Lintel schedules publishing only (an entry's `scheduledFor`); there is no scheduled
unpublishing to show. The API's items carry `action: "publish"` so the calendar could show
both if that is added.

The data comes from `GET /entries/scheduled?from=&to=` (`entries:read`, at most 62 days),
which lists the site being worked on and shared collections, soonest first.

| File                      | What it does                                     |
| ------------------------- | ------------------------------------------------ |
| `SchedulePage.tsx`        | The screen: the calendar, or the list on a phone |
| `monthGrid.ts`            | Which days a month view shows, and moving months |
| `scheduleCalendar.api.ts` | `GET /entries/scheduled`                         |
| `scheduleStrings.ts`      | Its words, spread into `i18n/strings.ts`         |
