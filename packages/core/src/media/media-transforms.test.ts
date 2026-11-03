import { readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, useMediaTestServer } from "../testing/test-media.js";

/** The colour in the middle of an image, to see which part of the test PNG a crop kept. */
async function centreColour(image: Buffer): Promise<"red" | "blue" | "other"> {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  const middle =
    (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  const [red, , blue] = [data[middle] ?? 0, data[middle + 1] ?? 0, data[middle + 2] ?? 0];
  if (red > 200 && blue < 60) return "red";
  if (blue > 200 && red < 60) return "blue";
  return "other";
}

describe("image transforms", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  async function uploadTestImage() {
    const response = await media.upload("banner.png", await makeTestPng(400, 200));
    return response.json() as { id: string; url: string; thumbnailUrl: string };
  }

  function requestFile(assetId: string, query: string, headers: Record<string, string> = {}) {
    // The file URL is public: no cookies.
    return media.server.inject({ method: "GET", url: `/media/${assetId}/file?${query}`, headers });
  }

  it("resizes and converts, never enlarging", async () => {
    const asset = await uploadTestImage();

    const small = await requestFile(asset.id, "w=100&format=webp");
    const huge = await requestFile(asset.id, "w=4000&format=png");
    const contained = await requestFile(asset.id, "w=100&h=100&fit=contain&format=avif");

    expect(small.headers["content-type"]).toBe("image/webp");
    expect(await sharp(small.rawPayload).metadata()).toMatchObject({
      format: "webp",
      width: 100,
      height: 50,
    });
    expect(await sharp(huge.rawPayload).metadata()).toMatchObject({ width: 400, height: 200 });
    expect(contained.headers["content-type"]).toBe("image/avif");
    expect(await sharp(contained.rawPayload).metadata()).toMatchObject({ width: 100, height: 50 });
  });

  it("crops around the focal point for fit=cover", async () => {
    const asset = await uploadTestImage();

    const centred = await requestFile(asset.id, "w=100&h=100&fit=cover&format=png");
    await media.server.inject({
      method: "PATCH",
      url: `/media/${asset.id}`,
      cookies: media.adminCookies,
      payload: { focalPoint: { x: 0.9, y: 0.5 } },
    });
    const right = await requestFile(asset.id, "w=100&h=100&fit=cover&format=png");
    await media.server.inject({
      method: "PATCH",
      url: `/media/${asset.id}`,
      cookies: media.adminCookies,
      payload: { focalPoint: { x: 0.1, y: 0.5 } },
    });
    const left = await requestFile(asset.id, "w=100&h=100&fit=cover&format=png");

    expect(await sharp(right.rawPayload).metadata()).toMatchObject({ width: 100, height: 100 });
    // Moving the focal point makes a different crop, so it can't reuse the old ETag.
    expect(centred.headers.etag).not.toBe(right.headers.etag);
    expect(await centreColour(right.rawPayload)).toBe("blue");
    expect(await centreColour(left.rawPayload)).toBe("red");
  });

  it("makes each size once, then serves it from the disk cache", async () => {
    const asset = await uploadTestImage();

    const first = await requestFile(asset.id, "w=120&format=webp");
    const second = await requestFile(asset.id, "w=120&format=webp");

    expect(first.headers["lintel-transform-cache"]).toBe("miss");
    expect(second.headers["lintel-transform-cache"]).toBe("hit");
    expect(second.rawPayload.equals(first.rawPayload)).toBe(true);
    expect(await readdir(join(media.cacheFolder, asset.id))).toHaveLength(1);
  });

  it("sends long-lived cache headers and answers a matching ETag with 304", async () => {
    const asset = await uploadTestImage();
    const thumbnailQuery = new URL(asset.thumbnailUrl).search.slice(1);

    const versioned = await requestFile(asset.id, thumbnailQuery);
    const unversioned = await requestFile(asset.id, "w=400&format=webp");
    const revalidated = await requestFile(asset.id, thumbnailQuery, {
      "if-none-match": String(versioned.headers.etag),
    });

    expect(versioned.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(versioned.headers.etag).toMatch(/^"[0-9a-f]{32}"$/);
    // Without the version the same URL could show a new crop later, so it is kept for an hour.
    expect(unversioned.headers["cache-control"]).toBe("public, max-age=3600");
    expect(revalidated.statusCode).toBe(304);
    expect(revalidated.rawPayload).toHaveLength(0);
  });

  it("refuses sizes over 4000 pixels and unknown formats", async () => {
    const asset = await uploadTestImage();

    const tooWide = await requestFile(asset.id, "w=4001");
    const badFormat = await requestFile(asset.id, "format=bmp");

    expect(tooWide.statusCode).toBe(400);
    expect(tooWide.json().message).toContain("at most 4000 pixels");
    expect(badFormat.statusCode).toBe(400);
  });

  it("serves documents as downloads with their real type, ignoring resize options", async () => {
    const upload = await media.upload("Price list 2026 – café.csv", Buffer.from("item,price\n"));
    const { id } = upload.json();

    const response = await requestFile(id, "w=200&format=webp");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/csv");
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="Price list 2026  cafe.csv"; filename*=UTF-8''Price%20list%202026%20%E2%80%93%20caf%C3%A9.csv`,
    );
    expect(response.body).toBe("item,price\n");
  });

  it("lets pages on any address read a picture's pixels, for picture effects", async () => {
    const asset = await uploadTestImage();
    const response = await requestFile(asset.id, "w=100&format=webp", { origin: "null" });
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("answers 404 for an unknown or malformed id", async () => {
    const unknown = await requestFile("00000000-0000-4000-8000-000000000000", "w=10");
    const malformed = await requestFile("not-an-id", "");

    expect(unknown.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(404);
  });
});

describe("limits on resizing", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  it("limits how many sizes one address can ask for in a minute, but not originals", async () => {
    const assetId = crypto.randomUUID();
    const statuses = new Set<number>();
    for (let width = 1; width <= 300; width++) {
      const response = await media.server.inject({ url: `/media/${assetId}/file?w=${width}` });
      statuses.add(response.statusCode);
    }
    const overLimit = await media.server.inject({ url: `/media/${assetId}/file?w=301` });
    const original = await media.server.inject({ url: `/media/${assetId}/file` });

    expect([...statuses]).toEqual([404]);
    expect(overLimit.statusCode).toBe(429);
    expect(original.statusCode).toBe(404);
  }, 60_000);
});
