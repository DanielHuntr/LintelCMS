import { z } from "zod";

/**
 * The one Zod schema for a booking. The admin imports these too (see src/admin), so the
 * form and the API always agree on what a booking is.
 */

export const bookingSettingsSchema = z.object({
  /** Used when a booking is made without a length. */
  defaultDurationMinutes: z
    .number({ error: "The usual length should be a number of minutes" })
    .int({ error: "The usual length should be a whole number of minutes" })
    .min(5, { error: "A booking is at least 5 minutes" })
    .max(8 * 60, { error: "A booking can be at most 8 hours" }),
});

export const bookingInputSchema = z.object({
  customerName: z
    .string({ error: "Please enter the customer's name" })
    .trim()
    .min(1, { error: "Please enter the customer's name" })
    .max(200, { error: "Names can be at most 200 characters" }),
  customerEmail: z.email({ error: "Please enter an email address like name@example.com" }),
  startsAt: z.iso.datetime({
    offset: true,
    error: "Please choose a date and time for the booking",
  }),
  durationMinutes: bookingSettingsSchema.shape.defaultDurationMinutes.optional(),
  notes: z.string().max(2000, { error: "Notes can be at most 2,000 characters" }).default(""),
});

export const bookingChangesSchema = bookingInputSchema.partial();

export const bookingIdParamsSchema = z.object({ id: z.uuid() });

/** `GET /bookings?from=&to=`: bookings starting in that span, earliest first. */
export const listBookingsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true, error: "from should be a date and time" }).optional(),
  to: z.iso.datetime({ offset: true, error: "to should be a date and time" }).optional(),
});

export const bookingSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number(),
  notes: z.string(),
  createdAt: z.string(),
});

export type BookingSettings = z.infer<typeof bookingSettingsSchema>;
/** What the admin sends to make a booking. */
export type BookingInput = z.input<typeof bookingInputSchema>;
/** The same, checked, with the defaults filled in. */
export type NewBooking = z.output<typeof bookingInputSchema>;
export type BookingChanges = z.infer<typeof bookingChangesSchema>;
export type Booking = z.infer<typeof bookingSchema>;
