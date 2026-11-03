import { posix } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { RemoteFolder } from "./remote-folder.js";

export interface S3Settings {
  bucket: string;
  region: string;
  endpoint?: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

/**
 * An S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO...) set up for
 * website hosting. Each file is one object, written whole, so there is nothing to rename.
 * Buckets can't run PHP, so forms post to Lintel's API from here.
 */
export function openS3Remote(settings: S3Settings): RemoteFolder {
  const client = new S3Client({
    region: settings.region || "us-east-1",
    ...(settings.endpoint ? { endpoint: settings.endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
  const key = (path: string) => {
    const normalized = posix.normalize(path).replace(/^\/+/, "");
    if (normalized.startsWith("..")) {
      throw new Error("Buckets have no private folder: files outside the website can't go there.");
    }
    return posix.join(settings.prefix, normalized).replace(/^\/+/, "");
  };
  return {
    async readFile(path) {
      try {
        const answer = await client.send(
          new GetObjectCommand({ Bucket: settings.bucket, Key: key(path) }),
        );
        return answer.Body ? Buffer.from(await answer.Body.transformToByteArray()) : null;
      } catch (error) {
        if (error instanceof NoSuchKey || isNotFound(error)) return null;
        throw error;
      }
    },
    async writeFile(path, content) {
      await client.send(
        new PutObjectCommand({
          Bucket: settings.bucket,
          Key: key(path),
          Body: content,
          ContentType:
            contentTypes[posix.extname(path).toLowerCase()] ?? "application/octet-stream",
          CacheControl:
            path.startsWith("media/") || /site-[0-9a-f]+\.css$/.test(path)
              ? "public, max-age=31536000, immutable"
              : "public, max-age=0, must-revalidate",
        }),
      );
    },
    async deleteFile(path) {
      await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key(path) }));
    },
    async close() {
      client.destroy();
    },
  };
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    (error as { $metadata: { httpStatusCode?: number } }).$metadata.httpStatusCode === 404
  );
}
