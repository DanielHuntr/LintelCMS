import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  type SignedUrlOptions,
  type StorageDriver,
  StoredFileMissingError,
  StorageUnreachableError,
} from "./storage-driver.js";

export interface S3StorageOptions {
  bucket: string;
  region: string;
  /** Leave out for AWS. Set for Cloudflare R2, Backblaze B2, MinIO and the like. */
  endpoint?: string | undefined;
  /** Leave both out to use the server's own AWS role. */
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  /** Defaults to on whenever `endpoint` is set: MinIO needs it, and R2 and B2 accept it. */
  forcePathStyle?: boolean | undefined;
  /** Put every key under this folder of the bucket, such as "lintel/". */
  keyPrefix?: string | undefined;
}

/**
 * Keeps uploaded files in an S3-compatible bucket: AWS S3, Cloudflare R2, Backblaze B2 or
 * MinIO. The bucket should stay private; files are served through `GET /media/:id/file`, or
 * through short-lived signed links when S3_SIGNED_URLS is on (see README.md, "Storage").
 */
export class S3Storage implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly endpoint: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.keyPrefix = normaliseKeyPrefix(options.keyPrefix ?? "");
    this.endpoint = options.endpoint ?? `AWS S3 (${options.region})`;
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
      ...(options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {}),
      // Newer AWS SDKs add checksums to every request, which several S3-compatible stores
      // (B2, older MinIO and R2) refuse. Only send them where S3 itself requires one.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async put(key: string, contents: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: contents,
        ContentType: mimeType,
        ContentLength: contents.length,
      }),
    );
  }

  async get(key: string): Promise<Readable> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      );
      if (!(response.Body instanceof Readable)) {
        throw new StoredFileMissingError(key);
      }
      return response.Body;
    } catch (error) {
      if (isNotFound(error)) {
        throw new StoredFileMissingError(key);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    // S3 answers a delete of a missing key with success, which is what the interface wants.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  async checkReachable(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      throw new StorageUnreachableError(this.explainBucketProblem(error));
    }
  }

  signedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(key),
      ResponseContentType: options.contentType,
      ResponseContentDisposition: options.contentDisposition,
    });
    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds });
  }

  /** Closes the connections the client keeps open, so a script can exit straight away. */
  close(): void {
    this.client.destroy();
  }

  private objectKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private explainBucketProblem(error: unknown): string {
    const status = httpStatusOf(error);
    if (status === 404) {
      return `there is no bucket called "${this.bucket}" at ${this.endpoint}. Check S3_BUCKET (and S3_REGION or S3_ENDPOINT).`;
    }
    if (status === 401 || status === 403) {
      return `the access keys aren't allowed to use the bucket "${this.bucket}". Check S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, and that the keys may read and write that bucket.`;
    }
    if (status === 301 || status === 400) {
      return `the bucket "${this.bucket}" is in another region. Set S3_REGION to the bucket's region.`;
    }
    const reason = error instanceof Error ? error.message : String(error);
    return `Lintel couldn't reach ${this.endpoint} (${reason}). Check S3_ENDPOINT and the server's internet connection.`;
  }
}

function normaliseKeyPrefix(prefix: string): string {
  const trimmed = prefix.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "" : `${trimmed}/`;
}

function httpStatusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("$metadata" in error)) {
    return undefined;
  }
  const metadata = error.$metadata;
  if (typeof metadata === "object" && metadata !== null && "httpStatusCode" in metadata) {
    return typeof metadata.httpStatusCode === "number" ? metadata.httpStatusCode : undefined;
  }
  return undefined;
}

function isNotFound(error: unknown): boolean {
  if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
    return true;
  }
  return httpStatusOf(error) === 404;
}
