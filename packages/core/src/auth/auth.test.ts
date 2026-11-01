import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies, TEST_PASSWORD } from "../testing/test-users.js";
import { requirePermission } from "./require-permission.js";
import { SESSION_COOKIE_NAME } from "./session-cookie.js";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

describe("signing in and out", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;

  beforeEach(async () => {
    // A fresh server per test also gives each test a fresh sign-in rate limit.
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
    });
    server.get("/test/publish", { preHandler: requirePermission("entries:publish") }, async () => ({
      published: true,
    }));
    await server.ready();
  });

  afterEach(() => server.close());

  function signIn(email: string, password: string) {
    return server.inject({ method: "POST", url: "/auth/sign-in", payload: { email, password } });
  }

  it("signs in, sets a safe session cookie and returns the user with their permissions", async () => {
    const user = await createTestUser(testDatabase.database, "ana@example.com", [
      ["entries:read", "entries:publish"],
      ["entries:read", "assets:upload"],
    ]);

    const response = await signIn("Ana@Example.com ", TEST_PASSWORD);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: user.id, email: "ana@example.com", name: "Ana Editor" },
      permissions: ["assets:upload", "entries:publish", "entries:read"],
      enabledPlugins: [],
      siteName: null,
      siteIds: null,
    });

    const sessionCookie = response.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    expect(sessionCookie).toMatchObject({
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      path: "/",
    });
    const expiresInDays = (sessionCookie!.expires!.getTime() - Date.now()) / DAY_MILLISECONDS;
    expect(expiresInDays).toBeGreaterThan(29.9);

    const [storedSession] = await testDatabase.database.select().from(sessionsTable);
    expect(storedSession?.userId).toBe(user.id);
    expect(storedSession?.tokenHash).not.toBe(sessionCookie!.value);
  });

  it("gives the same 401 for a wrong password and for an unknown email", async () => {
    await createTestUser(testDatabase.database, "ana@example.com", [["entries:read"]]);

    const wrongPassword = await signIn("ana@example.com", "not the password");
    const unknownEmail = await signIn("nobody@example.com", TEST_PASSWORD);

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownEmail.json());
    expect(wrongPassword.json()).toMatchObject({
      code: "SIGN_IN_FAILED",
      message: "That email and password don't match",
    });
    expect(wrongPassword.cookies).toEqual([]);
  });

  it("explains what is wrong with a malformed sign-in request", async () => {
    const response = await signIn("not an email", "");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_REQUEST" });
    expect(response.json().message).toContain("That doesn't look like an email address");
    expect(response.json().message).toContain("Please enter your password");

    const empty = await server.inject({ method: "POST", url: "/auth/sign-in", payload: {} });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().message).toContain("Please enter an email address");
  });

  it("slows down repeated sign-in attempts from the same address", async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect((await signIn("nobody@example.com", "guess")).statusCode).toBe(401);
    }

    const response = await signIn("nobody@example.com", "guess");

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ code: "TOO_MANY_SIGN_IN_ATTEMPTS" });
  });

  it("returns the signed-in user from /auth/me, and 401 without a session", async () => {
    const user = await createTestUser(testDatabase.database, "ana@example.com", [["entries:read"]]);
    const cookies = await signInAndGetCookies(server, "ana@example.com");

    const signedIn = await server.inject({ method: "GET", url: "/auth/me", cookies });
    const signedOut = await server.inject({ method: "GET", url: "/auth/me" });

    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.json()).toEqual({
      user: { id: user.id, email: "ana@example.com", name: "Ana Editor" },
      permissions: ["entries:read"],
      enabledPlugins: [],
      siteName: null,
      siteIds: null,
    });
    expect(signedOut.statusCode).toBe(401);
    expect(signedOut.json()).toMatchObject({ code: "NOT_SIGNED_IN" });
  });

  it("ends the session on sign-out, so the old cookie stops working", async () => {
    await createTestUser(testDatabase.database, "ana@example.com", [["entries:read"]]);
    const cookies = await signInAndGetCookies(server, "ana@example.com");

    const signOut = await server.inject({ method: "POST", url: "/auth/sign-out", cookies });
    const afterSignOut = await server.inject({ method: "GET", url: "/auth/me", cookies });

    expect(signOut.statusCode).toBe(204);
    const clearedCookie = signOut.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    expect(clearedCookie?.value).toBe("");
    expect(afterSignOut.statusCode).toBe(401);
    expect(await testDatabase.database.select().from(sessionsTable)).toEqual([]);
  });

  it("checks permissions: 401 signed out, 403 without the permission, 200 with it", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["entries:read"]]);
    await createTestUser(testDatabase.database, "publisher@example.com", [["entries:*"]]);
    const readerCookies = await signInAndGetCookies(server, "reader@example.com");
    const publisherCookies = await signInAndGetCookies(server, "publisher@example.com");

    const signedOut = await server.inject({ method: "GET", url: "/test/publish" });
    const reader = await server.inject({
      method: "GET",
      url: "/test/publish",
      cookies: readerCookies,
    });
    const publisher = await server.inject({
      method: "GET",
      url: "/test/publish",
      cookies: publisherCookies,
    });

    expect(signedOut.statusCode).toBe(401);
    expect(reader.statusCode).toBe(403);
    expect(reader.json()).toMatchObject({ code: "PERMISSION_DENIED" });
    expect(reader.json().message).toContain("entries:publish");
    expect(publisher.statusCode).toBe(200);
    expect(publisher.json()).toEqual({ published: true });
  });

  it("rejects an expired session and clears its cookie", async () => {
    await createTestUser(testDatabase.database, "ana@example.com", [["entries:read"]]);
    const cookies = await signInAndGetCookies(server, "ana@example.com");
    await testDatabase.database
      .update(sessionsTable)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    const response = await server.inject({ method: "GET", url: "/auth/me", cookies });

    expect(response.statusCode).toBe(401);
    const clearedCookie = response.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    expect(clearedCookie?.value).toBe("");
    expect(await testDatabase.database.select().from(sessionsTable)).toEqual([]);
  });

  it("extends a session that is used again after more than a day", async () => {
    await createTestUser(testDatabase.database, "ana@example.com", [["entries:read"]]);
    const cookies = await signInAndGetCookies(server, "ana@example.com");
    const twoDaysAgo = new Date(Date.now() - 2 * DAY_MILLISECONDS);
    await testDatabase.database
      .update(sessionsTable)
      .set({ lastUsedAt: twoDaysAgo, expiresAt: new Date(Date.now() + DAY_MILLISECONDS) });

    const response = await server.inject({ method: "GET", url: "/auth/me", cookies });

    expect(response.statusCode).toBe(200);
    const renewedCookie = response.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    expect(renewedCookie?.value).toBe(cookies[SESSION_COOKIE_NAME]);
    const [session] = await testDatabase.database.select().from(sessionsTable);
    expect(session!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * DAY_MILLISECONDS);
  });

  it("does not touch the session again when it was used less than a day ago", async () => {
    await createTestUser(testDatabase.database, "ana@example.com", [["entries:read"]]);
    const cookies = await signInAndGetCookies(server, "ana@example.com");

    const response = await server.inject({ method: "GET", url: "/auth/me", cookies });

    expect(response.statusCode).toBe(200);
    expect(response.cookies).toEqual([]);
  });
});
