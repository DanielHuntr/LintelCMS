import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { ConfigFileError, type LintelConfigFile } from "../lintel-config-file.js";
import {
  type Branding,
  type BrandingImageField,
  brandingImageFields,
  brandingOverridesSchema,
  lintelBranding,
} from "./branding.schema.js";

/**
 * The branding a server was deployed with: the `branding` section of lintel.config.json,
 * then LINTEL_BRAND_* environment variables on top. This is what the admin shows before
 * anyone changes it in Settings, including on the setup screens of a fresh install, and
 * what "Reset" goes back to.
 */

/** Environment variable → branding field. Text values; the booleans take "true"/"false". */
export const brandingEnvironmentVariables = {
  LINTEL_BRAND_PRODUCT_NAME: "productName",
  LINTEL_BRAND_LOGO: "logo",
  LINTEL_BRAND_LOGO_DARK: "logoDark",
  LINTEL_BRAND_MARK: "mark",
  LINTEL_BRAND_FAVICON: "favicon",
  LINTEL_BRAND_ACCENT_COLOUR: "accentColour",
  LINTEL_BRAND_SIGN_IN_MESSAGE: "signInMessage",
  LINTEL_BRAND_SIGN_IN_BACKGROUND: "signInBackground",
  LINTEL_BRAND_SUPPORT_URL: "supportUrl",
  LINTEL_BRAND_SUPPORT_EMAIL: "supportEmail",
  LINTEL_BRAND_DOCS_URL: "docsUrl",
  LINTEL_BRAND_HIDE_BUILT_WITH_LINTEL: "hideBuiltWithLintel",
  LINTEL_BRAND_HIDE_LINTEL_HELP: "hideLintelHelp",
} as const satisfies Record<string, keyof Branding>;

const imageTypesByExtension: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export interface DeploymentBranding {
  branding: Branding;
  /** False when neither the file nor the environment changes anything. */
  isCustomised: boolean;
}

export function readDeploymentBranding(
  configFile: LintelConfigFile,
  environment: NodeJS.ProcessEnv = process.env,
): DeploymentBranding {
  const fromFile = configFile.contents.branding ?? {};
  if (typeof fromFile !== "object" || fromFile === null || Array.isArray(fromFile)) {
    throw new ConfigFileError("lintel.config.json", '"branding" should be an object.');
  }

  const raw: Record<string, unknown> = { ...fromFile };
  for (const [variable, field] of Object.entries(brandingEnvironmentVariables)) {
    const value = environment[variable];
    if (value === undefined || value === "") continue;
    raw[field] = field.startsWith("hide") ? value === "true" : value;
  }
  for (const field of brandingImageFields) {
    if (raw[field] !== undefined) raw[field] = imageFromFile(raw[field], field, configFile.folder);
  }

  const parsed = brandingOverridesSchema.strict().safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "branding"}: ${issue.message}`)
      .join("; ");
    throw new ConfigFileError("the branding settings", problems);
  }

  return {
    branding: { ...lintelBranding, ...parsed.data },
    isCustomised: Object.keys(parsed.data).length > 0,
  };
}

/** A path like "./brand/logo.svg" becomes a data URL; addresses and data URLs pass through. */
function imageFromFile(value: unknown, field: BrandingImageField, folder: string): unknown {
  if (typeof value !== "string" || value === "" || /^(data:|https?:\/\/)/.test(value)) {
    return value;
  }
  const path = resolve(folder, value);
  const type = imageTypesByExtension[extname(path).toLowerCase()];
  if (!type) {
    throw new ConfigFileError(path, `the ${field} should be a PNG, JPEG, WebP, GIF, SVG or ICO.`);
  }
  if (!existsSync(path)) {
    throw new ConfigFileError(path, `the ${field} file isn't there.`);
  }
  return `data:${type};base64,${readFileSync(path).toString("base64")}`;
}
