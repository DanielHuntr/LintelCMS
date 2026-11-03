import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, TEST_API_URL, useMediaTestServer } from "../testing/test-media.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { createAssetLookup } from "./asset-lookup.js";

describe("the media library", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  function request(method: "GET" | "PATCH" | "DELETE", url: string, payload?: object) {
    return media.server.inject({ method, url, payload, cookies: media.adminCookies });
  }

  async function uploadImage(filename: string, seed: number) {
    return (await media.upload(filename, await makeTestPng(20, 10, seed))).json() as {
      id: string;
      url: string;
      credit: string;
    };
  }

  it("lists newest first, with search and a type filter", async () => {
    await uploadImage("beach.png", 1);
    await media.upload("menu.csv", Buffer.from("dish,price\n"));
    await uploadImage("beach-sunset.png", 2);
    await request("PATCH", `/media/${(await uploadImage("hills.png", 3)).id}`, {
      alt: "Sunset over the hills",
    });

    const all = await request("GET", "/media?search=&type=");
    const images = await request("GET", "/media?type=image");
    const documents = await request("GET", "/media?type=document");
    const sunset = await request("GET", "/media?search=SUNSET");
    const paged = await request("GET", "/media?page=2&perPage=3");

    const names = (response: typeof all) =>
      response.json().assets.map((asset: { filename: string }) => asset.filename);
    expect(names(all)).toEqual(["hills.png", "beach-sunset.png", "menu.csv", "beach.png"]);
    expect(all.json().total).toBe(4);
    expect(names(images)).toEqual(["hills.png", "beach-sunset.png", "beach.png"]);
    expect(names(documents)).toEqual(["menu.csv"]);
    // Search looks at alt text too, so "sunset" finds hills.png by its description.
    expect(names(sunset)).toEqual(["hills.png", "beach-sunset.png"]);
    expect(names(paged)).toEqual(["beach.png"]);
    expect(paged.json().total).toBe(4);
  });

  it("treats % and _ in a search as plain characters", async () => {
    await uploadImage("50%_off.png", 1);
    await uploadImage("500 off.png", 2);

    const response = await request("GET", "/media?search=50%25_");

    expect(response.json().assets).toHaveLength(1);
  });

  it("updates alt text, the focal point and the filename, keeping the real extension", async () => {
    const asset = await uploadImage("IMG_2041.png", 1);

    const response = await request("PATCH", `/media/${asset.id}`, {
      alt: "  Two people laughing at a café table  ",
      focalPoint: { x: 0.25, y: 0.75 },
      filename: "cafe-team.jpg",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      alt: "Two people laughing at a café table",
      focalPoint: { x: 0.25, y: 0.75 },
      filename: "cafe-team.png",
    });
    // The URLs change with the focal point, so cached crops are never shown for the old one.
    expect(response.json().url).not.toBe(asset.url);
    expect((await request("GET", `/media/${asset.id}`)).json()).toEqual(response.json());
  });

  it("keeps a credit for files that must be credited, empty until one is written", async () => {
    const asset = await uploadImage("harbour.png", 7);
    expect(asset.credit).toBe("");

    const response = await request("PATCH", `/media/${asset.id}`, {
      credit: "  Photo by Ana Ruiz, CC BY 4.0  ",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().credit).toBe("Photo by Ana Ruiz, CC BY 4.0");
  });

  it("refuses a focal point outside the image", async () => {
    const asset = await uploadImage("photo.png", 1);

    const response = await request("PATCH", `/media/${asset.id}`, { focalPoint: { x: 1.5, y: 0 } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("deletes an unused asset with its file and resized copies", async () => {
    const asset = await uploadImage("old-logo.png", 1);
    await media.server.inject({ url: `/media/${asset.id}/file?w=10` });

    const response = await request("DELETE", `/media/${asset.id}`);

    expect(response.statusCode).toBe(204);
    expect((await request("GET", `/media/${asset.id}`)).statusCode).toBe(404);
    expect(await readdir(`${media.uploadsFolder}/default`)).toEqual([]);
    expect(await readdir(media.cacheFolder)).toEqual([]);
  });

  it("refuses to delete an asset that entries use, and says which", async () => {
    const asset = await uploadImage("hero.png", 1);
    const usedBy = [{ entryId: "1f0c7a4e-8d1b-4c39-9a57-1d2c3b4a5e6f", title: "Home" }];
    media.markAssetUsed(asset.id, usedBy);

    const response = await request("DELETE", `/media/${asset.id}`);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      statusCode: 409,
      code: "ASSET_IN_USE",
      error: "Conflict",
      message: "This file is used in 1 entry. Remove it from there first, then delete it.",
      usedBy,
    });
    expect((await request("GET", `/media/${asset.id}`)).statusCode).toBe(200);
  });

  it("needs media:read, media:upload, media:update and media:delete; the file URL is public", async () => {
    const asset = await uploadImage("shared.png", 1);
    await createTestUser(testDatabase.database, "viewer@example.com", [["media:read"]]);
    await createTestUser(testDatabase.database, "writer@example.com", [["entries:*"]]);
    const viewer = await signInAndGetCookies(media.server, "viewer@example.com");
    const writer = await signInAndGetCookies(media.server, "writer@example.com");
    const as = (cookies: Record<string, string>, method: "GET" | "PATCH" | "DELETE", url: string) =>
      media.server.inject({ method, url, cookies, payload: method === "PATCH" ? {} : undefined });

    expect((await media.server.inject({ url: "/media" })).statusCode).toBe(401);
    expect((await as(writer, "GET", "/media")).statusCode).toBe(403);
    expect((await as(viewer, "GET", "/media")).statusCode).toBe(200);
    expect((await as(viewer, "GET", `/media/${asset.id}`)).statusCode).toBe(200);
    const upload = await media.upload("new.png", await makeTestPng(4, 4, 9), viewer);
    expect(upload.statusCode).toBe(403);
    expect(upload.json().message).toContain("media:upload");
    expect((await as(viewer, "PATCH", `/media/${asset.id}`)).json().message).toContain(
      "media:update",
    );
    expect((await as(viewer, "DELETE", `/media/${asset.id}`)).json().message).toContain(
      "media:delete",
    );
    expect((await media.server.inject({ url: `/media/${asset.id}/file` })).statusCode).toBe(200);
  });
});

describe("looking up assets from other features", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  it("finds assets by id for the delivery API, skipping ones that don't exist", async () => {
    const upload = await media.upload("hero.png", await makeTestPng(40, 20));
    const asset = upload.json();
    const lookup = createAssetLookup(media.server);

    const found = await lookup.findAssetsByIds([
      asset.id,
      "not-a-uuid",
      "00000000-0000-4000-8000-000000000000",
    ]);

    expect([...found.keys()]).toEqual([asset.id]);
    expect(found.get(asset.id)).toEqual({
      id: asset.id,
      url: asset.url,
      alt: "",
      width: 40,
      height: 20,
      focalPoint: { x: 0.5, y: 0.5 },
    });
    expect(found.get(asset.id)?.url.startsWith(TEST_API_URL)).toBe(true);
    expect(await lookup.assetExists(asset.id)).toBe(true);
    expect(await lookup.assetExists("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
