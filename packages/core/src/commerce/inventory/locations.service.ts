import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { LastLocationError } from "./inventory.errors.js";
import {
  deleteLocationRow,
  insertLocation,
  listLocationRows,
  updateLocationRow,
} from "./inventory.repository.js";
import { listOrCreateLocations } from "./inventory.service.js";
import type {
  CreateLocationRequest,
  InventoryLocation,
  UpdateLocationRequest,
} from "./inventory.schema.js";
import type { InventoryLocationRow } from "./inventory.table.js";

/** Adding, renaming and switching off the places stock is kept. */

export async function listLocations(
  database: DatabaseOrTransaction,
): Promise<{ locations: InventoryLocation[] }> {
  return { locations: (await listOrCreateLocations(database)).map(describeLocation) };
}

export async function createLocation(
  database: DatabaseOrTransaction,
  request: CreateLocationRequest,
): Promise<InventoryLocation> {
  const existing = await listOrCreateLocations(database);
  const row = await insertLocation(database, {
    tenantId: DEFAULT_TENANT_ID,
    name: request.name,
    position: existing.length,
  });
  return describeLocation(row);
}

export async function updateLocation(
  database: DatabaseOrTransaction,
  locationId: string,
  request: UpdateLocationRequest,
): Promise<InventoryLocation> {
  if (!(await updateLocationRow(database, DEFAULT_TENANT_ID, locationId, request))) {
    throw new ShopRecordNotFoundError("location");
  }
  const location = (await listLocationRows(database, DEFAULT_TENANT_ID)).find(
    (row) => row.id === locationId,
  );
  if (!location) {
    throw new ShopRecordNotFoundError("location");
  }
  return describeLocation(location);
}

/** Deleting a location deletes the stock counted there. The last one can't go. */
export async function deleteLocation(
  database: DatabaseOrTransaction,
  locationId: string,
): Promise<void> {
  const locations = await listLocationRows(database, DEFAULT_TENANT_ID);
  if (!locations.some((row) => row.id === locationId)) {
    throw new ShopRecordNotFoundError("location");
  }
  if (locations.length === 1) {
    throw new LastLocationError();
  }
  await deleteLocationRow(database, DEFAULT_TENANT_ID, locationId);
}

function describeLocation(row: InventoryLocationRow): InventoryLocation {
  return { id: row.id, name: row.name, isActive: row.isActive };
}
