import { createTranslator } from "@lintel/admin/plugin";

/** Every word the example add-on shows in the admin, in one place so it can be translated. */
export const t = createTranslator({
  "hours.title": "Opening hours",
  "hours.subtitle": "What your website shows. Change them in Build → Add-ons.",
  "hours.loading": "Loading opening hours",
  "hours.closed": "Closed",
  "hours.today": "Today",
  "hours.widgetDescription": "Whether you're open today, and until when.",
  "hours.openToday": "Open today",
  "hours.closedToday": "Closed today",
  "hours.change": "Change opening hours",
  "day.monday": "Monday",
  "day.tuesday": "Tuesday",
  "day.wednesday": "Wednesday",
  "day.thursday": "Thursday",
  "day.friday": "Friday",
  "day.saturday": "Saturday",
  "day.sunday": "Sunday",
  "swatch.choose": "Colour {hex}",
});
