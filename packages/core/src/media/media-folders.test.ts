import { describe, expect, it } from "vitest";
import { multipartFile } from "../testing/multipart.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, useMediaTestServer } from "../testing/test-media.js";

/** One shared library, with an optional folder for each site's own files. */
describe("site folders in the media library", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  function request(method: "GET" | "POST" | "PATCH", url: string, payload?: object) {
    return media.server.inject({ method, url, payload, cookies: media.adminCookies });
  }

  async function uploadTo(folder: string | undefined, filename: string, seed: number) {
    const response = await media.server.inject({
      method: "POST",
      url: folder ? `/media?folder=${folder}` : "/media",
      cookies: media.adminCookies,
      ...multipartFile(filename, await makeTestPng(20, 10, seed)),
    });
    return response.json() as { id: string; siteId: string | null };
  }

  const names = (response: { json: () => { assets: { filename: string }[] } }) =>
    response.json().assets.map((asset) => asset.filename);

  it("uploads to the shared library unless a site's folder is chosen, and filters by folder", async () => {
    await request("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      defaultLocale: "fr-FR",
    });
    const shared = await uploadTo(undefined, "logo.png", 1);
    const french = await uploadTo("france", "paris.png", 2);

    expect(shared.siteId).toBeNull();
    expect(french.siteId).toEqual(expect.any(String));
    expect(names(await request("GET", "/media"))).toEqual(["paris.png", "logo.png"]);
    expect(names(await request("GET", "/media?folder=shared"))).toEqual(["logo.png"]);
    expect(names(await request("GET", "/media?folder=france"))).toEqual(["paris.png"]);
    expect((await request("GET", "/media?folder=nowhere")).json().code).toBe("SITE_NOT_FOUND");
  });

  it("moves a file between folders, and back to the shared library when its site goes", async () => {
    await request("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      defaultLocale: "fr-FR",
    });
    const logo = await uploadTo(undefined, "logo.png", 1);

    const moved = await request("PATCH", `/media/${logo.id}`, { folder: "france" });
    expect(moved.json().siteId).toEqual(expect.any(String));
    expect(names(await request("GET", "/media?folder=france"))).toEqual(["logo.png"]);

    await media.server.inject({
      method: "DELETE",
      url: "/sites/france",
      cookies: media.adminCookies,
    });
    expect(names(await request("GET", "/media?folder=shared"))).toEqual(["logo.png"]);
  });
});
