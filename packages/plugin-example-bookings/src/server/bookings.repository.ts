import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction, PersonLookup } from "@lintel/core/plugin";
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

/** Bookings made by one person: the same email, or the same whole name (ignoring case). */
export async function listBookingRowsForPerson(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
): Promise<BookingRow[]> {
  const matches = [
    person.email
      ? sql`lower(${bookingsTable.customerEmail}) = ${person.email.toLowerCase()}`
      : undefined,
    person.name
      ? sql`lower(trim(${bookingsTable.customerName})) = ${person.name.trim().toLowerCase()}`
      : undefined,
  ];
  return database
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tenantId, tenantId), or(...matches)))
    .orderBy(asc(bookingsTable.startsAt));
}

export async function deleteBookingRows(
  database: DatabaseOrTransaction,
  bookingIds: readonly string[],
): Promise<number> {
  if (bookingIds.length === 0) return 0;
  const deleted = await database
    .delete(bookingsTable)
    .where(inArray(bookingsTable.id, [...bookingIds]))
    .returning({ id: bookingsTable.id });
  return deleted.length;
}
