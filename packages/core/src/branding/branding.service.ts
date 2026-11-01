import { createHash } from "node:crypto";
import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { accentShades } from "./accent-colours.js";
import {
  type Branding,
  type BrandingImageField,
  type BrandingOverrides,
  type BrandingSettings,
  brandingImageFields,
  lintelBranding,
  parseDataUrl,
  type PublicBranding,
} from "./branding.schema.js";
import type { DeploymentBranding } from "./deployment-branding.js";
import { BrandingImageNotFoundError } from "./branding.errors.js";

/**
 * Branding is three layers: Lintel's own look, then what the server was deployed with
 * (lintel.config.json and LINTEL_BRAND_*), then what an admin changed in Settings. Only the
 * fields an admin changed are saved, so a later deployment change still reaches the rest.
 */

export async function readBranding(
  database: DatabaseOrTransaction,
  deployment: DeploymentBranding,
): Promise<Branding> {
  return { ...deployment.branding, ...(await readOverrides(database)) };
}

export async function readBrandingSettings(
  database: DatabaseOrTransaction,
  deployment: DeploymentBranding,
): Promise<BrandingSettings> {
  return {
    branding: await readBranding(database, deployment),
    defaults: deployment.branding,
    defaultsFromDeployment: deployment.isCustomised,
  };
}

export async function saveBranding(
  database: DatabaseOrTransaction,
  deployment: DeploymentBranding,
  branding: Branding,
): Promise<BrandingSettings> {
  const overrides: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(branding)) {
    if (deployment.branding[field as keyof Branding] !== value) overrides[field] = value;
  }
  await writeSetting(database, "brandingOverrides", overrides as BrandingOverrides);
  return readBrandingSettings(database, deployment);
}

/** Back to the deployment's branding, or Lintel's when it was deployed without any. */
export async function resetBranding(
  database: DatabaseOrTransaction,
  deployment: DeploymentBranding,
): Promise<BrandingSettings> {
  await writeSetting(database, "brandingOverrides", {});
  return readBrandingSettings(database, deployment);
}

/**
 * What every screen (signed in or not) and the public website get. Uploaded pictures
 * become addresses under /branding/images with a fingerprint, so they cache for good and
 * a new upload is picked up straight away.
 */
export function describePublicBranding(branding: Branding, publicApiUrl: string): PublicBranding {
  const withAddresses: Branding = { ...branding };
  for (const field of brandingImageFields) {
    const value = branding[field];
    if (value?.startsWith("data:")) {
      withAddresses[field] = `${publicApiUrl}/branding/images/${field}?v=${fingerprint(value)}`;
    }
  }
  return {
    ...withAddresses,
    accent: accentShades(branding.accentColour),
    isLintelDefault: Object.entries(lintelBranding).every(
      ([field, value]) => branding[field as keyof Branding] === value,
    ),
  };
}

/** An uploaded picture's bytes, or the address it lives at when it isn't uploaded. */
export function findBrandingImage(
  branding: Branding,
  field: string,
): { type: string; bytes: Buffer } | { address: string } {
  const value = brandingImageFields.includes(field as BrandingImageField)
    ? branding[field as BrandingImageField]
    : null;
  if (!value) throw new BrandingImageNotFoundError(field);
  return parseDataUrl(value) ?? { address: value };
}

/**
 * Reading before the database is ready (on the first setup screen, say) gives the
 * deployment's branding instead of an error, so setup can still show the agency's look.
 */
async function readOverrides(database: DatabaseOrTransaction): Promise<BrandingOverrides> {
  try {
    return await readSetting(database, "brandingOverrides");
  } catch {
    return {};
  }
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
