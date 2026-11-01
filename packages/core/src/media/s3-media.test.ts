import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  FAKE_S3_ACCESS_KEY,
  FAKE_S3_SECRET_KEY,
  type FakeS3Server,
  startFakeS3Server,
} from "../testing/fake-s3-server.js";
import { multipartFile } from "../testing/multipart.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng } from "../testing/test-media.js";
import { startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { LocalDiskStorage } from "./local-disk-storage.js";
import { S3Storage } from "./s3-storage.js";
import { copyStoredFiles } from "./storage-move.service.js";
import type { StorageDriver } from "./storage-driver.js";

describe("media in an S3 bucket", () => {
  const testDatabase = useTestDatabase();
  let s3: FakeS3Server;
  let folder: string;
  let bucket: S3Storage;
  let server: FastifyInstance | undefined;

  async function startServer(storage: StorageDriver, signedUrlSeconds?: number) {
    const started = await startTestServer(testDatabase.activeDatabase, {
      media: { storage, transformCacheFolder: join(folder, "cache"), signedUrlSeconds },
    });
    server = started;
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    const cookies = await signInAndGetCookies(started, "admin@example.com");
    const upload = async (filename: string, contents: Buffer) => {
      const response = await started.inject({
        method: "POST",
        url: "/media",
        cookies,
        ...multipartFile(filename, contents),
      });
      return response.json<{ id: string; url: string }>();
    };
    return { server: started, upload };
  }

  beforeAll(async () => {
    s3 = await startFakeS3Server(["lintel-media"]);
    bucket = new S3Storage({
      bucket: "lintel-media",
      region: "auto",
      endpoint: s3.endpoint,
      accessKeyId: FAKE_S3_ACCESS_KEY,
      secretAccessKey: FAKE_S3_SECRET_KEY,
    });
  });
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-s3-media-"));
    s3.buckets.get("lintel-media")?.clear();
  });
  afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
  });
  afterAll(async () => {
    bucket.close();
    await s3.close();
  });

  it("uploads into the bucket and serves files through Lintel by default", async () => {
    const { server, upload } = await startServer(bucket);
    const asset = await upload("photo.png", await makeTestPng());

    expect(s3.buckets.get("lintel-media")?.size).toBe(1);
    const file = await server.inject({ method: "GET", url: `/media/${asset.id}/file` });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("image/png");
  });

  it("sends originals to a short-lived signed link when that is switched on", async () => {
    const { server, upload } = await startServer(bucket, 600);
    const asset = await upload("notes.txt", Buffer.from("Meeting notes"));

    const response = await server.inject({ method: "GET", url: `/media/${asset.id}/file` });
    expect(response.statusCode).toBe(302);
    // Kept by the browser for less than the link lasts, and never by a shared cache.
    expect(response.headers["cache-control"]).toBe("private, max-age=300");

    const fromBucket = await fetch(String(response.headers.location));
    expect(await fromBucket.text()).toBe("Meeting notes");
    expect(fromBucket.headers.get("content-disposition")).toContain("attachment");
  });

  it("still makes resized images itself when signed links are on", async () => {
    const { server, upload } = await startServer(bucket, 600);
    const asset = await upload("photo.png", await makeTestPng());

    const resized = await server.inject({ method: "GET", url: `/media/${asset.id}/file?w=100` });
    expect(resized.statusCode).toBe(200);
    expect(resized.headers["lintel-transform-cache"]).toBe("miss");
  });

  it("moves files from the disk to the bucket, and can be run again safely", async () => {
    const disk = new LocalDiskStorage(join(folder, "uploads"));
    const { upload } = await startServer(disk);
    await upload("one.png", await makeTestPng(400, 200, 1));
    await upload("two.png", await makeTestPng(400, 200, 2));

    const dryRun = await copyStoredFiles({
      database: testDatabase.database,
      from: disk,
      to: bucket,
      dryRun: true,
    });
    expect(dryRun).toEqual({ copied: 2, alreadyThere: 0, missing: [] });
    expect(s3.buckets.get("lintel-media")?.size).toBe(0);

    const first = await copyStoredFiles({
      database: testDatabase.database,
      from: disk,
      to: bucket,
    });
    expect(first.copied).toBe(2);
    const [stored] = [...(s3.buckets.get("lintel-media")?.values() ?? [])];
    expect(stored?.contentType).toBe("image/png");

    const again = await copyStoredFiles({
      database: testDatabase.database,
      from: disk,
      to: bucket,
    });
    expect(again).toEqual({ copied: 0, alreadyThere: 2, missing: [] });
  });

  it("lists files the library knows about but the disk has lost", async () => {
    const disk = new LocalDiskStorage(join(folder, "uploads"));
    const { upload } = await startServer(disk);
    await upload("one.png", await makeTestPng());
    await rm(join(folder, "uploads"), { recursive: true });

    const report = await copyStoredFiles({
      database: testDatabase.database,
      from: disk,
      to: bucket,
    });
    expect(report.copied).toBe(0);
    expect(report.missing).toHaveLength(1);
  });
});
