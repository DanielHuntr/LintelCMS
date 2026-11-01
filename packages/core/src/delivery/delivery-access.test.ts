import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

const ADMIN_ORIGIN = "http://localhost:5173";
const SITE_ORIGIN = "https://www.example.com";

describe("who may read published content", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
    const created = await api("POST", "/collections/pages/entries", { data: { title: "Home" } });
    await api("POST", `/entries/${created.json().id}/publish`);
  });

  afterEach(() => server.close());

  it("is open to everyone until the site asks for a token", async () => {
    expect((await server.inject({ method: "GET", url: "/delivery/pages/home" })).statusCode).toBe(
      200,
    );

    const updated = await api("PUT", "/delivery-access", { requireToken: true });
    expect(updated.json()).toEqual({ requireToken: true, allowedOrigins: [] });

    const anonymous = await server.inject({ method: "GET", url: "/delivery/pages" });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json().code).toBe("API_TOKEN_REQUIRED");

    const { secret } = (await api("POST", "/api-tokens", { name: "Site", access: "read" })).json();
    const withToken = await server.inject({
      method: "GET",
      url: "/delivery/pages",
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(withToken.statusCode).toBe(200);
    expect((await api("GET", "/delivery/pages/home")).statusCode).toBe(200);
  });

  it("tidies website addresses down to their origin and refuses ones that aren't", async () => {
    const saved = await api("PUT", "/delivery-access", {
      allowedOrigins: ["https://www.example.com/blog/", SITE_ORIGIN, " http://localhost:3000 "],
    });
    expect(saved.json().allowedOrigins).toEqual([SITE_ORIGIN, "http://localhost:3000"]);

    const wrong = await api("PUT", "/delivery-access", { allowedOrigins: ["example.com"] });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().message).toContain("should start with https://");
  });

  it("lets listed websites call the content APIs from the browser, and nothing else", async () => {
    await api("PUT", "/delivery-access", { allowedOrigins: [SITE_ORIGIN] });

    const fromSite = await server.inject({
      method: "GET",
      url: "/delivery/pages/home",
      headers: { origin: SITE_ORIGIN },
    });
    expect(fromSite.headers["access-control-allow-origin"]).toBe(SITE_ORIGIN);
    expect(fromSite.headers["access-control-allow-credentials"]).toBeUndefined();

    const preflight = await server.inject({
      method: "OPTIONS",
      url: "/graphql",
      headers: {
        origin: SITE_ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, authorization",
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(SITE_ORIGIN);
    expect(preflight.headers["access-control-allow-headers"]).toContain("authorization");

    const adminApiFromSite = await server.inject({
      method: "GET",
      url: "/collections",
      headers: { origin: SITE_ORIGIN },
    });
    expect(adminApiFromSite.headers["access-control-allow-origin"]).not.toBe(SITE_ORIGIN);

    const strangerSite = await server.inject({
      method: "GET",
      url: "/delivery/pages/home",
      headers: { origin: "https://evil.example" },
    });
    expect(strangerSite.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
  });

  it("still lets the admin call everything with its session cookie", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/collections",
      headers: { origin: ADMIN_ORIGIN },
    });
    expect(response.headers["access-control-allow-origin"]).toBe(ADMIN_ORIGIN);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("needs settings permissions to change who may read", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));

    expect((await editor("GET", "/delivery-access")).statusCode).toBe(403);
    expect((await editor("PUT", "/delivery-access", { requireToken: true })).statusCode).toBe(403);
  });
});
