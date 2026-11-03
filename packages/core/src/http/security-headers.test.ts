import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { hideSecretsInUrl } from "./request-logging.js";

describe("headers on every response", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance | undefined;

  afterEach(() => server?.close());

  async function start(publicApiUrl: string) {
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      publicApiUrl,
    });
    server.get("/test/own-policy", async (_request, reply) =>
      reply.header("content-security-policy", "sandbox").send("file"),
    );
    server.get("/test/broken", async () => {
      throw new Error('relation "secret_table" does not exist at /srv/lintel/db.ts:12');
    });
    await server.ready();
    return server;
  }

  it("tells browsers to treat API responses as data, never as a page", async () => {
    const api = await start("http://localhost:4000");
    const response = await api.inject({ method: "GET", url: "/health" });

    expect(response.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    });
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("adds Strict-Transport-Security once the API is on HTTPS", async () => {
    const api = await start("https://api.example.com");
    const response = await api.inject({ method: "GET", url: "/health" });

    expect(response.headers["strict-transport-security"]).toBe("max-age=31536000");
  });

  it("keeps a route's own Content-Security-Policy", async () => {
    const api = await start("http://localhost:4000");
    const response = await api.inject({ method: "GET", url: "/test/own-policy" });

    expect(response.headers["content-security-policy"]).toBe("sandbox");
  });

  it("answers an unexpected failure with a plain message, keeping internals for the log", async () => {
    const api = await start("http://localhost:4000");
    const response = await api.inject({ method: "GET", url: "/test/broken" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: "INTERNAL", error: "Internal Server Error" });
    expect(response.body).not.toContain("secret_table");
    expect(response.body).not.toContain("/srv/lintel");
  });
});

describe("request logs", () => {
  it("hide preview tokens and other secrets in addresses", () => {
    expect(hideSecretsInUrl("/preview?token=abc.def")).toBe("/preview?token=%5Bhidden%5D");
    expect(hideSecretsInUrl("/delivery/pages/about?locale=fr&preview=abc")).toBe(
      "/delivery/pages/about?locale=fr&preview=%5Bhidden%5D",
    );
    expect(hideSecretsInUrl("/delivery/pages?page=2")).toBe("/delivery/pages?page=2");
    expect(hideSecretsInUrl("/health")).toBe("/health");
  });

  // LINTEL-SEC-014: a basket's token is in its address, and opens the shopper's basket.
  it("hide a basket's token in its address", () => {
    expect(hideSecretsInUrl("/delivery/shop/carts/c4rt-t0ken/lines/l1")).toBe(
      "/delivery/shop/carts/[hidden]/lines/l1",
    );
    expect(hideSecretsInUrl("/delivery/shop/carts/c4rt-t0ken?country=GB")).toBe(
      "/delivery/shop/carts/[hidden]?country=GB",
    );
    expect(hideSecretsInUrl("/delivery/shop/products/linen-shirt")).toBe(
      "/delivery/shop/products/linen-shirt",
    );
  });
});
