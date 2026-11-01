import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies, TEST_PASSWORD } from "../testing/test-users.js";
import { DEVELOPMENT_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "./session-cookie.js";

const ADMIN_ORIGIN = "http://localhost:5173";

describe("keeping sessions safe", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;

  beforeEach(async () => {
    server = buildServer({
      adminOrigin: ADMIN_ORIGIN,
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
    });
    await server.ready();
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
  });

  afterEach(() => server.close());

  it("names the cookie with the __Host- prefix, so other subdomains can't plant one", async () => {
    const cookies = await signInAndGetCookies(server, "ana@example.com");
    expect(Object.keys(cookies)).toEqual([SESSION_COOKIE_NAME]);
    expect(SESSION_COOKIE_NAME.startsWith("__Host-")).toBe(true);
  });

  it("uses a plain name over plain-HTTP development, where browsers refuse the prefix", async () => {
    const development = buildServer({
      adminOrigin: ADMIN_ORIGIN,
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      secureCookies: false,
    });
    const response = await development.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: "ana@example.com", password: TEST_PASSWORD },
    });
    expect(response.cookies.map((cookie) => cookie.name)).toEqual([
      DEVELOPMENT_SESSION_COOKIE_NAME,
    ]);
    expect(response.cookies[0]).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(response.cookies[0]?.secure).toBeFalsy();
    await development.close();
  });

  it("starts a new session on sign-in and ends the one the browser already had", async () => {
    const first = await signInAndGetCookies(server, "ana@example.com");
    const again = await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      cookies: first,
      payload: { email: "ana@example.com", password: TEST_PASSWORD },
    });

    expect(again.statusCode).toBe(200);
    const newToken = again.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME)?.value;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(first[SESSION_COOKIE_NAME]);
    const oldSession = await server.inject({ method: "GET", url: "/auth/me", cookies: first });
    expect(oldSession.statusCode).toBe(401);
    expect(await testDatabase.database.select().from(sessionsTable)).toHaveLength(1);
  });

  it("keeps the current session when a sign-in attempt fails", async () => {
    const cookies = await signInAndGetCookies(server, "ana@example.com");
    const failed = await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      cookies,
      payload: { email: "ana@example.com", password: "wrong" },
    });
    expect(failed.statusCode).toBe(401);
    const stillSignedIn = await server.inject({ method: "GET", url: "/auth/me", cookies });
    expect(stillSignedIn.statusCode).toBe(200);
  });
});

describe("refusing requests forged by other websites", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let cookies: Record<string, string>;

  beforeEach(async () => {
    server = buildServer({
      adminOrigin: ADMIN_ORIGIN,
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      publicApiUrl: "https://api.example.com",
    });
    await server.ready();
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    cookies = await signInAndGetCookies(server, "ana@example.com");
  });

  afterEach(() => server.close());

  function createMenu(headers: Record<string, string>) {
    return server.inject({
      method: "POST",
      url: "/navigation",
      cookies,
      headers,
      payload: { handle: "footer_links", name: "Footer links" },
    });
  }

  it("accepts changes from the admin's own address", async () => {
    const response = await createMenu({ origin: ADMIN_ORIGIN });
    expect(response.statusCode).toBe(201);
  });

  it("accepts changes from the API's own address", async () => {
    const response = await createMenu({ origin: "https://api.example.com" });
    expect(response.statusCode).toBe(201);
  });

  it("refuses changes sent from another website with the editor's cookie", async () => {
    for (const origin of ["https://blog.example.com", "http://localhost:5174", "null"]) {
      const response = await createMenu({ origin });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "CROSS_SITE_REQUEST_REFUSED" });
    }
  });

  it("refuses a cross-site request that carries no Origin header", async () => {
    const response = await createMenu({ "sec-fetch-site": "cross-site" });
    expect(response.statusCode).toBe(403);
  });

  it("refuses a sign-in posted by another website, so nobody is signed in as someone else", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      headers: { origin: "https://evil.example" },
      payload: { email: "ana@example.com", password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(403);
    expect(response.cookies).toEqual([]);
  });

  it("refuses an upload form posted by another website", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/media",
      cookies,
      headers: {
        origin: "https://blog.example.com",
        "content-type": "multipart/form-data; boundary=x",
      },
      payload:
        '--x\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\nhi\r\n--x--\r\n',
    });
    expect(response.statusCode).toBe(403);
  });

  it("leaves reading alone, and requests that carry an API token", async () => {
    const read = await server.inject({
      method: "GET",
      url: "/collections",
      cookies,
      headers: { origin: "https://blog.example.com" },
    });
    expect(read.statusCode).toBe(200);

    const withToken = await server.inject({
      method: "POST",
      url: "/collections",
      headers: { origin: "https://blog.example.com", authorization: "Bearer lintel_unknown" },
      payload: { handle: "news", name: "News" },
    });
    // Not refused as cross-site: it gets as far as checking the token.
    expect(withToken.statusCode).toBe(401);
  });

  it("lets websites send GraphQL queries from their own pages without a session", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/graphql",
      headers: { origin: "https://www.example.com" },
      payload: { query: "{ __typename }" },
    });
    expect(response.statusCode).toBe(200);
  });
});
