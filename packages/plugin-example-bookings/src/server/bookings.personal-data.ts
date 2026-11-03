import type { PluginPersonalData } from "@lintel/core/plugin";
import { deleteBookingRows, listBookingRowsForPerson } from "./bookings.repository.js";

/**
 * What Bookings keeps about people, and how Settings → Privacy finds, exports and erases it.
 * A booking is only about the person who made it, so erasing one deletes it.
 */
export const bookingsPersonalData: PluginPersonalData = {
  description: "The name, email and notes of each person who books.",
  tables: [
    {
      name: "bookings",
      columns: [
        { name: "customer_name", personalData: true },
        { name: "customer_email", personalData: true },
        { name: "notes", personalData: true, description: "Anything they or you wrote" },
        { name: "starts_at" },
        { name: "duration_minutes" },
      ],
    },
  ],
  async find({ database, tenantId, person }) {
    const rows = await listBookingRowsForPerson(database, tenantId, person);
    return rows.map((row) => ({
      id: row.id,
      summary: `Booking for ${row.durationMinutes} minutes`,
      date: row.startsAt.toISOString(),
    }));
  },
  async export({ database, tenantId, person }) {
    const rows = await listBookingRowsForPerson(database, tenantId, person);
    return rows.map((row) => ({
      name: row.customerName,
      email: row.customerEmail,
      startsAt: row.startsAt.toISOString(),
      durationMinutes: row.durationMinutes,
      notes: row.notes,
    }));
  },
  async erase({ database, tenantId, person }) {
    const rows = await listBookingRowsForPerson(database, tenantId, person);
    return {
      deleted: await deleteBookingRows(
        database,
        rows.map((row) => row.id),
      ),
    };
  },
};
