import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("the site address", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  it("starts empty, keeps only the origin, and is in everyone's session", async () => {
    expect((await api("GET", "/site-address")).json()).toEqual({ siteAddress: "" });

    const saved = await api("PUT", "/site-address", {
      siteAddress: "https://brightsidebakery.com/home/",
    });
    expect(saved.json()).toEqual({ siteAddress: "https://brightsidebakery.com" });
    expect((await api("GET", "/auth/me")).json().siteAddress).toBe("https://brightsidebakery.com");
  });

  it("explains an address that isn't a web address", async () => {
    const response = await api("PUT", "/site-address", { siteAddress: "brightside bakery" });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("should start with https://");
  });

  it("needs settings permissions", async () => {
    await createTestUser(testDatabase.database, "ben@example.com", [["entries:read"]]);
    const ben = requestsAs(server, await signInAndGetCookies(server, "ben@example.com"));
    expect((await ben("PUT", "/site-address", { siteAddress: "" })).statusCode).toBe(403);
  });
});
