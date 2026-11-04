import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  deleteRateRow,
  deleteZoneRow,
  findRateRow,
  insertRate,
  insertZone,
  listRateRows,
  listZoneRows,
  updateRateRow,
  updateZoneRow,
} from "./shipping.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Shipping", (handle) => {
  it("saves zones with their countries, and changes them", async () => {
    const { database } = handle;
    const zone = await insertZone(database, { name: "UK", countries: ["GB"] });
    expect(zone.countries).toEqual(["GB"]);
    await updateZoneRow(database, TENANT, zone.id, { name: "Home", countries: ["GB", "IE"] });
    const [listed] = await listZoneRows(database, TENANT);
    expect(listed).toMatchObject({ name: "Home", countries: ["GB", "IE"] });
  });

  it("saves rates by currency, and changes them", async () => {
    const { database } = handle;
    const zone = await insertZone(database, { name: "UK" });
    const rate = await insertRate(database, {
      zoneId: zone.id,
      name: "Standard",
      amounts: { GBP: 495 },
    });
    expect(rate).toMatchObject({ kind: "flat", amounts: { GBP: 495 }, freeOverAmounts: null });
    await updateRateRow(database, TENANT, rate.id, { freeOverAmounts: { GBP: 5000 } });
    expect((await findRateRow(database, TENANT, rate.id))?.freeOverAmounts).toEqual({ GBP: 5000 });
    expect(await listRateRows(database, [zone.id])).toHaveLength(1);
    expect(await listRateRows(database, [])).toEqual([]);
  });

  it("deletes each once, and a zone takes its rates with it", async () => {
    const { database } = handle;
    const zone = await insertZone(database, { name: "UK" });
    const rate = await insertRate(database, { zoneId: zone.id, name: "Standard" });
    const other = await insertRate(database, { zoneId: zone.id, name: "Express" });
    expect(await deleteRateRow(database, TENANT, rate.id)).toBe(true);
    expect(await deleteRateRow(database, TENANT, rate.id)).toBe(false);
    expect(await deleteZoneRow(database, TENANT, zone.id)).toBe(true);
    expect(await deleteZoneRow(database, TENANT, zone.id)).toBe(false);
    expect(await findRateRow(database, TENANT, other.id)).toBeUndefined();
  });
});
