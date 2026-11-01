import { fileURLToPath } from "node:url";
import { definePlugin } from "@lintel/core/plugin";
import { bookingsRoutes } from "./bookings.routes.js";
import { bookingSettingsSchema } from "./bookings.schema.js";
import { bookingsTable } from "./bookings.table.js";

/**
 * The server half of the Bookings plugin. Lintel loads it from `./server` because the
 * package is listed in lintel.config.ts. The admin half, with the same id, is in src/admin.
 */
export default definePlugin({
  id: "bookings",
  name: "Bookings",
  description: "Appointments, and the people who made them.",
  version: "0.1.0",
  permissions: [
    { permission: "bookings:read", description: "See bookings" },
    { permission: "bookings:manage", description: "Add, change and cancel bookings" },
  ],
  settings: {
    schema: bookingSettingsSchema,
    defaults: { defaultDurationMinutes: 60 },
  },
  database: {
    tables: [bookingsTable],
    // The same folder from src (in development) and from dist.
    migrationsFolder: fileURLToPath(new URL("../../migrations", import.meta.url)),
  },
  routes: bookingsRoutes,
});
