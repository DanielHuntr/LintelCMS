import {
  parseRequest,
  type PluginRouteContext,
  type PluginServer,
  requirePermission,
} from "@lintel/core/plugin";
import {
  bookingChangesSchema,
  bookingIdParamsSchema,
  bookingInputSchema,
  type BookingSettings,
  listBookingsQuerySchema,
} from "./bookings.schema.js";
import { BookingNotFoundError } from "./bookings.errors.js";
import {
  cancelBooking,
  createBooking,
  findBooking,
  listBookings,
  updateBooking,
} from "./bookings.service.js";

/**
 * HTTP only. Lintel answers 404 PLUGIN_NOT_ENABLED for all of these while the plugin is off.
 *
 *   GET    /bookings?from=&to=  (bookings:read)    -> { bookings }, earliest first
 *   GET    /bookings/:id        (bookings:read)
 *   POST   /bookings            (bookings:manage)  { customerName, customerEmail, startsAt, durationMinutes?, notes? } -> 201
 *   PATCH  /bookings/:id        (bookings:manage)  any of those
 *   DELETE /bookings/:id        (bookings:manage)  -> 204
 */
export async function bookingsRoutes(
  server: PluginServer,
  { readSettings }: PluginRouteContext<BookingSettings>,
) {
  const canRead = { preHandler: requirePermission("bookings:read") };
  const canManage = { preHandler: requirePermission("bookings:manage") };

  server.get("/bookings", canRead, async (request) =>
    listBookings(server.database, parseRequest(listBookingsQuerySchema, request.query)),
  );

  server.get("/bookings/:id", canRead, async (request) =>
    findBooking(server.database, readBookingId(request.params)),
  );

  server.post("/bookings", canManage, async (request, reply) => {
    const input = parseRequest(bookingInputSchema, request.body);
    const booking = await createBooking(
      server.database,
      input,
      await readSettings(server.database),
    );
    return reply.code(201).send(booking);
  });

  server.patch("/bookings/:id", canManage, async (request) => {
    const changes = parseRequest(bookingChangesSchema, request.body);
    return updateBooking(server.database, readBookingId(request.params), changes);
  });

  server.delete("/bookings/:id", canManage, async (request, reply) => {
    await cancelBooking(server.database, readBookingId(request.params));
    return reply.code(204).send();
  });
}

/** An id that isn't even a UUID can't be a booking, so it gets the same 404. */
function readBookingId(params: unknown): string {
  const parsed = bookingIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new BookingNotFoundError();
  }
  return parsed.data.id;
}
