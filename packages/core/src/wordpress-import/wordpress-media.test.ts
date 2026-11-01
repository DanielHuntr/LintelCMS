import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  allowedMediaHosts,
  describeConnectionError,
  downloadingMediaSource,
} from "./wordpress-media.js";
import { wordpressImportMappingSchema } from "./wordpress-import.schema.js";

describe("downloading images from the old site", () => {
  let server: Server;
  let oldSite: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === "/wp-content/uploads/loaf.png") {
        response.writeHead(200, { "content-type": "image/png" }).end("png bytes");
      } else if (request.url === "/moved.png") {
        response.writeHead(302, { location: "https://elsewhere.example/loaf.png" }).end();
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    oldSite = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const options = { allowPrivateAddresses: true };

  it("allows the old site's own address, with and without www, and the ones added", () => {
    const hosts = allowedMediaHosts("https://hillside-bakery.example", ["cdn.example.com"]);
    expect([...hosts].sort()).toEqual([
      "cdn.example.com",
      "hillside-bakery.example",
      "www.hillside-bakery.example",
    ]);
    expect([...allowedMediaHosts("not an address", [])]).toEqual([]);
  });

  it("downloads from the old site", async () => {
    const source = downloadingMediaSource(options, allowedMediaHosts(oldSite, []));
    expect((await source.fetch(`${oldSite}/wp-content/uploads/loaf.png`)).toString()).toBe(
      "png bytes",
    );
  });

  it("refuses other addresses, in the dry run too, and says how to allow them", async () => {
    const source = downloadingMediaSource(options, allowedMediaHosts(oldSite, []));
    await expect(source.check("https://tracker.example/pixel.png")).rejects.toThrow(
      "tracker.example isn't the old site's address",
    );
    await expect(source.fetch("https://tracker.example/pixel.png")).rejects.toThrow(
      "Add it to the addresses images may come from",
    );
  });

  it("refuses a redirect to an address that isn't allowed", async () => {
    const source = downloadingMediaSource(options, allowedMediaHosts(oldSite, []));
    await expect(source.fetch(`${oldSite}/moved.png`)).rejects.toThrow(
      "elsewhere.example isn't the old site's address",
    );
  });

  it("reads hosts from whole addresses people paste", () => {
    const mapping = wordpressImportMappingSchema.parse({
      mediaHosts: ["https://CDN.example.com/uploads/", "i0.wp.com"],
    });
    expect(mapping.mediaHosts).toEqual(["cdn.example.com", "i0.wp.com"]);
    expect(wordpressImportMappingSchema.safeParse({ mediaHosts: ["not a host!"] }).success).toBe(
      false,
    );
  });

  it("explains a site that can't be reached in words", () => {
    const notFound = Object.assign(new Error("getaddrinfo ENOTFOUND old.example"), {
      code: "ENOTFOUND",
    });
    expect(describeConnectionError(notFound, "old.example")).toBe(
      "old.example couldn't be found. Is the old site still online? If not, upload its wp-content folder as a zip instead",
    );
  });
});
