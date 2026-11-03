import { colour, defineBlock, definePlugin, escapeHtml, text } from "@lintel/core/plugin";
import {
  DAYS,
  dayName,
  dayOf,
  defaultOpeningHours,
  describeToday,
  openingHoursSchema,
  renderOpeningHoursTable,
} from "./opening-hours.js";
import { readSwatch, renderSwatchChip, swatchFieldtype } from "./swatches.js";

/**
 * The server half of the example add-on: one of each thing an add-on can add, small enough
 * to read in one sitting. `pnpm build` bundles it into dist/server.js with
 * `lintel addons build`; the admin half is in src/admin.
 */
export default definePlugin({
  id: "example",
  name: "Swatches and opening hours",
  description: "A colour swatch field, and your opening hours on any page.",
  version: "0.1.0",

  // Settings: the opening hours. The Add-ons screen draws their form from the schema.
  settings: { schema: openingHoursSchema, defaults: defaultOpeningHours },

  // A field type, with its editor in src/admin.
  fieldtypes: [swatchFieldtype],

  // For Liquid templates:
  //   {% example_opening_hours %}                the week as a table, today marked
  //   {% example_open_today label: "Open" %}     "Open 9:00–17:00", or "Closed today"
  //   {{ product.data.colour | example_swatch }} a chip of the colour with its name
  //   {{ product.data.colour | example_colour_name }}  "Green"
  liquid: {
    tags: [
      {
        name: "example_opening_hours",
        render: async (_input, { readSettings }) =>
          renderOpeningHoursTable(await readSettings(), dayOf(new Date())),
      },
      {
        name: "example_open_today",
        render: async ({ options }, { readSettings }) => {
          const label = typeof options.label === "string" ? options.label : undefined;
          const text = describeToday(await readSettings(), dayOf(new Date()), label);
          return `<span class="example-open-today">${escapeHtml(text)}</span>`;
        },
      },
    ],
    filters: [
      { name: "example_swatch", html: true, apply: renderSwatchChip },
      { name: "example_colour_name", apply: (value) => readSwatch(value)?.name ?? "" },
    ],
  },

  // An element for the builder's Insert menu, edited in the builder like Lintel's own.
  blocks: [
    defineBlock({
      handle: "example_swatch_card",
      name: "Colour swatch",
      icon: "palette",
      category: "Swatches and opening hours",
      description: "A colour with its name, for a product's colours or a brand page.",
      properties: { colour: colour({ required: true }), label: text({ required: true }) },
      render:
        '<figure class="example-swatch-card"><span class="example-swatch-card__chip" style="background:{{colour}}"></span><figcaption>{{label}}</figcaption></figure>',
    }),
  ],

  // Things it does when something happens, only while it is switched on.
  events: {
    "form.submitted": async (event, { readSettings, log }) => {
      const today = dayOf(new Date(event.occurredAt));
      const hours = await readSettings();
      if (!hours[today]) {
        log.info(`"${event.data.form.name}" was sent on a day you're closed; reply tomorrow.`);
      }
    },
  },

  // Work it does in the background: a gentle reminder in the log if no hours are set.
  jobs: [
    {
      id: "check-hours",
      name: "Checking the opening hours are filled in",
      everyMinutes: 60 * 24,
      run: async ({ readSettings, log }) => {
        const hours = await readSettings();
        if (DAYS.every((day) => !hours[day])) {
          log.info("No opening hours are set, so the site says you're closed every day.");
        }
      },
    },
  ],

  // `lintel example:hours` prints the week in the terminal.
  commands: [
    {
      name: "hours",
      description: "Shows the opening hours the website shows.",
      run: async ({ readSettings, say }) => {
        const hours = await readSettings();
        for (const day of DAYS) say(`${dayName(day).padEnd(10)} ${hours[day] || "Closed"}`);
        if (hours.note) say(hours.note);
      },
    },
  ],
});
