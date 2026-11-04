---
title: Building add-ons
description: Package field types, template tags, builder elements, admin screens, event handlers, jobs and commands as an npm package any Lintel site can install.
since: "0.1"
---

An **add-on** is a plugin packaged on its own: an npm package (or a folder) that a site
installs with one command, without touching Lintel's source. It can add any of:

| Part                             | In the add-on                       | Example                                             |
| -------------------------------- | ----------------------------------- | --------------------------------------------------- |
| Field types, with an editor      | `fieldtypes`, admin `fieldEditors`  | A colour swatch picked from a palette               |
| Liquid tags and filters          | `liquid`                            | `{% example_opening_hours %}`                       |
| Builder elements                 | `blocks`                            | A "Colour swatch" card in Insert                    |
| Dashboard widgets and screens    | admin `dashboardWidgets`, `screens` | "Open today 9:00–17:00"                             |
| Settings, with a form            | `settings`                          | The opening hours                                   |
| Things done when content changes | `events`                            | Log a form sent on a closed day                     |
| Work done on a timer             | `jobs`                              | A daily check                                       |
| Terminal commands                | `commands`                          | `lintel example:hours`                              |
| API routes and tables            | `routes`, `database`                | See [Writing a plugin](/building/writing-a-plugin/) |

An add-on runs inside Lintel with full access, and sites list it in **Build → Add-ons**. To
connect a service from its own server instead, with only the access a site owner approves,
build an [app](/building/building-an-app/) (`pnpm lintel apps new`); apps are listed
beside add-ons, in **Build → Apps**.

`packages/addon-example` in the repository has one of each. Read it beside this page.

## Start one

From your copy of Lintel:

```bash
pnpm build                                  # once, so the add-on can find Lintel's types
pnpm lintel addons new star-ratings --folder ../star-ratings
cd ../star-ratings
npm install
npm test                                    # runs its tests on a real Lintel
npm run dev                                 # rebuilds dist/ whenever you save
```

The new add-on has a Rating field with its editor, a Liquid tag and filter, a Callout
element, a dashboard widget, an event handler, settings and tests. Lintel's own packages
aren't published to npm yet, so the add-on links to the copy of Lintel it was made from.

To try it in your site, link it and restart Lintel:

```bash
pnpm lintel addons link ../star-ratings     # from your Lintel folder
pnpm dev
```

It is switched on at that start, and appears in **Build → Add-ons**. Restart Lintel when you
change its server half; reload the admin when you change its admin half.

## The two halves

Like every plugin, an add-on has a **server half**, `src/server/index.ts`, exporting
`definePlugin({...})` from `@lintel/core/plugin`, and optionally an **admin half**,
`src/admin/index.tsx`, exporting `defineAdminPlugin({...})` from `@lintel/admin/plugin`.
Both use the same `id`. `lintel addons build` bundles each into one file.

Everything the add-on uses is bundled into it, except what it must share with Lintel:
React, the query client, Zod, Drizzle and the two plugin APIs. Those come from the running
Lintel, so an add-on works in any Lintel it is compatible with, including one installed
from a release where the admin is already built.

## Field types

```ts
import { defineFieldtype } from "@lintel/core/plugin";
import { z } from "zod";

export const swatchFieldtype = defineFieldtype({
  type: "example.swatch", // starts with the add-on's id and a dot
  name: "Colour swatch",
  description: "A colour picked from your palette.",
  category: "choices", // where "Add a field" lists it
  optionsSchema: z.object({ palette: z.array(z.string()).default([]) }),
  buildValueSchema: (options, label) =>
    z.string().regex(/^#[0-9a-f]{6}$/, { error: `${label} should be a colour like #1a7f5a` }),
  // What the delivery API, GraphQL and Liquid get. Left out, they get the stored value.
  deliver: (value) => ({ hex: value, name: nameOf(String(value)) }),
});
```

It then works like a built-in type: in content types, fieldsets, groups and blocks; with
required, defaults, conditions and validation; in the API, GraphQL (as JSON) and templates.
Every text inside a value is found by the admin's search. Its editor goes in the admin half:

```tsx
import type { FieldEditorProps } from "@lintel/admin/plugin";

export function SwatchEditor({ field, value, onChange, controlId, describedBy }: FieldEditorProps) {
  // Put controlId on the main control so the field's label points at it.
}

defineAdminPlugin({
  id: "example",
  fieldEditors: [{ type: "example.swatch", Editor: SwatchEditor }],
});
```

## Liquid tags and filters

```ts
liquid: {
  tags: [
    {
      name: "example_opening_hours",   // starts with the id (dashes as underscores) and _
      render: async ({ value, options }, { readSettings }) => {
        const hours = await readSettings();
        return `<table>…${escapeHtml(hours.monday)}…</table>`;
      },
    },
  ],
  filters: [
    { name: "example_colour_name", apply: (value) => nameOf(value) },
    { name: "example_swatch", html: true, apply: (value) => chipHtml(value) },
  ],
},
```

A tag is written `{% example_open_today %}`, `{% example_chip entry.data.colour %}` or
`{% example_open_today label: "Open" %}`: an optional value, then `name: value` options. What
it returns goes into the page as HTML, so escape what you put in it with `escapeHtml`. A
filter's result is escaped unless it says `html: true`.

While the add-on is switched off its tags draw nothing and its filters hand their value back,
so templates keep working. A tag that throws leaves a gap and a line in the log, not an
error page.

## Builder elements

```ts
import { colour, defineBlock, text } from "@lintel/core/plugin";

blocks: [
  defineBlock({
    handle: "example_swatch_card",     // starts with the id (dashes as underscores) and _
    name: "Colour swatch",
    icon: "palette",
    properties: { colour: colour({ required: true }), label: text({ required: true }) },
    render: '<figure><span style="background:{{colour}}"></span><figcaption>{{label}}</figcaption></figure>',
  }),
],
```

It is offered in the builder's Insert menu under "Your components" while the add-on is on,
and edited with its properties like any block, by the same people. `render` can also be a
React component, drawn on the server. See [Blocks in code](/building/blocks-in-code/).

## Screens, widgets and settings

The admin half adds sidebar items, screens, Settings rows, dashboard widgets, section tabs,
entry editor panels and field editors, built from the admin's own components (`Card`,
`GroupedList`, `Button`, `TextField`...), so they look right in light and dark and work with
a keyboard and screen reader. Its words go through `createTranslator`. See
[The plugin API](/building/plugin-api/) for each.

Settings need no screen of their own when they are simple (text, numbers, on/off, a choice):
**Build → Add-ons** draws a form from the Zod schema. Use `.max()`, `.min()` and `.enum()`;
they become the form's limits and choices.

An add-on's admin half can only rely on CSS classes Lintel's admin already uses. For
anything else, import a CSS file in `src/admin/index.tsx` and name the built file in the
manifest as `adminStyles`.

## Events and jobs

```ts
events: {
  "entry.published": async (event, { log }) => log.info(`${event.data.entry.title} is live`),
  "form.submitted": async (event, { readSettings }) => { … },
  "order.paid": async (event) => { … },
},
jobs: [
  { id: "sync-stock", name: "Syncing stock", everyMinutes: 15, run: async ({ database }) => { … } },
],
```

Handlers are typed by their event and run after the change is saved, only while the add-on
is on. One failing is logged and doesn't affect the others. Jobs run once when Lintel starts
and then every `everyMinutes`; every server process runs them, so make a job safe to run
twice. Each is given `database`, `readSettings()` and `log`. The events are listed in
[Automations](/building/workflows/).

An add-on that passes people on to someone else can make a form ask first. Return the words
for a consent box, or `null` when the form needs none:

```ts
formConsent: async (form, database) =>
  form.handle === "newsletter" ? "I'd like the newsletter." : null,
```

While the add-on is on, a consent box the form already has becomes required, and a form
without one gets this one. The saved form doesn't change. `form.submitted` lists the boxes
that were ticked in `submission.consents`.

## Terminal commands

```ts
commands: [
  {
    name: "hours",
    description: "Shows the opening hours the website shows.",
    run: async ({ arguments: words, readSettings, say }) => { say("Monday 9:00–17:00"); },
  },
],
```

Run as `pnpm lintel example:hours`, with the site's database open. `lintel help` lists every
add-on's commands.

## Personal data

If an add-on keeps anything that can identify a person, declare it, so
[Settings → Privacy](/using/privacy/) can list it, and give it the three hooks so people's
requests reach it. Say which columns are personal once: here, or with `"personalData": true`
on a column under [`tables`](#saying-what-it-keeps-and-does). Privacy and the Add-ons screen
read both, so there's no need to repeat it.

```ts
personalData: {
  description: "The name and email of each person who books.",
  tables: [
    {
      name: "bookings",
      columns: [
        { name: "customer_name", personalData: true },
        { name: "customer_email", personalData: true },
        { name: "starts_at" },
      ],
    },
  ],
  find: async ({ database, tenantId, person }) => [
    { id: "…", summary: "Booking on 3 Nov", date: "2026-11-03T10:00:00.000Z" },
  ],
  export: async ({ database, tenantId, person }) => [{ name: "…", email: "…" }],
  erase: async ({ database, tenantId, person }) => ({ deleted: 1 }),
},
```

`person` is `{ email, name }`, with `null` for whichever wasn't given. Match an email whole and
ignoring case, and a name only as a whole name, never part of one: erasing can't be undone.

- `find` returns a short line for each thing found.
- `export` returns plain rows. Each becomes a row of a spreadsheet in the person's download.
- `erase` returns `{ deleted, anonymised?, kept?, explanation? }`. Say in `explanation` why
  anything stayed. The hooks run while the add-on is switched off too, because its data stays.

An add-on with no server code to run can say so in package.json instead, under `tables` or as
below:

```json
"lintel-addon": {
  "id": "swatches",
  "lintel": ">=1.0.0-rc.1",
  "personalData": {
    "tables": [{ "name": "swatches_votes", "columns": [{ "name": "email", "personalData": true }] }]
  }
}
```

Without all three hooks, an add-on is listed as one that can't be searched, and so is one with
tables that says nothing. Declaring tables with no `personalData: true` column says it keeps
none, and it isn't listed. `packages/plugin-example-bookings` is a full example, in
`bookings.personal-data.ts`.

## Tests

`@lintel/core/plugin-testing` starts a real Lintel with a database in memory and the add-on
switched on:

```ts
const lintel = await startPluginTestServer({ plugins: [addon] });
await lintel.renderLiquid("{% example_opening_hours %}");
await lintel.runCommand("example:hours");
await lintel.runJob("example", "check-hours");
const asOwner = await lintel.signInWith(["*"]);
await asOwner({ method: "GET", url: "/blocks" });
```

## Packaging

The add-on's `package.json` says what it is:

```json
{
  "name": "lintel-addon-star-ratings",
  "version": "1.0.0",
  "files": ["dist", "migrations"],
  "lintel-addon": {
    "id": "star-ratings",
    "lintel": ">=1.0.0-rc.1",
    "server": "dist/server.js",
    "admin": "dist/admin.js"
  }
}
```

`lintel` is the range of Lintel versions it works with, written as npm writes ranges
(`>=1.0.0-rc.1`, `^1.2.0`, `>=1.0.0 <2.0.0`). Run `npm run build`, then `npm publish`.

### Saying what it keeps and does

Site owners see what an add-on stores, adds, runs and talks to before and after they
install it, so describe it in the same `lintel-addon` section. Also fill in `license`,
`author` and `repository`: they show under "Where it comes from".

```json
"lintel-addon": {
  "id": "star-ratings",
  "lintel": ">=1.0.0-rc.1",
  "tables": [
    {
      "name": "star_ratings_votes",
      "purpose": "Each visitor's rating of a page.",
      "columns": [
        { "name": "page_id", "purpose": "The page rated." },
        { "name": "email", "purpose": "Who rated it.", "personalData": true }
      ]
    }
  ],
  "publicRoutes": [
    { "method": "POST", "path": "/star-ratings/vote", "purpose": "Saves a visitor's rating." }
  ],
  "jobs": [{ "id": "tidy", "purpose": "Removes votes for deleted pages." }],
  "events": [{ "event": "entry.published", "purpose": "Refreshes the page's average." }],
  "hosts": [{ "host": "api.example.com", "purpose": "Checks votes for spam." }]
}
```

| Key            | What it says                                                            |
| -------------- | ----------------------------------------------------------------------- |
| `tables`       | `{ name, purpose, columns: [{ name, purpose, personalData? }] }`        |
| `publicRoutes` | Addresses anyone can reach: `{ method, path, purpose }`                 |
| `jobs`         | `{ id, purpose }`, by the job's `id`; the schedule comes from your code |
| `events`       | `{ event, purpose }`, by the event's name                               |
| `hosts`        | Other servers it talks to: `{ host, purpose }`                          |

Mark a column `personalData` when it can identify someone: a name, an email address, an IP
address, or notes about a person. The privacy tools rely on these marks, so be generous.

Services the cookie notice asks about stay in `consentServices` in `definePlugin`, and
Lintel reads them from there.

**Build → Add-ons** marks each item. **Checked by Lintel** means Lintel found it for itself:
the tables and columns in the database, the routes, jobs, events and permissions your code
registers, the consent services, npm's integrity and a fingerprint of your server file.
**Says the add-on** is everything only you can say, such as purposes and hosts. A table with
your add-on's name that isn't listed gets a warning, and so does anything listed that Lintel
can't find. Only tables listed here, or in `database.tables`, go in backups.

A plugin from `lintel.config.ts` has no `lintel-addon` section, so it passes the same lists
to `definePlugin` as `declares`.

## Installing

```bash
pnpm lintel addons add lintel-addon-star-ratings     # from npm; a folder or .tgz works too
pnpm lintel addons list
pnpm lintel addons remove star-ratings
```

`add` installs the package into `addons/` in the site's Lintel folder (beside `data/`),
checks it is an add-on that works with this version and switches it on at the next start.
Use `--off` to leave it off. `add` also prints what the add-on says it keeps and does.
`remove` uninstalls it; anything it saved stays in the database, in case it comes back.
To export or delete that data first, use "Removing it" in **Build → Add-ons**. Restart
Lintel after either.

Because the add-ons folder sits beside the site's data, add-ons stay installed through
updates, roll backs and new Docker images. Backups don't include them: they are code,
installed again with `lintel addons add`. Their own tables are in backups, as long as the
add-on declares them in `tables` (see "Saying what it keeps and does" above) or defines
them in `database.tables`.

## When an add-on breaks

Each add-on is loaded on its own when Lintel starts. One that isn't installed, doesn't work
with this version, fails to load or isn't quite right (its names don't start with its id,
say) is left out, and **Build → Add-ons** says why in a sentence. The rest of the site starts
as usual.

Add-ons are trusted code: they run inside Lintel with the same access as Lintel itself, and
the Add-ons screen tells site owners so. Only install ones you trust.

## Coming from Umbraco or Statamic

| Umbraco                    | Statamic                  | Lintel                                     |
| -------------------------- | ------------------------- | ------------------------------------------ |
| Package                    | Addon                     | Add-on (`lintel-addon` in package.json)    |
| Property editor            | Fieldtype                 | Field type (`fieldtypes` + `fieldEditors`) |
| Value converter            | Fieldtype `augment()`     | `deliver()` on the field type              |
| Razor partial / tag helper | Tag                       | Liquid tag (`liquid.tags`)                 |
| Razor helper               | Modifier                  | Liquid filter (`liquid.filters`)           |
| Block list block           | Bard set / Replicator set | Builder element (`blocks`)                 |
| Section / tree             | Control panel section     | Admin screen and sidebar item              |
| Dashboard                  | Widget                    | Dashboard widget                           |
| Notification handler       | Event listener            | `events`                                   |
| Background service         | Scheduled task            | `jobs`                                     |
| -                          | `php please` command      | `lintel <id>:<command>`                    |
| Package settings           | Addon settings            | `settings`, with a form drawn for you      |

## Not yet

- **Rich text extensions.** The rich text editor's buttons and the HTML Lintel makes from
  it are a fixed list. Letting add-ons extend both, so a node added in the editor is drawn
  the same way by the API, is planned.
- **A directory of add-ons.** Add-ons come from npm or a folder; Lintel doesn't run a place
  to find them.
