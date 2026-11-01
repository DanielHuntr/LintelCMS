import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  FAKE_S3_ACCESS_KEY,
  FAKE_S3_SECRET_KEY,
  type FakeS3Server,
  startFakeS3Server,
} from "../testing/fake-s3-server.js";
import { S3Storage, type S3StorageOptions } from "./s3-storage.js";
import { StoredFileMissingError, StorageUnreachableError } from "./storage-driver.js";

describe("S3Storage", () => {
  let s3: FakeS3Server;
  const storages: S3Storage[] = [];

  function storage(options: Partial<S3StorageOptions> = {}): S3Storage {
    const created = new S3Storage({
      bucket: "lintel-media",
      region: "auto",
      endpoint: s3.endpoint,
      accessKeyId: FAKE_S3_ACCESS_KEY,
      secretAccessKey: FAKE_S3_SECRET_KEY,
      ...options,
    });
    storages.push(created);
    return created;
  }

  beforeAll(async () => {
    s3 = await startFakeS3Server(["lintel-media"]);
  });
  beforeEach(() => {
    s3.buckets.get("lintel-media")?.clear();
    s3.requests.length = 0;
  });
  afterAll(async () => {
    for (const created of storages) created.close();
    await s3.close();
  });

  it("stores a file with its type, reads it back as a stream, and deletes it", async () => {
    const files = storage();
    await files.put("default/photo.png", Buffer.from("png bytes"), "image/png");

    expect(await files.exists("default/photo.png")).toBe(true);
    expect(s3.buckets.get("lintel-media")?.get("default/photo.png")?.contentType).toBe("image/png");
    const stream = await files.get("default/photo.png");
    expect(Buffer.concat(await stream.toArray()).toString()).toBe("png bytes");

    await files.delete("default/photo.png");
    expect(await files.exists("default/photo.png")).toBe(false);
  });

  it("says a file is missing in the same words as local storage", async () => {
    await expect(storage().get("default/gone.png")).rejects.toBeInstanceOf(StoredFileMissingError);
    // Deleting something that isn't there is fine.
    await expect(storage().delete("default/gone.png")).resolves.toBeUndefined();
  });

  it("keeps files under a folder of a shared bucket", async () => {
    await storage({ keyPrefix: "/sites/lintel/" }).put(
      "default/a.txt",
      Buffer.from("a"),
      "text/plain",
    );

    expect([...(s3.buckets.get("lintel-media")?.keys() ?? [])]).toEqual([
      "sites/lintel/default/a.txt",
    ]);
  });

  it("doesn't send the extra checksums that B2, R2 and older MinIO refuse", async () => {
    await storage().put("default/a.txt", Buffer.from("a"), "text/plain");

    const upload = s3.requests.find((request) => request.method === "PUT");
    expect(upload?.headers["x-amz-sdk-checksum-algorithm"]).toBeUndefined();
    expect(upload?.headers["content-encoding"]).toBeUndefined();
  });

  it("makes signed links that work without the keys and say how to show the file", async () => {
    const files = storage();
    await files.put("default/report.pdf", Buffer.from("%PDF"), "application/pdf");

    const url = await files.signedUrl("default/report.pdf", {
      expiresInSeconds: 600,
      contentType: "application/pdf",
      contentDisposition: 'attachment; filename="report.pdf"',
    });
    expect(url).toContain("X-Amz-Expires=600");

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="report.pdf"');
    expect(await response.text()).toBe("%PDF");
  });

  describe("checkReachable", () => {
    it("passes when the bucket is there and the keys may use it", async () => {
      await expect(storage().checkReachable()).resolves.toBeUndefined();
    });

    it("names the bucket when it doesn't exist", async () => {
      await expect(storage({ bucket: "typo-bucket" }).checkReachable()).rejects.toThrow(
        /no bucket called "typo-bucket".*S3_BUCKET/,
      );
    });

    it("points at the keys when they are refused", async () => {
      const wrongKeys = storage({ accessKeyId: "someone-else" });

      await expect(wrongKeys.checkReachable()).rejects.toThrow(StorageUnreachableError);
      await expect(wrongKeys.checkReachable()).rejects.toThrow(
        /S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY/,
      );
    });

    it("says when nothing answers at the endpoint", async () => {
      const nowhere = storage({ endpoint: "http://127.0.0.1:1" });

      await expect(nowhere.checkReachable()).rejects.toThrow(
        /couldn't reach http:\/\/127\.0\.0\.1:1.*S3_ENDPOINT/,
      );
    });
  });
});
