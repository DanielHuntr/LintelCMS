import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, useMediaTestServer } from "../testing/test-media.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("the media library's recycle bin", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  function request(method: "GET" | "PATCH" | "POST" | "DELETE", url: string, payload?: object) {
    return media.server.inject({ method, url, payload, cookies: media.adminCookies });
  }

  async function uploadImage(filename: string, seed: number) {
    const response = await media.upload(filename, await makeTestPng(20, 10, seed));
    return response.json() as { id: string; url: string };
  }

  it("lists deleted files and puts one back with its id, name and alt text", async () => {
    const asset = await uploadImage("team.png", 1);
    await request("PATCH", `/media/${asset.id}`, { alt: "The team at the summer party" });
    await request("DELETE", `/media/${asset.id}`);

    const listed = await request("GET", "/media-bin");
    expect(listed.json().items).toMatchObject([
      {
        id: asset.id,
        filename: "team.png",
        mimeType: "image/png",
        deletedBy: { id: expect.any(String) },
      },
    ]);

    const restored = await request("POST", `/media-bin/${asset.id}/restore`);

    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.json()).toMatchObject({
      id: asset.id,
      filename: "team.png",
      alt: "The team at the summer party",
    });
    expect((await request("GET", `/media/${asset.id}`)).statusCode).toBe(200);
    expect((await media.server.inject({ url: `/media/${asset.id}/file` })).statusCode).toBe(200);
    expect((await request("GET", "/media-bin")).json().items).toEqual([]);
  });

  it("won't restore a file uploaded again meanwhile, and says why", async () => {
    const png = await makeTestPng(20, 10, 4);
    const first = (await media.upload("logo.png", png)).json();
    await request("DELETE", `/media/${first.id}`);
    await media.upload("logo-again.png", png);

    const restored = await request("POST", `/media-bin/${first.id}/restore`);

    expect(restored.statusCode).toBe(409);
    expect(restored.json()).toMatchObject({ code: "ASSET_ALREADY_IN_LIBRARY" });
    expect(restored.json().message).toContain("logo.png");
  });

  it("empties the bin for good, files and all", async () => {
    const one = await uploadImage("one.png", 1);
    const two = await uploadImage("two.png", 2);
    await request("DELETE", `/media/${one.id}`);
    await request("DELETE", `/media/${two.id}`);

    const emptied = await request("DELETE", "/media-bin");
    const gone = await request("POST", `/media-bin/${one.id}/restore`);

    expect(emptied.json()).toEqual({ deleted: 2 });
    expect(await readdir(`${media.uploadsFolder}/default`)).toEqual([]);
    expect(gone.statusCode).toBe(404);
    expect(gone.json().message).toContain("isn't in the recycle bin");
  });

  it("needs media:upload to restore and media:delete to delete for good", async () => {
    const asset = await uploadImage("shared.png", 1);
    await request("DELETE", `/media/${asset.id}`);
    await createTestUser(testDatabase.database, "viewer@example.com", [["media:read"]]);
    const viewer = await signInAndGetCookies(media.server, "viewer@example.com");
    const as = (method: "GET" | "POST" | "DELETE", url: string) =>
      media.server.inject({ method, url, cookies: viewer });

    expect((await as("GET", "/media-bin")).statusCode).toBe(200);
    expect((await as("POST", `/media-bin/${asset.id}/restore`)).statusCode).toBe(403);
    expect((await as("DELETE", `/media-bin/${asset.id}`)).statusCode).toBe(403);
    expect((await as("DELETE", "/media-bin")).statusCode).toBe(403);
  });
});
