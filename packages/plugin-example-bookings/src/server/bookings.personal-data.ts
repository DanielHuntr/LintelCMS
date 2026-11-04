import type { PersonalDataHookContext, PluginPersonalData } from "@lintel/core/plugin";
import { deleteBookingRows, listBookingRowsForPerson } from "./bookings.repository.js";

/** The person's bookings, or only the ones ticked after a search by name. */
async function bookingsFor({ database, tenantId, person, only }: PersonalDataHookContext) {
  const rows = await listBookingRowsForPerson(database, tenantId, person);
  return only ? rows.filter((row) => only.has(row.id)) : rows;
}

/**
 * What Bookings keeps about people, and how Settings → Privacy finds, exports and erases it.
 * A booking is only about the person who made it, so erasing one deletes it.
 */
export const bookingsPersonalData: PluginPersonalData = {
  choosesRecords: true,
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
  async find(context) {
    const rows = await bookingsFor(context);
    return rows.map((row) => ({
      id: row.id,
      summary: `Booking for ${row.durationMinutes} minutes`,
      email: row.customerEmail,
      date: row.startsAt.toISOString(),
    }));
  },
  async export(context) {
    const rows = await bookingsFor(context);
    return rows.map((row) => ({
      name: row.customerName,
      email: row.customerEmail,
      startsAt: row.startsAt.toISOString(),
      durationMinutes: row.durationMinutes,
      notes: row.notes,
    }));
  },
  async erase(context) {
    const rows = await bookingsFor(context);
    return {
      deleted: await deleteBookingRows(
        context.database,
        rows.map((row) => row.id),
      ),
    };
  },
};
