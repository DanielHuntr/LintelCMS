import { startPluginTestServer, type PluginTestServer } from "@lintel/core/plugin-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import bookingsPlugin from "./index.js";

/**
 * The Bookings plugin against a real Lintel server, the way the admin uses it. These tests
 * are also the reference for testing a plugin of your own.
 */
describe("the Bookings plugin", () => {
  let lintel: PluginTestServer;

  beforeAll(async () => {
    lintel = await startPluginTestServer({ plugins: [bookingsPlugin] });
  });
  afterAll(() => lintel.close());
  beforeEach(async () => {
    await lintel.database.execute(sql`truncate table bookings`);
    await lintel.setEnabledPlugins(["bookings"]);
  });

  const haircut = {
    customerName: "Grace Hopper",
    customerEmail: "grace@example.com",
    startsAt: "2026-11-02T10:00:00.000Z",
    notes: "Prefers mornings",
  };

  it("makes, lists, changes and cancels bookings", async () => {
    const receptionist = await lintel.signInWith(["bookings:read", "bookings:manage"]);

    const created = await receptionist({ method: "POST", url: "/bookings", payload: haircut });
    expect(created.statusCode).toBe(201);
    // No length was given, so the plugin's default setting (an hour) is used.
    expect(created.json()).toMatchObject({ ...haircut, durationMinutes: 60 });
    const bookingId = created.json().id as string;

    const changed = await receptionist({
      method: "PATCH",
      url: `/bookings/${bookingId}`,
      payload: { durationMinutes: 30 },
    });
    expect(changed.json().durationMinutes).toBe(30);

    const list = await receptionist({ method: "GET", url: "/bookings" });
    expect(list.json().bookings).toHaveLength(1);

    expect(
      (await receptionist({ method: "DELETE", url: `/bookings/${bookingId}` })).statusCode,
    ).toBe(204);
    expect((await receptionist({ method: "GET", url: `/bookings/${bookingId}` })).statusCode).toBe(
      404,
    );
  });

  it("lists the bookings in a span of time, earliest first", async () => {
    const receptionist = await lintel.signInWith(["bookings:*"]);
    for (const startsAt of [
      "2026-11-03T09:00:00Z",
      "2026-11-02T15:00:00Z",
      "2026-11-02T09:00:00Z",
    ]) {
      await receptionist({ method: "POST", url: "/bookings", payload: { ...haircut, startsAt } });
    }

    const monday = await receptionist({
      method: "GET",
      url: "/bookings?from=2026-11-02T00:00:00Z&to=2026-11-03T00:00:00Z",
    });

    expect(monday.json().bookings.map((booking: { startsAt: string }) => booking.startsAt)).toEqual(
      ["2026-11-02T09:00:00.000Z", "2026-11-02T15:00:00.000Z"],
    );
  });

  it("explains what is wrong with a booking", async () => {
    const receptionist = await lintel.signInWith(["bookings:manage"]);

    const response = await receptionist({
      method: "POST",
      url: "/bookings",
      payload: { customerName: " ", customerEmail: "grace", startsAt: "tomorrow" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("Please enter the customer's name");
    expect(response.json().message).toContain("Please enter an email address");
    expect(response.json().message).toContain("Please choose a date and time");
  });

  it("uses the usual length from the plugin's settings", async () => {
    const admin = await lintel.signInWith(["*"]);
    await admin({
      method: "PUT",
      url: "/plugins/bookings/settings",
      payload: { defaultDurationMinutes: 45 },
    });

    const created = await admin({ method: "POST", url: "/bookings", payload: haircut });

    expect(created.json().durationMinutes).toBe(45);
  });

  it("needs bookings:read to look and bookings:manage to change anything", async () => {
    const viewer = await lintel.signInWith(["bookings:read"]);
    const editor = await lintel.signInWith(["entries:*"]);

    expect((await viewer({ method: "GET", url: "/bookings" })).statusCode).toBe(200);
    expect((await viewer({ method: "POST", url: "/bookings", payload: haircut })).statusCode).toBe(
      403,
    );
    expect((await editor({ method: "GET", url: "/bookings" })).statusCode).toBe(403);
  });

  it("is not there while switched off, and keeps its bookings for when it is back", async () => {
    const receptionist = await lintel.signInWith(["bookings:*"]);
    await receptionist({ method: "POST", url: "/bookings", payload: haircut });

    await lintel.setEnabledPlugins([]);
    const whileOff = await receptionist({ method: "GET", url: "/bookings" });
    expect(whileOff.statusCode).toBe(404);
    expect(whileOff.json().code).toBe("PLUGIN_NOT_ENABLED");

    await lintel.setEnabledPlugins(["bookings"]);
    expect((await receptionist({ method: "GET", url: "/bookings" })).json().bookings).toHaveLength(
      1,
    );
  });

  it("lets Settings → Privacy find, export and erase one person's bookings", async () => {
    const receptionist = await lintel.signInWith(["bookings:*"]);
    await receptionist({ method: "POST", url: "/bookings", payload: haircut });
    await receptionist({
      method: "POST",
      url: "/bookings",
      payload: { ...haircut, customerName: "Ada Lovelace", customerEmail: "ada@example.com" },
    });
    const privacyOfficer = await lintel.signInWith(["privacy:manage"]);

    const map = await privacyOfficer({ method: "GET", url: "/privacy/map" });
    expect(map.json().kinds).toContainEqual(
      expect.objectContaining({
        id: "plugin:bookings",
        searchable: true,
        tables: [{ name: "bookings", columns: ["customer_name", "customer_email", "notes"] }],
      }),
    );

    const found = await privacyOfficer({
      method: "POST",
      url: "/privacy/people/find",
      payload: { name: "grace hopper" },
    });
    expect(found.json().found).toEqual([
      expect.objectContaining({ kindId: "plugin:bookings", items: [expect.any(Object)] }),
    ]);

    const exported = await privacyOfficer({
      method: "POST",
      url: "/privacy/people/export",
      payload: { email: "grace@example.com" },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-type"]).toBe("application/zip");

    const erased = await privacyOfficer({
      method: "POST",
      url: "/privacy/people/erase",
      payload: { email: "GRACE@example.com" },
    });
    expect(erased.json().parts).toEqual([
      expect.objectContaining({ source: "Bookings", deleted: 1 }),
    ]);
    const left = await receptionist({ method: "GET", url: "/bookings" });
    expect(
      left.json().bookings.map((booking: { customerName: string }) => booking.customerName),
    ).toEqual(["Ada Lovelace"]);
  });
});
