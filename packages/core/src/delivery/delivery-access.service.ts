import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import type { DeliveryAccess, UpdateDeliveryAccessRequest } from "./delivery-access.schema.js";

/** Who may read published content, kept in two settings (see src/settings). */

export async function readDeliveryAccess(database: DatabaseOrTransaction): Promise<DeliveryAccess> {
  return {
    requireToken: await readSetting(database, "deliveryRequiresToken"),
    allowedOrigins: await readSetting(database, "deliveryAllowedOrigins"),
  };
}

export async function updateDeliveryAccess(
  database: DatabaseOrTransaction,
  changes: UpdateDeliveryAccessRequest,
): Promise<DeliveryAccess> {
  if (changes.requireToken !== undefined) {
    await writeSetting(database, "deliveryRequiresToken", changes.requireToken);
  }
  if (changes.allowedOrigins !== undefined) {
    await writeSetting(database, "deliveryAllowedOrigins", changes.allowedOrigins);
  }
  return readDeliveryAccess(database);
}

export async function isAllowedSiteOrigin(
  database: DatabaseOrTransaction,
  origin: string,
): Promise<boolean> {
  const allowed = await readSetting(database, "deliveryAllowedOrigins");
  return allowed.includes(origin);
}
