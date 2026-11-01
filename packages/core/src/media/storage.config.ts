import { z } from "zod";
import {
  optionalSetting,
  settingWithDefault,
  webAddress,
  wholeNumberSetting,
  yesOrNoSetting,
} from "../config-values.js";

/**
 * Where uploaded files are kept: on this server's disk (the default) or in an
 * S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO). Part of the one
 * config schema in src/config.ts. See README.md, "Storage".
 */
export const storageSettings = {
  STORAGE_DRIVER: settingWithDefault(
    z.enum(["local", "s3"], { error: 'Should be "local" or "s3"' }),
    "local",
  ),
  S3_BUCKET: optionalSetting(z.string().trim().min(1)),
  // R2 uses "auto"; AWS needs the bucket's real region, such as eu-west-2.
  S3_REGION: settingWithDefault(z.string().trim().min(1), "us-east-1"),
  // Leave out for AWS. R2: https://<account id>.r2.cloudflarestorage.com,
  // B2: https://s3.<region>.backblazeb2.com, MinIO: http://minio:9000.
  S3_ENDPOINT: optionalSetting(webAddress),
  // Leave both out to use the server's own AWS role (on EC2, ECS or Lambda).
  S3_ACCESS_KEY_ID: optionalSetting(z.string().trim().min(1)),
  S3_SECRET_ACCESS_KEY: optionalSetting(z.string().trim().min(1)),
  // Bucket in the path (endpoint/bucket/key) rather than the name. MinIO needs it; it is
  // on by default whenever S3_ENDPOINT is set.
  S3_FORCE_PATH_STYLE: optionalSetting(
    z
      .enum(["true", "false"], { error: "Should be true or false" })
      .transform((value) => value === "true"),
  ),
  // Keeps Lintel's files under one folder of a shared bucket, such as "lintel/".
  S3_KEY_PREFIX: settingWithDefault(z.string().trim(), ""),
  // Send visitors straight to the bucket with a short-lived link, rather than through Lintel.
  S3_SIGNED_URLS: yesOrNoSetting(false),
  S3_SIGNED_URL_SECONDS: wholeNumberSetting(3600, 60),
};

interface StorageSettingsToCheck {
  STORAGE_DRIVER: "local" | "s3";
  S3_BUCKET?: string | undefined;
  S3_ACCESS_KEY_ID?: string | undefined;
  S3_SECRET_ACCESS_KEY?: string | undefined;
}

/** Rules that need more than one setting. Called from config.ts. */
export function checkStorageSettings(
  settings: StorageSettingsToCheck,
  context: z.RefinementCtx,
): void {
  if (settings.STORAGE_DRIVER !== "s3") return;

  if (!settings.S3_BUCKET) {
    context.addIssue({
      code: "custom",
      path: ["S3_BUCKET"],
      message: "STORAGE_DRIVER is s3, so Lintel needs the name of the bucket to keep files in",
    });
  }
  if (Boolean(settings.S3_ACCESS_KEY_ID) !== Boolean(settings.S3_SECRET_ACCESS_KEY)) {
    context.addIssue({
      code: "custom",
      path: [settings.S3_ACCESS_KEY_ID ? "S3_SECRET_ACCESS_KEY" : "S3_ACCESS_KEY_ID"],
      message:
        "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY go together: set both, or neither to use " +
        "the server's own cloud role",
    });
  }
}
