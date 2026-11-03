import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng } from "../testing/test-media.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { describeCredit, freePhotoFilename } from "./free-photos.service.js";
import { TimedCache } from "./timed-cache.js";

const BAKERY_ID = "a41bba82-76b0-4ddf-93ea-c907b0b191f7";
const NON_COMMERCIAL_ID = "b1111111-1111-4111-8111-111111111111";
const PUBLIC_DOMAIN_ID = "c2222222-2222-4222-8222-222222222222";

/**
 * A stand-in for Openverse's API on a local port: a search with three results (one of them
 * non-commercial, which must never reach the admin), each photo's details, thumbnails, and
 * the photo files themselves. It records every request, so tests can see what was asked.
 */
class StandInOpenverse {
  readonly requests: IncomingMessage[] = [];
  answer: "normal" | "down" | "busy" = "normal";
  private server: Server | undefined;
  private png: Buffer = Buffer.alloc(0);

  get address(): string {
    const { port } = this.server?.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async start(): Promise<void> {
    this.png = await makeTestPng(120, 80);
    this.server = createServer((request, response) => {
      this.requests.push(request);
      if (this.answer === "busy") return void response.writeHead(429).end();
      if (this.answer === "down") return void response.writeHead(503).end();
      const path = new URL(request.url ?? "/", this.address).pathname;
      if (path === "/v1/images/") {
        return void response
          .writeHead(200, { "content-type": "application/json" })
          .end(
            JSON.stringify({ result_count: 3, page_count: 40, page: 1, results: this.images() }),
          );
      }
      const detail = /^\/v1\/images\/([0-9a-f-]+)\/$/.exec(path);
      const image = this.images().find((candidate) => candidate.id === detail?.[1]);
      if (image) {
        return void response
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(image));
      }
      if (/^\/v1\/images\/[0-9a-f-]+\/thumb\/$/.test(path) || path === "/photos/bakery.png") {
        return void response.writeHead(200, { "content-type": "image/png" }).end(this.png);
      }
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
  }

  async stop(): Promise<void> {
    await new Promise((resolve) => this.server?.close(resolve));
  }

  private images() {
    const photo = (id: string, license: string, version: string | null, title: string) => ({
      id,
      title,
      url: `${this.address}/photos/bakery.png`,
      foreign_landing_url: "https://www.flickr.com/photos/example/141332285",
      creator: "InfoMofo",
      creator_url: "https://www.flickr.com/photos/example",
      license,
      license_version: version,
      license_url: version ? `https://creativecommons.org/licenses/${license}/${version}/` : null,
      provider: "flickr",
      source: "flickr",
      width: 1024,
      height: 768,
      mature: false,
    });
    return [
      photo(BAKERY_ID, "by-sa", "2.0", "Bakery"),
      photo(NON_COMMERCIAL_ID, "by-nc", "2.0", "Not for business"),
      photo(PUBLIC_DOMAIN_ID, "pdm", null, "Old bread"),
    ];
  }
}

describe("free photos", () => {
  const testDatabase = useTestDatabase();
  const openverse = new StandInOpenverse();
  let folder = "";
  let server: FastifyInstance;
  let cookies: Record<string, string>;

  async function startServer(allowPrivateDownloads: boolean) {
    await server?.close();
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      publicApiUrl: "http://api.test",
      media: {
        storage: new LocalDiskStorage(join(folder, "uploads")),
        transformCacheFolder: join(folder, "cache"),
      },
      freePhotos: { openverseApiUrl: openverse.address, allowPrivateDownloads },
    });
    await server.ready();
  }

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-free-photos-"));
    await openverse.start();
    openverse.requests.length = 0;
    openverse.answer = "normal";
    await startServer(true);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    await setEnabledPlugins(testDatabase.database, server.plugins, ["free-photos"]);
    cookies = await signInAndGetCookies(server, "admin@example.com");
  });

  afterEach(async () => {
    await server.close();
    await openverse.stop();
    await rm(folder, { recursive: true, force: true });
  });

  const search = (query: string, as = cookies) =>
    server.inject({ method: "GET", url: `/free-photos/search?${query}`, cookies: as });
  const add = (body: unknown, as = cookies) =>
    server.inject({
      method: "POST",
      url: "/free-photos/add",
      payload: body as object,
      cookies: as,
    });

  it("is off until switched on", async () => {
    await setEnabledPlugins(testDatabase.database, server.plugins, []);

    const response = await search("q=bread");

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("PLUGIN_NOT_ENABLED");
  });

  it("is only for signed-in people who may upload media", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["media:read"]]);
    const readerCookies = await signInAndGetCookies(server, "reader@example.com");

    expect((await search("q=bread", {})).statusCode).toBe(401);
    expect((await search("q=bread", readerCookies)).statusCode).toBe(403);
    expect((await add({ id: BAKERY_ID }, readerCookies)).statusCode).toBe(403);
    expect(openverse.requests).toHaveLength(0);
  });

  it("searches from the server, asking politely for business-friendly licences only", async () => {
    const response = await search("q=bread%20shop&page=2");

    expect(response.statusCode).toBe(200);
    const [request] = openverse.requests;
    const asked = new URL(request?.url ?? "", openverse.address).searchParams;
    expect(asked.get("q")).toBe("bread shop");
    expect(asked.get("page")).toBe("2");
    expect(asked.get("license")).toBe("cc0,pdm,by,by-sa");
    expect(request?.headers["user-agent"]).toContain("LintelCMS");

    const { photos, pageCount } = response.json();
    // The non-commercial result Openverse sent anyway is left out.
    expect(photos.map((photo: { title: string }) => photo.title)).toEqual(["Bakery", "Old bread"]);
    expect(photos[0]).toMatchObject({
      creator: "InfoMofo",
      licence: "by-sa",
      licenceName: "CC BY-SA 2.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
      thumbnailUrl: `http://api.test/free-photos/${BAKERY_ID}/thumbnail`,
    });
    expect(photos[1]).toMatchObject({ licence: "pdm", licenceName: "Public Domain Mark" });
    // Openverse lets anonymous searches go 12 pages deep.
    expect(pageCount).toBe(12);
  });

  it("keeps a search for a while, so asking again doesn't ask Openverse again", async () => {
    await search("q=bread");
    await search("q=bread");

    expect(openverse.requests).toHaveLength(1);
  });

  it("refuses an empty search with a plain message", async () => {
    const response = await search("q=%20");

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("Type what the photo should show");
  });

  it("says so in plain words when Openverse is down or busy", async () => {
    openverse.answer = "down";
    const down = await search("q=bread");
    openverse.answer = "busy";
    const busy = await search("q=rolls");

    expect(down.statusCode).toBe(502);
    expect(down.json().message).toContain("isn't answering right now");
    expect(busy.statusCode).toBe(429);
    expect(busy.json().code).toBe("FREE_PHOTOS_BUSY");
  });

  it("passes thumbnails through Lintel", async () => {
    const response = await server.inject({
      method: "GET",
      url: `/free-photos/${BAKERY_ID}/thumbnail`,
      cookies,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["cache-control"]).toBe("private, max-age=86400");
  });

  it("adds a photo to the media library with its credit", async () => {
    const response = await add({ id: BAKERY_ID });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      filename: "Bakery.png",
      mimeType: "image/png",
      width: 120,
      height: 80,
      alt: "",
      credit:
        "“Bakery” by InfoMofo, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/). " +
        "Source: https://www.flickr.com/photos/example/141332285",
      uploadedBy: { name: "Ana Editor" },
    });
    // The website shows the credit in parts: the creator links to the source, the licence to its terms.
    expect(response.json().photoCredit).toEqual({
      text: response.json().credit,
      creator: "InfoMofo",
      sourceUrl: "https://www.flickr.com/photos/example/141332285",
      licenceName: "CC BY-SA 2.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    });
    const stored = await readdir(join(folder, "uploads", "default"));
    expect(stored).toHaveLength(1);

    // Adding it again gives back the same item rather than a copy.
    const again = await add({ id: BAKERY_ID });
    expect(again.statusCode).toBe(200);
    expect(again.json().id).toBe(response.json().id);
  });

  it("keeps a public domain photo's credit, but asks the website to show none", async () => {
    const response = await add({ id: PUBLIC_DOMAIN_ID });

    expect(response.json().credit).toContain("Public Domain Mark");
    expect(response.json().photoCredit).toBeNull();
  });

  it("never adds a photo whose licence isn't offered", async () => {
    const response = await add({ id: NON_COMMERCIAL_ID });

    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("FREE_PHOTO_LICENCE_NOT_ALLOWED");
  });

  it("refuses to download from a private address", async () => {
    await startServer(false);
    await setEnabledPlugins(testDatabase.database, server.plugins, ["free-photos"]);
    cookies = await signInAndGetCookies(server, "admin@example.com");

    const response = await add({ id: BAKERY_ID });

    expect(response.statusCode).toBe(502);
    expect(response.json().message).toContain("127.0.0.1 is a private or local address");
    expect(await readdir(join(folder, "uploads")).catch(() => [])).toEqual([]);
  });

  it("answers 404 for a photo Openverse doesn't have", async () => {
    const response = await add({ id: "d3333333-3333-4333-8333-333333333333" });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("FREE_PHOTO_NOT_FOUND");
  });
});

describe("free photo credits", () => {
  it("leave out what isn't known", () => {
    expect(
      describeCredit({
        title: "",
        creator: "",
        licenceName: "CC0 1.0",
        licenceUrl: null,
        pageUrl: "",
      }),
    ).toBe("Photo, CC0 1.0.");
  });
});

describe("free photo filenames", () => {
  it("are short, and a slash or hashtag in the title doesn't cut them", () => {
    expect(
      freePhotoFilename(
        "Arnold Bakery Bread Truck, 5/2016, pics by Mike Mozart of TheToyChannel #Arnold #Bakery",
      ),
    ).toBe("Arnold Bakery Bread Truck, 5 2016, pics by Mike Mozart of.jpg");
    expect(freePhotoFilename("  ")).toBe("Free photo.jpg");
    expect(freePhotoFilename("Old bread")).toBe("Old bread.jpg");
  });
});

describe("the timed cache", () => {
  it("forgets entries when they expire, and the oldest when full", () => {
    let now = 0;
    const cache = new TimedCache<string>(1000, 2, () => now);
    cache.write("a", "first");
    cache.write("b", "second");
    cache.write("c", "third");

    expect(cache.read("a")).toBeUndefined();
    expect(cache.read("b")).toBe("second");
    now = 1000;
    expect(cache.read("c")).toBeUndefined();
  });
});
