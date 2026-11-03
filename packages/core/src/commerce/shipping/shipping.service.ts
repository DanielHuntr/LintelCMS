import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { InvalidFieldsError } from "../../http/http-errors.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import type { MarketRow } from "../markets/markets.table.js";
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
import { type Parcel, quoteShipping, type ShippingQuote } from "./shipping-quotes.js";
import type {
  CreateShippingRateRequest,
  CreateShippingZoneRequest,
  UpdateShippingRateRequest,
  UpdateShippingZoneRequest,
} from "./shipping.schema.js";
import type { ShippingRateRow, ShippingZoneRow } from "./shipping.table.js";

/** Where the shop ships, and what it costs. Quoting a parcel is in shipping-quotes.ts. */

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  rates: ShippingRate[];
}

export type ShippingRate = Omit<
  ShippingRateRow,
  "tenantId" | "createdAt" | "updatedAt" | "position"
>;

export async function listShippingZones(
  database: DatabaseOrTransaction,
): Promise<{ zones: ShippingZone[] }> {
  const zones = await listZoneRows(database, DEFAULT_TENANT_ID);
  const rates = await listRateRows(
    database,
    zones.map((zone) => zone.id),
  );
  return { zones: zones.map((zone) => describeZone(zone, rates)) };
}

export async function createShippingZone(
  database: DatabaseOrTransaction,
  request: CreateShippingZoneRequest,
): Promise<ShippingZone> {
  const existing = await listZoneRows(database, DEFAULT_TENANT_ID);
  const zone = await insertZone(database, {
    tenantId: DEFAULT_TENANT_ID,
    ...request,
    position: existing.length,
  });
  return describeZone(zone, []);
}

export async function updateShippingZone(
  database: DatabaseOrTransaction,
  zoneId: string,
  request: UpdateShippingZoneRequest,
): Promise<ShippingZone> {
  if (!(await updateZoneRow(database, DEFAULT_TENANT_ID, zoneId, request))) {
    throw new ShopRecordNotFoundError("shipping zone");
  }
  return findZone(database, zoneId);
}

export async function deleteShippingZone(
  database: DatabaseOrTransaction,
  zoneId: string,
): Promise<void> {
  if (!(await deleteZoneRow(database, DEFAULT_TENANT_ID, zoneId))) {
    throw new ShopRecordNotFoundError("shipping zone");
  }
}

export async function createShippingRate(
  database: DatabaseOrTransaction,
  zoneId: string,
  request: CreateShippingRateRequest,
): Promise<ShippingZone> {
  await findZone(database, zoneId);
  refuseRateWithoutPrice(request);
  const position = (await listRateRows(database, [zoneId])).length;
  await insertRate(database, { tenantId: DEFAULT_TENANT_ID, zoneId, ...request, position });
  return findZone(database, zoneId);
}

export async function updateShippingRate(
  database: DatabaseOrTransaction,
  rateId: string,
  request: UpdateShippingRateRequest,
): Promise<ShippingZone> {
  const rate = await findRateRow(database, DEFAULT_TENANT_ID, rateId);
  if (!rate) {
    throw new ShopRecordNotFoundError("shipping rate");
  }
  refuseRateWithoutPrice({ ...rate, ...request });
  await updateRateRow(database, DEFAULT_TENANT_ID, rateId, request);
  return findZone(database, rate.zoneId);
}

export async function deleteShippingRate(
  database: DatabaseOrTransaction,
  rateId: string,
): Promise<void> {
  if (!(await deleteRateRow(database, DEFAULT_TENANT_ID, rateId))) {
    throw new ShopRecordNotFoundError("shipping rate");
  }
}

/** The ways to ship this parcel, cheapest first. */
export async function findShippingQuotes(
  database: DatabaseOrTransaction,
  parcel: Parcel,
  market: MarketRow,
  primaryCurrency: string,
): Promise<ShippingQuote[]> {
  const zones = await listZoneRows(database, DEFAULT_TENANT_ID);
  const rates = await listRateRows(
    database,
    zones.map((zone) => zone.id),
  );
  return quoteShipping(zones, rates, parcel, market, primaryCurrency).sort(
    (first, second) => first.amount.amount - second.amount.amount,
  );
}

/**
 * A rate needs a price: a flat rate in at least one currency, a weight rate at least one step
 * with one. A rate without one was accepted, and checkout then couldn't deliver to the zone at
 * all (LINTEL-FUNC-012).
 */
function refuseRateWithoutPrice(
  rate: Pick<ShippingRateRow, "kind" | "amounts" | "weightBrackets">,
) {
  if (rate.kind === "weight") {
    if (rate.weightBrackets.length === 0) {
      throw new InvalidFieldsError({ weightBrackets: "Add at least one weight step with a price" });
    }
    if (rate.weightBrackets.some((bracket) => Object.keys(bracket.amounts).length === 0)) {
      throw new InvalidFieldsError({ weightBrackets: "Give every weight step a price" });
    }
    return;
  }
  if (Object.keys(rate.amounts).length === 0) {
    throw new InvalidFieldsError({ amounts: "Give the rate a price, like £4.95" });
  }
}

async function findZone(database: DatabaseOrTransaction, zoneId: string): Promise<ShippingZone> {
  const zone = (await listZoneRows(database, DEFAULT_TENANT_ID)).find((row) => row.id === zoneId);
  if (!zone) {
    throw new ShopRecordNotFoundError("shipping zone");
  }
  return describeZone(zone, await listRateRows(database, [zoneId]));
}

function describeZone(zone: ShippingZoneRow, rates: readonly ShippingRateRow[]): ShippingZone {
  return {
    id: zone.id,
    name: zone.name,
    countries: zone.countries,
    rates: rates
      .filter((rate) => rate.zoneId === zone.id)
      .map((rate) => ({
        id: rate.id,
        zoneId: rate.zoneId,
        name: rate.name,
        kind: rate.kind,
        amounts: rate.amounts,
        weightBrackets: rate.weightBrackets,
        freeOverAmounts: rate.freeOverAmounts,
        deliveryEstimate: rate.deliveryEstimate,
      })),
  };
}
