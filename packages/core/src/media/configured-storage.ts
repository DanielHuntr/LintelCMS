import { LocalDiskStorage } from "./local-disk-storage.js";
import { S3Storage } from "./s3-storage.js";
import type { StorageDriver } from "./storage-driver.js";

/** The storage settings from src/config.ts (see storage.config.ts). */
export interface StorageConfig {
  STORAGE_DRIVER: "local" | "s3";
  S3_BUCKET?: string | undefined;
  S3_REGION: string;
  S3_ENDPOINT?: string | undefined;
  S3_ACCESS_KEY_ID?: string | undefined;
  S3_SECRET_ACCESS_KEY?: string | undefined;
  S3_FORCE_PATH_STYLE?: boolean | undefined;
  S3_KEY_PREFIX: string;
  S3_SIGNED_URLS: boolean;
  S3_SIGNED_URL_SECONDS: number;
}

/** The driver the settings ask for. `uploadsFolder` is used by the local one. */
export function createConfiguredStorage(config: StorageConfig, uploadsFolder: string) {
  if (config.STORAGE_DRIVER === "s3" && config.S3_BUCKET) {
    return createS3Storage(config, config.S3_BUCKET);
  }
  return new LocalDiskStorage(uploadsFolder);
}

export function createS3Storage(config: StorageConfig, bucket: string): S3Storage {
  return new S3Storage({
    bucket,
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    keyPrefix: config.S3_KEY_PREFIX,
  });
}

/** How long signed links last, or undefined to serve every file through Lintel. */
export function signedUrlSeconds(config: StorageConfig): number | undefined {
  return config.STORAGE_DRIVER === "s3" && config.S3_SIGNED_URLS
    ? config.S3_SIGNED_URL_SECONDS
    : undefined;
}

/** One line for the startup log, without any keys. */
export function describeStorage(storage: StorageDriver, config: StorageConfig): string {
  if (storage instanceof S3Storage) {
    const where = config.S3_ENDPOINT ?? `AWS S3 in ${config.S3_REGION}`;
    return `Uploaded files are kept in the bucket "${config.S3_BUCKET}" at ${where}.`;
  }
  return "Uploaded files are kept on this server's disk.";
}
