import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { DatabaseOrTransaction } from "@lintel/core/plugin";
import { type BookingRow, bookingsTable, type NewBookingRow } from "./bookings.table.js";

/** Database reads and writes for bookings, nothing else. */

export async function listBookingRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  span: { from?: Date; to?: Date },
): Promise<BookingRow[]> {
  return database
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.tenantId, tenantId),
        span.from ? gte(bookingsTable.startsAt, span.from) : undefined,
        span.to ? lt(bookingsTable.startsAt, span.to) : undefined,
      ),
    )
    .orderBy(asc(bookingsTable.startsAt));
}

export async function findBookingRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  bookingId: string,
): Promise<BookingRow | undefined> {
  const [row] = await database
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tenantId, tenantId), eq(bookingsTable.id, bookingId)))
    .limit(1);
  return row;
}

export async function insertBookingRow(
  database: DatabaseOrTransaction,
  booking: NewBookingRow,
): Promise<BookingRow> {
  const [inserted] = await database.insert(bookingsTable).values(booking).returning();
  if (!inserted) {
    throw new Error("The database did not return the new booking.");
  }
  return inserted;
}

export async function updateBookingRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  bookingId: string,
  changes: Partial<NewBookingRow>,
): Promise<BookingRow | undefined> {
  const [updated] = await database
    .update(bookingsTable)
    .set(changes)
    .where(and(eq(bookingsTable.tenantId, tenantId), eq(bookingsTable.id, bookingId)))
    .returning();
  return updated;
}

export async function deleteBookingRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  bookingId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(bookingsTable)
    .where(and(eq(bookingsTable.tenantId, tenantId), eq(bookingsTable.id, bookingId)))
    .returning({ id: bookingsTable.id });
  return deleted.length > 0;
}
