import { apiRequest } from "@lintel/admin/plugin";
import type { Booking, BookingInput, BookingSettings } from "../server/bookings.schema.js";

/** Calls to the plugin's own routes (see src/server/bookings.routes.ts). */

export async function listBookings(span: { from: Date; to?: Date }): Promise<Booking[]> {
  const query = new URLSearchParams({ from: span.from.toISOString() });
  if (span.to) query.set("to", span.to.toISOString());
  return (await apiRequest<{ bookings: Booking[] }>(`/bookings?${query}`)).bookings;
}

export const getBooking = (bookingId: string) =>
  apiRequest<Booking>(`/bookings/${encodeURIComponent(bookingId)}`);

export const createBooking = (input: BookingInput) =>
  apiRequest<Booking>("/bookings", { method: "POST", body: input });

export const updateBooking = (bookingId: string, input: BookingInput) =>
  apiRequest<Booking>(`/bookings/${encodeURIComponent(bookingId)}`, {
    method: "PATCH",
    body: input,
  });

export const cancelBooking = (bookingId: string) =>
  apiRequest<void>(`/bookings/${encodeURIComponent(bookingId)}`, { method: "DELETE" });

export const getBookingSettings = () => apiRequest<BookingSettings>("/plugins/bookings/settings");

export const saveBookingSettings = (settings: BookingSettings) =>
  apiRequest<BookingSettings>("/plugins/bookings/settings", { method: "PUT", body: settings });
