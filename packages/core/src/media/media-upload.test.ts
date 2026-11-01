import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { multipartFile } from "../testing/multipart.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, TEST_API_URL, useMediaTestServer } from "../testing/test-media.js";

describe("uploading media", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  it("stores a real PNG with its size, type and uploader", async () => {
    const png = await makeTestPng(64, 48);

    const response = await media.upload("Team photo.png", png);

    expect(response.statusCode).toBe(201);
    const asset = response.json();
    expect(asset).toMatchObject({
      filename: "Team photo.png",
      mimeType: "image/png",
      size: png.length,
      width: 64,
      height: 48,
      alt: "",
      focalPoint: { x: 0.5, y: 0.5 },
      uploadedBy: { name: "Ana Editor" },
    });
    expect(asset.url).toMatch(new RegExp(`^${TEST_API_URL}/media/${asset.id}/file\\?v=\\w+$`));
    expect(asset.thumbnailUrl).toContain("w=400&format=webp");
    expect(await readdir(join(media.uploadsFolder, "default"))).toEqual([`${asset.id}.png`]);

    const original = await media.server.inject({ method: "GET", url: `/media/${asset.id}/file` });
    expect(original.headers["content-type"]).toBe("image/png");
    expect(original.rawPayload.equals(png)).toBe(true);
  });

  it("judges a file by its bytes: a program renamed to .png is refused", async () => {
    const program = Buffer.concat([
      Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00", "latin1"),
      Buffer.alloc(256),
    ]);

    const response = await media.upload("holiday.png", program);

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ code: "FILE_TYPE_NOT_ALLOWED" });
    expect(response.json().message).toContain("It looks like a .exe file");
    expect(await readdir(media.uploadsFolder).catch(() => [])).toEqual([]);
  });

  it("gives a mislabelled image the extension of what it really is", async () => {
    const jpeg = await (
      await import("sharp")
    )
      .default({ create: { width: 8, height: 8, channels: 3, background: "#00ff00" } })
      .jpeg()
      .toBuffer();

    const response = await media.upload("../../etc/<logo>.png", jpeg);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ filename: "logo.jpg", mimeType: "image/jpeg" });
  });

  it("accepts plain text and CSV, which have no signature, by their extension", async () => {
    const csv = await media.upload("prices.csv", Buffer.from("name,price\nTea,3\n"));
    const text = await media.upload("notes.txt", Buffer.from("Opening hours: 9 to 5\n"));
    const script = await media.upload("page.html", Buffer.from("<p>Hello</p>"));

    expect(csv.json()).toMatchObject({ mimeType: "text/csv", width: null, thumbnailUrl: null });
    expect(text.json()).toMatchObject({ mimeType: "text/plain" });
    expect(script.statusCode).toBe(415);
  });

  it("hands back the existing asset when the same file is uploaded twice", async () => {
    const png = await makeTestPng(10, 10);

    const first = await media.upload("one.png", png);
    const second = await media.upload("copy of one.png", png);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    const list = await media.server.inject({
      method: "GET",
      url: "/media",
      cookies: media.adminCookies,
    });
    expect(list.json().total).toBe(1);
  });

  it.each([
    ["a script", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ["an event handler", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'],
    [
      "a hidden javascript: link",
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;avascript:alert(1)"><rect/></a></svg>',
    ],
    [
      "embedded HTML",
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>',
    ],
  ])("refuses an SVG with %s", async (_description, svg) => {
    const response = await media.upload("logo.svg", Buffer.from(svg));

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: "UNSAFE_SVG" });
    expect(response.json().message).toContain("could run code in visitors' browsers");
  });

  it("accepts a plain SVG and sandboxes it when served", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0071e3"/></svg>';

    const response = await media.upload("logo.svg", Buffer.from(svg));

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ mimeType: "image/svg+xml", width: 120, height: 40 });
    const served = await media.server.inject({ url: `/media/${response.json().id}/file` });
    expect(served.headers["content-security-policy"]).toContain("sandbox");
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuses files over 25 MB, and requests without a file", async () => {
    const tooLarge = await media.upload("huge.png", Buffer.alloc(25 * 1024 * 1024 + 1));
    const wrongField = await media.server.inject({
      method: "POST",
      url: "/media",
      cookies: media.adminCookies,
      ...multipartFile("a.png", await makeTestPng(4, 4), "image/png", "image"),
    });
    const notMultipart = await media.server.inject({
      method: "POST",
      url: "/media",
      cookies: media.adminCookies,
      payload: { file: "a.png" },
    });

    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.json()).toMatchObject({ code: "FILE_TOO_LARGE" });
    expect(wrongField.statusCode).toBe(400);
    expect(notMultipart.statusCode).toBe(400);
    expect(notMultipart.json().message).toContain("Choose a file to upload");
  });
});
