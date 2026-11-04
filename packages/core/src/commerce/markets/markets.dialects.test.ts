import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  clearOtherPrimaryMarkets,
  deleteMarketRow,
  findMarketRow,
  insertMarket,
  listMarketRows,
  updateMarketRow,
} from "./markets.repository.js";

const TENANT = "default";
const uk = { name: "UK", handle: "uk", currency: "GBP", countries: ["GB"], exchangeRate: 1.25 };

describeOnEveryDatabase("Markets", (handle) => {
  it("saves a market with its countries and exact exchange rate", async () => {
    const { database } = handle;
    const market = await insertMarket(database, uk);
    expect(market).toMatchObject({ countries: ["GB"], exchangeRate: 1.25, isPrimary: false });
    await updateMarketRow(database, TENANT, market.id, { exchangeRate: 0.8571 });
    expect((await findMarketRow(database, TENANT, market.id))?.exchangeRate).toBe(0.8571);
  });

  it("lists the primary market first, and keeps only one", async () => {
    const { database } = handle;
    await insertMarket(database, uk);
    const second = await insertMarket(database, {
      ...uk,
      handle: "eu",
      name: "EU",
      isPrimary: true,
      position: 1,
    });
    expect((await listMarketRows(database, TENANT))[0]?.id).toBe(second.id);

    const third = await insertMarket(database, { ...uk, handle: "us", isPrimary: true });
    await clearOtherPrimaryMarkets(database, TENANT, third.id);
    const primary = (await listMarketRows(database, TENANT)).filter((row) => row.isPrimary);
    expect(primary.map((row) => row.id)).toEqual([third.id]);
  });

  it("deletes a market once", async () => {
    const { database } = handle;
    const market = await insertMarket(database, uk);
    expect(await deleteMarketRow(database, TENANT, market.id)).toBe(true);
    expect(await deleteMarketRow(database, TENANT, market.id)).toBe(false);
  });
});
