import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { buildServer } from "../server.js";
import { multipartFile } from "../testing/multipart.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, TEST_API_URL } from "../testing/test-media.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { LocalDiskStorage } from "./local-disk-storage.js";

// The server's own wiring, with no stand-ins: image fields check the real media library,
// delivery expands real assets, and an asset an entry uses can't be deleted.
describe("images in entries", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let folder: string;
  let cookies: Record<string, string>;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-images-"));
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      publicApiUrl: TEST_API_URL,
      runScheduledJobs: false,
      media: {
        storage: new LocalDiskStorage(join(folder, "uploads")),
        transformCacheFolder: join(folder, "cache"),
      },
    });
    await server.ready();
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    cookies = await signInAndGetCookies(server, "admin@example.com");
  });

  afterEach(async () => {
    await server.close();
    await rm(folder, { recursive: true, force: true });
  });

  function api(method: "POST" | "DELETE", url: string, payload?: object) {
    return server.inject({ method, url, payload, cookies });
  }

  it("accepts only images in the library, delivers them, and keeps them while used", async () => {
    const upload = await server.inject({
      method: "POST",
      url: "/media",
      cookies,
      ...multipartFile("hero.png", await makeTestPng(40, 20)),
    });
    const hero = upload.json() as { id: string };

    const unknownImage = await api("POST", "/collections/posts/entries", {
      data: { title: "Broken", featured_image: "11111111-2222-4333-8444-555555555555" },
    });
    const created = await api("POST", "/collections/posts/entries", {
      data: { title: "With a picture", featured_image: hero.id },
    });
    const entryId = (created.json() as { id: string }).id;
    await api("POST", `/entries/${entryId}/publish`);
    const delivered = await server.inject({ method: "GET", url: "/delivery/posts/with-a-picture" });
    const deleteWhileUsed = await api("DELETE", `/media/${hero.id}`);

    expect(unknownImage.statusCode).toBe(400);
    expect(created.statusCode).toBe(201);
    expect(delivered.json().data.featured_image).toMatchObject({
      id: hero.id,
      width: 40,
      height: 20,
      url: expect.stringContaining(`${TEST_API_URL}/media/${hero.id}/file`),
    });
    expect(deleteWhileUsed.statusCode).toBe(409);
    expect(deleteWhileUsed.json().usedBy).toEqual([{ entryId, title: "With a picture" }]);
  });
});
