import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, useMediaTestServer } from "../testing/test-media.js";
import { describeLoadProblem, useImageLibraryForTesting } from "./image-library.js";

describe("media on a server where sharp can't load", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  afterEach(() => useImageLibraryForTesting(undefined));

  it("says resizing works when sharp loads", async () => {
    const status = await media.server.inject({
      method: "GET",
      url: "/media/image-resizing",
      cookies: media.adminCookies,
    });

    expect(status.json()).toEqual({ available: true, problem: null });
  });

  it("keeps uploads working and serves images at their original size", async () => {
    const png = await makeTestPng(32, 16);
    useImageLibraryForTesting({
      available: false,
      problem: "Could not load the sharp module using the linux-x64 runtime",
    });

    const upload = await media.upload("logo.png", png);
    expect(upload.statusCode).toBe(201);
    expect(upload.json()).toMatchObject({ mimeType: "image/png", width: null, height: null });

    const resized = await media.server.inject({
      method: "GET",
      url: `/media/${upload.json().id}/file?w=10&format=webp`,
    });
    expect(resized.statusCode).toBe(200);
    expect(resized.headers["content-type"]).toBe("image/png");
    expect(resized.rawPayload.equals(png)).toBe(true);

    const status = await media.server.inject({
      method: "GET",
      url: "/media/image-resizing",
      cookies: media.adminCookies,
    });
    expect(status.json()).toEqual({
      available: false,
      problem: "Could not load the sharp module using the linux-x64 runtime",
    });
  });

  it("keeps only the first line of sharp's long explanation", () => {
    const error = new Error("Could not load the sharp module\nPossible solutions:\n- npm i");
    expect(describeLoadProblem(error)).toBe("Could not load the sharp module");
  });
});
