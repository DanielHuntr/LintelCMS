---
title: Writing a plugin
description: Build a plugin step by step, using the Bookings example that ships with Lintel.
since: "0.1"
---

Plugins add features to Lintel: their own tables and API routes, screens in the admin,
dashboard widgets and more. This page builds one from start to finish, following
`packages/plugin-example-bookings`, a small "Bookings" app that ships with Lintel as the
reference. Open it beside this page.

The plugin system is in **beta**: the shape of `definePlugin` may still change before 1.0.

## What you'll build

- A `bookings` table, with its own migration.
- Routes to list, add, change and cancel bookings.
- Two permissions: `bookings:read` and `bookings:manage`.
- A setting: the usual length of a booking.
- A **Bookings** item in the sidebar, with a list and a form.
- A **Today's bookings** widget for the dashboard, and a **Bookings this week** tab.
- A row in Settings.

## Before you start: plugins are trusted code

A plugin runs inside Lintel's server with full access to the database, and its admin
screens run with the signed-in person's session. Lintel doesn't sandbox plugins, so only
install ones you have read or trust. See
[the plugin decision record](https://github.com/DanielHuntr/lintelcms/blob/main/docs/decisions/0011-plugins.md)
for why.

## 1. Make the package

A plugin is a package with two entry points: `./server` for the API and `./admin` for the
admin. In the monorepo, make a folder under `packages/`:

```text
packages/plugin-example-bookings/
  package.json
  drizzle.config.ts        where drizzle-kit finds the table and writes migrations
  migrations/              generated; applied by Lintel when the server starts
  src/server/              definePlugin, the table, routes, service, repository, tests
  src/admin/               defineAdminPlugin, screens, the widget, strings
```

`package.json` points the two entry points at the right files. The server half is built to
`dist`; in development Lintel reads its TypeScript source. The admin half is always
source, because the admin's build compiles it.

```json
{
  "name": "@lintel/plugin-example-bookings",
  "type": "module",
  "exports": {
    "./server": {
      "types": "./dist/server/index.d.ts",
      "development": "./src/server/index.ts",
      "default": "./dist/server/index.js"
    },
    "./admin": "./src/admin/index.tsx"
  },
  "peerDependencies": { "@lintel/core": "*", "@lintel/admin": "*", "react": "^19.3.1" }
}
```

Import from `@lintel/core/plugin` and `@lintel/admin/plugin` only. They hold everything a
plugin needs; the rest of Lintel is internal and may change.

## 2. Add a table

Plugin tables follow Lintel's rules: a `tenantId()` column on every table, and a name that
is the plugin id or starts with it (`bookings`, `bookings_rooms`).

```ts
// src/server/bookings.table.ts
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "@lintel/core/plugin";

export const bookingsTable = pgTable("bookings", {
  id: id(),
  tenantId: tenantId(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  notes: text("notes").notNull().default(""),
  ...timestamps(),
});
```

Then generate the migration from the package folder:

```bash
pnpm --filter @lintel/core build      # drizzle-kit reads @lintel/core/plugin from dist
pnpm --filter @lintel/plugin-example-bookings db:generate --name create_bookings
```

Lintel applies a plugin's migrations every time the server starts, and records them
apart from its own, so you never run them by hand.

## 3. Write the routes

Routes follow Lintel's three layers: the route parses the request and checks permission,
the service holds the rules, the repository talks to the database. One Zod schema per
entity, in `bookings.schema.ts`, is used by the routes and imported by the admin too.

```ts
// src/server/bookings.routes.ts (shortened)
export async function bookingsRoutes(
  server: PluginServer,
  { readSettings }: PluginRouteContext<BookingSettings>,
) {
  const canManage = { preHandler: requirePermission("bookings:manage") };

  server.post("/bookings", canManage, async (request, reply) => {
    const input = parseRequest(bookingInputSchema, request.body);
    const settings = await readSettings(server.database);
    return reply.code(201).send(await createBooking(server.database, input, settings));
  });
}
```

You don't check that the plugin is switched on: Lintel puts every plugin's routes behind
that check, and answers `404 PLUGIN_NOT_ENABLED` while it is off.

## 4. Define the plugin

`src/server/index.ts` brings it together. The id is the plugin's name everywhere: in
permissions, tables, fieldtypes, settings and the admin half.

```ts
import { fileURLToPath } from "node:url";
import { definePlugin } from "@lintel/core/plugin";

export default definePlugin({
  id: "bookings",
  name: "Bookings",
  description: "Appointments, and the people who made them.",
  version: "0.1.0",
  permissions: [
    { permission: "bookings:read", description: "See bookings" },
    { permission: "bookings:manage", description: "Add, change and cancel bookings" },
  ],
  settings: { schema: bookingSettingsSchema, defaults: { defaultDurationMinutes: 60 } },
  database: {
    tables: [bookingsTable],
    migrationsFolder: fileURLToPath(new URL("../../migrations", import.meta.url)),
  },
  routes: bookingsRoutes,
});
```

Settings are saved by Lintel (`GET` and `PUT /plugins/bookings/settings`) and checked
with your schema; your routes read them with `readSettings`. The full list of options is
in the [plugin API reference](/building/plugin-api/).

## 5. Test it

`@lintel/core/plugin-testing` starts a real Lintel server with your plugin installed and
switched on, on a database held in memory:

```ts
const lintel = await startPluginTestServer({ plugins: [bookingsPlugin] });
const receptionist = await lintel.signInWith(["bookings:read", "bookings:manage"]);

const created = await receptionist({ method: "POST", url: "/bookings", payload: haircut });
expect(created.json().durationMinutes).toBe(60);

await lintel.setEnabledPlugins([]);
expect((await receptionist({ method: "GET", url: "/bookings" })).statusCode).toBe(404);
```

The bookings tests (`src/server/bookings.test.ts`) cover permissions, validation messages,
settings and switching the plugin off; copy them as a starting point.

## 6. Build the admin screens

The admin half is React, built from Lintel's own components so it looks and behaves like
the rest of the admin, in light and dark mode and by keyboard:

```tsx
// src/admin/BookingsPage.tsx
import { LargeTitle, PluginLink, useCan } from "@lintel/admin/plugin";

export function BookingsPage() {
  const canManage = useCan("bookings:manage");
  return (
    <>
      <LargeTitle
        title={t("bookings.title")}
        actions={
          canManage && (
            <PluginLink to="/bookings/new" variant="filled">
              {t("bookings.new")}
            </PluginLink>
          )
        }
      />
      <BookingList from={startOfToday()} emptyTitle={t("bookings.emptyTitle")} />
    </>
  );
}
```

Call the API with `apiRequest` (it sends the session cookie and turns failures into
readable errors) and cache with TanStack Query, as Lintel's screens do. Keep every word in
one place with `createTranslator`, so the plugin can be translated:

```ts
export const t = createTranslator({ "bookings.title": "Bookings", "bookings.new": "New booking" });
```

## 7. Define the admin half

`src/admin/index.tsx` says where everything goes. Each contribution can name a
permission; people without it don't see it. Nothing shows while the plugin is off.

```tsx
export default defineAdminPlugin({
  id: "bookings",
  sidebarItems: [
    {
      path: "/bookings",
      label: t("bookings.title"),
      icon: CalendarDays,
      permission: "bookings:read",
    },
  ],
  screens: [
    { path: "/bookings", component: BookingsPage, permission: "bookings:read" },
    { path: "/bookings/$bookingId", component: BookingFormPage, permission: "bookings:read" },
    { path: "/bookings/settings", component: BookingSettingsPage, permission: "settings:read" },
  ],
  settingsRows: [
    {
      group: "Bookings",
      label: "Bookings",
      description: "The usual length of a booking",
      icon: CalendarClock,
      to: "/bookings/settings",
      permission: "settings:read",
    },
  ],
  dashboardWidgets: [
    {
      id: "today",
      title: t("bookings.todayTitle"),
      description: t("bookings.todayDescription"),
      icon: CalendarClock,
      component: TodaysBookingsWidget,
      defaultSize: "medium",
      permission: "bookings:read",
      onDefaultDashboard: true,
    },
  ],
  dashboardTabs: [
    {
      section: "/",
      id: "week",
      label: t("bookings.weekTab"),
      component: BookingsWeekTab,
      permission: "bookings:read",
    },
  ],
});
```

A screen's `$bookingId` arrives as `params.bookingId`. Fixed paths such as
`/bookings/settings` win over `$name` ones, whatever order they are listed in. Widgets
and tabs are explained in [Dashboards and widgets](/building/dashboards/).

## 8. Install it

At the repository root:

```bash
pnpm add -w @lintel/plugin-example-bookings    # or your npm package
```

and list it in `lintel.config.ts`:

```ts
import type { LintelConfig } from "@lintel/core";

export default {
  plugins: ["@lintel/plugin-example-bookings"],
} satisfies LintelConfig;
```

Restart `pnpm dev`. The server creates the table, and **Settings → Features** lists
**Bookings** under "Added by your developer", switched off. Switch it on, and the sidebar
item, screens, widget and tab appear for everyone allowed to see them.

## Switching off and uninstalling

Switching a plugin off hides it and keeps everything: its tables, its settings and the
widgets people placed. Switching it back on brings it all back.

To uninstall, remove it from `lintel.config.ts` and the root `package.json`, and restart.
Lintel never drops a plugin's tables by itself; if you want the data gone, drop them
yourself once you are sure.

## Checklist

- The id is lowercase letters, numbers and dashes, and every permission, table and
  fieldtype starts with it. Lintel refuses to start otherwise, and says which one.
- Every table has `tenantId()`.
- Every word in the admin goes through your `t()`.
- Every screen has one `h1` (`LargeTitle`), every input a visible label.
- Tests for the routes, with `startPluginTestServer`.
