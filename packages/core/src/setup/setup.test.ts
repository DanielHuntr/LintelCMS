import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { buildServer } from "../server.js";
import { testDatabaseUrl, useTestDatabase } from "../testing/test-database.js";
import { usersTable } from "../users/users.table.js";
import { SETUP_CODE_HEADER } from "./setup-code.js";
import { SetupAlreadyDoneError } from "./setup.errors.js";
import { completeSetup } from "./setup.service.js";

const SETUP_CODE = "4821-0937";
const FIRST_ADMIN = {
  email: "Ana@Example.com ",
  name: "Ana Lopez",
  password: "a long and memorable password",
};
// An address from the range set aside for examples: "another computer".
const REMOTE_ADDRESS = "203.0.113.7";

describe("first-run setup", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;

  beforeEach(async () => {
    // A fresh server per test also gives each test a fresh rate limit.
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      setupCode: SETUP_CODE,
    });
    await server.ready();
  });

  afterEach(() => server.close());

  function getStatus(remoteAddress?: string) {
    return server.inject({
      method: "GET",
      url: "/setup/status",
      ...(remoteAddress ? { remoteAddress } : {}),
    });
  }

  function postSetup(
    payload: object,
    options: { remoteAddress?: string; setupCode?: string } = {},
  ) {
    return server.inject({
      method: "POST",
      url: "/setup",
      payload,
      ...(options.remoteAddress ? { remoteAddress: options.remoteAddress } : {}),
      ...(options.setupCode ? { headers: { [SETUP_CODE_HEADER]: options.setupCode } } : {}),
    });
  }

  it("says setup is needed on a fresh install, and which database is in use", async () => {
    const response = await getStatus();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      needsSetup: true,
      database: { kind: testDatabaseUrl ? "postgres" : "built-in", chosenBy: "default" },
      requiresSetupCode: false,
      siteSetupCompleted: false,
    });
  });

  it("creates the first admin with every permission and signs them in", async () => {
    const response = await postSetup(FIRST_ADMIN);

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      user: { id: expect.any(String), email: "ana@example.com", name: "Ana Lopez" },
      permissions: ["*"],
      enabledPlugins: [],
      siteIds: null,
    });

    const sessionCookie = response.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });

    const me = await server.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [SESSION_COOKIE_NAME]: sessionCookie!.value },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual(body);

    expect((await getStatus()).json()).toMatchObject({
      needsSetup: false,
      requiresSetupCode: false,
    });
  });

  it("refuses to run again once someone has an account", async () => {
    await postSetup(FIRST_ADMIN);

    const again = await postSetup({ ...FIRST_ADMIN, email: "mallory@example.com" });

    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({
      statusCode: 409,
      code: "SETUP_ALREADY_DONE",
      error: "Conflict",
      message: "Lintel is already set up. Sign in instead.",
    });
    expect(again.cookies).toEqual([]);
    expect(await testDatabase.database.select().from(usersTable)).toHaveLength(1);
  });

  it("lets only one of two simultaneous requests become the first admin", async () => {
    const [first, second] = await Promise.all([
      postSetup(FIRST_ADMIN),
      postSetup({ ...FIRST_ADMIN, email: "ben@example.com" }),
    ]);

    expect([first!.statusCode, second!.statusCode].sort()).toEqual([201, 409]);
    expect(await testDatabase.database.select().from(usersTable)).toHaveLength(1);
  });

  it("relies on a database lock, not only on this server, to allow one first admin", async () => {
    // Straight to the service, as two server processes sharing one database would.
    const results = await Promise.allSettled([
      completeSetup(
        testDatabase.activeDatabase,
        { ...FIRST_ADMIN, email: "ana@example.com" },
        undefined,
      ),
      completeSetup(
        testDatabase.activeDatabase,
        { ...FIRST_ADMIN, email: "ben@example.com" },
        undefined,
      ),
    ]);

    const failures = results.filter((result) => result.status === "rejected");
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toBeInstanceOf(SetupAlreadyDoneError);
    expect(await testDatabase.database.select().from(usersTable)).toHaveLength(1);
  });

  it("explains what is wrong with the account details, in plain English", async () => {
    const response = await postSetup({ email: "not an email", name: " ", password: "short" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_REQUEST" });
    const message: string = response.json().message;
    expect(message).toContain("That doesn't look like an email address");
    expect(message).toContain("Please enter your name");
    expect(message).toContain("Passwords need at least 12 characters");
    expect((await getStatus()).json()).toMatchObject({ needsSetup: true });
  });

  describe("from another computer", () => {
    it("says a setup code is needed", async () => {
      expect((await getStatus(REMOTE_ADDRESS)).json()).toMatchObject({ requiresSetupCode: true });
    });

    it("refuses without the code, or with the wrong one", async () => {
      const withoutCode = await postSetup(FIRST_ADMIN, { remoteAddress: REMOTE_ADDRESS });
      const wrongCode = await postSetup(FIRST_ADMIN, {
        remoteAddress: REMOTE_ADDRESS,
        setupCode: "1111-2222",
      });

      expect(withoutCode.statusCode).toBe(403);
      expect(withoutCode.json()).toMatchObject({ code: "SETUP_CODE_REQUIRED" });
      expect(withoutCode.json().message).toContain("terminal");
      expect(wrongCode.statusCode).toBe(403);
      expect(wrongCode.json()).toMatchObject({ code: "SETUP_CODE_INVALID" });
      expect(await testDatabase.database.select().from(usersTable)).toEqual([]);
    });

    it("accepts the code printed in the terminal, with or without the dash", async () => {
      const response = await postSetup(FIRST_ADMIN, {
        remoteAddress: REMOTE_ADDRESS,
        setupCode: "48210937",
      });

      expect(response.statusCode).toBe(201);
    });

    it("treats a request forwarded by a proxy on this computer as remote", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/setup",
        payload: FIRST_ADMIN,
        headers: { "x-forwarded-for": REMOTE_ADDRESS },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "SETUP_CODE_REQUIRED" });
    });
  });

  it("slows down repeated setup attempts from the same address", async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await postSetup(FIRST_ADMIN, {
        remoteAddress: REMOTE_ADDRESS,
        setupCode: "0000-0000",
      });
      expect(response.statusCode).toBe(403);
    }

    const response = await postSetup(FIRST_ADMIN, {
      remoteAddress: REMOTE_ADDRESS,
      setupCode: SETUP_CODE,
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ code: "TOO_MANY_SETUP_ATTEMPTS" });
  });

  it("closes the database step once setup is done", async () => {
    await postSetup(FIRST_ADMIN);

    const choose = await server.inject({
      method: "POST",
      url: "/setup/database",
      payload: { kind: "built-in" },
    });
    const test = await server.inject({
      method: "POST",
      url: "/setup/database/test",
      payload: {
        host: "localhost",
        port: 5432,
        database: "x",
        user: "x",
        password: "",
        ssl: false,
      },
    });

    expect(choose.statusCode).toBe(409);
    expect(choose.json()).toMatchObject({ code: "SETUP_ALREADY_DONE" });
    expect(test.statusCode).toBe(409);
  });
});
