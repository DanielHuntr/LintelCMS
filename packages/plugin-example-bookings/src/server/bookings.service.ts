import { DEFAULT_TENANT_ID, type DatabaseOrTransaction } from "@lintel/core/plugin";
import { BookingNotFoundError } from "./bookings.errors.js";
import {
  deleteBookingRow,
  findBookingRow,
  insertBookingRow,
  listBookingRows,
  updateBookingRow,
} from "./bookings.repository.js";
import type { Booking, BookingChanges, BookingSettings, NewBooking } from "./bookings.schema.js";
import type { BookingRow } from "./bookings.table.js";

/** Business rules for bookings: making, changing and cancelling them. */

export async function listBookings(
  database: DatabaseOrTransaction,
  span: { from?: string; to?: string },
): Promise<{ bookings: Booking[] }> {
  const rows = await listBookingRows(database, DEFAULT_TENANT_ID, {
    from: span.from ? new Date(span.from) : undefined,
    to: span.to ? new Date(span.to) : undefined,
  });
  return { bookings: rows.map(describeBooking) };
}

export async function findBooking(
  database: DatabaseOrTransaction,
  bookingId: string,
): Promise<Booking> {
  const row = await findBookingRow(database, DEFAULT_TENANT_ID, bookingId);
  if (!row) {
    throw new BookingNotFoundError();
  }
  return describeBooking(row);
}

/** A booking without a length gets the usual one, from the plugin's settings. */
export async function createBooking(
  database: DatabaseOrTransaction,
  input: NewBooking,
  settings: BookingSettings,
): Promise<Booking> {
  const row = await insertBookingRow(database, {
    tenantId: DEFAULT_TENANT_ID,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    startsAt: new Date(input.startsAt),
    durationMinutes: input.durationMinutes ?? settings.defaultDurationMinutes,
    notes: input.notes,
  });
  return describeBooking(row);
}

export async function updateBooking(
  database: DatabaseOrTransaction,
  bookingId: string,
  changes: BookingChanges,
): Promise<Booking> {
  const { startsAt, ...rest } = changes;
  const row = await updateBookingRow(database, DEFAULT_TENANT_ID, bookingId, {
    ...rest,
    ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
  });
  if (!row) {
    throw new BookingNotFoundError();
  }
  return describeBooking(row);
}

export async function cancelBooking(
  database: DatabaseOrTransaction,
  bookingId: string,
): Promise<void> {
  if (!(await deleteBookingRow(database, DEFAULT_TENANT_ID, bookingId))) {
    throw new BookingNotFoundError();
  }
}

function describeBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
