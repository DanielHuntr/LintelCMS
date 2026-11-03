import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEmptyPage, type PageDocument } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { uploadAsset } from "../media/index.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng } from "../testing/test-media.js";
import { requestsAs, type SendRequest } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

type Node = PageDocument["root"]["children"][number];

describe("cursor pictures in the media library", () => {
  const testDatabase = useTestDatabase();
  let folder = "";
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-cursor-picture-"));
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      publicApiUrl: "http://api.test",
      media: {
        storage: new LocalDiskStorage(join(folder, "uploads")),
        transformCacheFolder: join(folder, "cache"),
      },
    });
    await server.ready();
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
  });

  afterEach(async () => {
    await server.close();
    await rm(folder, { recursive: true, force: true });
  });

  async function uploadPicture() {
    const { asset } = await uploadAsset(
      server.siteFonts.context().media,
      { filename: "arrow.png", contents: await makeTestPng(8, 8, 1) },
      null,
    );
    return asset.id;
  }

  it("won't delete the picture the site's cursor shows, and names the site", async () => {
    const assetId = await uploadPicture();
    const src = `http://api.test/media/${assetId}/file`;
    const saved = await api("PUT", "/website/effects", {
      cursor: { style: "picture", picture: { assetId, src, size: 32 } },
    });
    expect(saved.statusCode, saved.body).toBe(200);

    const refused = await api("DELETE", `/media/${assetId}`);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({
      code: "ASSET_IN_USE",
      usedBy: [{ place: "siteCursor" }],
    });

    // Once the cursor no longer shows a picture, the file can go.
    await api("PUT", "/website/effects", { cursor: { style: "dot" } });
    expect((await api("DELETE", `/media/${assetId}`)).statusCode).toBe(204);
  });

  it("won't delete the picture an element gives the cursor, and names the page", async () => {
    const assetId = await uploadPicture();
    const page = createEmptyPage();
    const box = {
      id: "b1",
      type: "box",
      effects: [
        {
          effect: "cursor-over",
          params: { mode: "picture", src: `http://api.test/media/${assetId}/file`, size: 32 },
        },
      ],
    } as unknown as Node;
    const created = await api("POST", "/collections/pages/entries", {
      data: { title: "Shop", design: { ...page, root: { ...page.root, children: [box] } } },
    });
    expect(created.statusCode, created.body).toBe(201);

    const refused = await api("DELETE", `/media/${assetId}`);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().usedBy).toEqual([{ entryId: created.json().id, title: "Shop" }]);
  });
});
