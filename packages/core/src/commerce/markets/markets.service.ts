import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { firstFreeSlug, slugify } from "../../entries/slugs.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import {
  CountryInAnotherMarketError,
  NoMarketsError,
  PrimaryMarketRequiredError,
} from "./markets.errors.js";
import {
  clearOtherPrimaryMarkets,
  deleteMarketRow,
  findMarketRow,
  insertMarket,
  listMarketRows,
  updateMarketRow,
} from "./markets.repository.js";
import type { CreateMarketRequest, Market, UpdateMarketRequest } from "./markets.schema.js";
import type { MarketRow } from "./markets.table.js";

/** Where the shop sells. See markets.table.ts for what a market is. */

export async function listMarkets(database: DatabaseOrTransaction): Promise<{ markets: Market[] }> {
  const rows = await listMarketRows(database, DEFAULT_TENANT_ID);
  return { markets: rows.map(describeMarket) };
}

export async function findMarket(
  database: DatabaseOrTransaction,
  marketId: string,
): Promise<MarketRow> {
  const row = await findMarketRow(database, DEFAULT_TENANT_ID, marketId);
  if (!row) {
    throw new ShopRecordNotFoundError("market");
  }
  return row;
}

export async function findPrimaryMarket(database: DatabaseOrTransaction): Promise<MarketRow> {
  const rows = await listMarketRows(database, DEFAULT_TENANT_ID);
  const primary = rows.find((row) => row.isPrimary) ?? rows[0];
  if (!primary) {
    throw new NoMarketsError();
  }
  return primary;
}

/** The market a country is in, or the primary market for countries in none. */
export async function findMarketForCountry(
  database: DatabaseOrTransaction,
  country: string | null | undefined,
): Promise<MarketRow> {
  const rows = await listMarketRows(database, DEFAULT_TENANT_ID);
  const byCountry = country ? rows.find((row) => row.countries.includes(country)) : undefined;
  const market = byCountry ?? rows.find((row) => row.isPrimary) ?? rows[0];
  if (!market) {
    throw new NoMarketsError();
  }
  return market;
}

export async function createMarket(
  database: DatabaseOrTransaction,
  request: CreateMarketRequest,
): Promise<Market> {
  const existing = await listMarketRows(database, DEFAULT_TENANT_ID);
  refuseCountriesInOtherMarkets(request.countries, existing, undefined);
  const isPrimary = existing.length === 0;
  const handle = firstFreeSlug(
    slugify(request.name) || "market",
    new Set(existing.map((row) => row.handle)),
  );
  const row = await insertMarket(database, {
    tenantId: DEFAULT_TENANT_ID,
    ...request,
    handle,
    isPrimary,
    exchangeRate: isPrimary ? 1 : request.exchangeRate,
    position: existing.length,
  });
  return describeMarket(row);
}

export async function updateMarket(
  database: DatabaseOrTransaction,
  marketId: string,
  request: UpdateMarketRequest,
): Promise<Market> {
  await findMarket(database, marketId);
  if (request.countries) {
    const existing = await listMarketRows(database, DEFAULT_TENANT_ID);
    refuseCountriesInOtherMarkets(request.countries, existing, marketId);
  }
  const { isPrimary, ...changes } = request;
  if (isPrimary) {
    await clearOtherPrimaryMarkets(database, DEFAULT_TENANT_ID, marketId);
  }
  await updateMarketRow(database, DEFAULT_TENANT_ID, marketId, {
    ...changes,
    ...(isPrimary && { isPrimary: true, exchangeRate: 1 }),
  });
  return describeMarket(await findMarket(database, marketId));
}

export async function deleteMarket(
  database: DatabaseOrTransaction,
  marketId: string,
): Promise<void> {
  const market = await findMarket(database, marketId);
  if (market.isPrimary) {
    throw new PrimaryMarketRequiredError();
  }
  await deleteMarketRow(database, DEFAULT_TENANT_ID, marketId);
}

export function describeMarket(row: MarketRow): Market {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    currency: row.currency,
    countries: row.countries,
    isPrimary: row.isPrimary,
    exchangeRate: row.exchangeRate,
    priceRounding: row.priceRounding,
    pricesIncludeTax: row.pricesIncludeTax,
  };
}

function refuseCountriesInOtherMarkets(
  countries: readonly string[],
  markets: readonly MarketRow[],
  marketId: string | undefined,
): void {
  for (const country of countries) {
    const other = markets.find((row) => row.id !== marketId && row.countries.includes(country));
    if (other) {
      throw new CountryInAnotherMarketError(country, other.name);
    }
  }
}
