import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import {
  type DatabaseOrTransaction,
  deleteReturning,
  insertReturning,
  type PersonLookup,
  tableFor,
  updateReturning,
} from "@lintel/core/plugin";
import {
  type BookingRow,
  bookingsTable as bookingsDefinition,
  type NewBookingRow,
} from "./bookings.table.js";

/**
 * Database reads and writes for bookings, nothing else. Each function gets the table through
 * `tableFor`, and writes through helpers such as `insertReturning`, so the same code runs on
 * Postgres, MySQL and MariaDB.
 */

export async function listBookingRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  span: { from?: Date; to?: Date },
): Promise<BookingRow[]> {
  const bookingsTable = tableFor(database, bookingsDefinition);
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
  const bookingsTable = tableFor(database, bookingsDefinition);
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
  const bookingsTable = tableFor(database, bookingsDefinition);
  const [inserted] = await insertReturning(database, bookingsTable, booking);
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
  const bookingsTable = tableFor(database, bookingsDefinition);
  const [updated] = await updateReturning(
    database,
    bookingsTable,
    changes,
    and(eq(bookingsTable.tenantId, tenantId), eq(bookingsTable.id, bookingId)),
  );
  return updated;
}

export async function deleteBookingRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  bookingId: string,
): Promise<boolean> {
  const bookingsTable = tableFor(database, bookingsDefinition);
  const deleted = await deleteReturning(
    database,
    bookingsTable,
    and(eq(bookingsTable.tenantId, tenantId), eq(bookingsTable.id, bookingId)),
    { id: bookingsTable.id },
  );
  return deleted.length > 0;
}

/** Bookings made by one person: the same email, or the same whole name (ignoring case). */
export async function listBookingRowsForPerson(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
): Promise<BookingRow[]> {
  const bookingsTable = tableFor(database, bookingsDefinition);
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
  const bookingsTable = tableFor(database, bookingsDefinition);
  if (bookingIds.length === 0) return 0;
  const deleted = await deleteReturning(
    database,
    bookingsTable,
    inArray(bookingsTable.id, [...bookingIds]),
    { id: bookingsTable.id },
  );
  return deleted.length;
}
