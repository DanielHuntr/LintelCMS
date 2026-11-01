import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole, tokenFromLatestEmail } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies, TEST_PASSWORD } from "../testing/test-users.js";

describe("your account", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asEd: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor", "Ed Editor");
    asEd = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));
  });

  afterEach(() => server.close());

  it("shows and changes your name", async () => {
    const account = await asEd("GET", "/account");
    expect(account.json()).toMatchObject({
      email: "ed@example.com",
      name: "Ed Editor",
      avatar: null,
      pendingEmail: null,
      roles: [{ name: "Editor" }],
    });

    const renamed = await asEd("PATCH", "/account", { name: "Edward" });
    expect(renamed.json().name).toBe("Edward");

    const unchanged = await asEd("PATCH", "/account", {});
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json().name).toBe("Edward");
  });

  it("only takes a picture that is in the media library", async () => {
    const response = await asEd("PATCH", "/account", {
      avatarAssetId: "00000000-0000-4000-8000-000000000000",
    });

    expect(response.statusCode).toBe(400);
  });

  it("changes your email only once the new address is confirmed", async () => {
    const request = await asEd("POST", "/account/email", {
      newEmail: "ed@new.example.com",
      password: TEST_PASSWORD,
    });
    expect(request.statusCode).toBe(202);
    expect((await asEd("GET", "/account")).json()).toMatchObject({
      email: "ed@example.com",
      pendingEmail: "ed@new.example.com",
    });
    expect(server.emailOutbox!.latestTo("ed@example.com")!.text).toContain("ed@new.example.com");

    const token = tokenFromLatestEmail(server, "ed@new.example.com");
    const confirm = await server.inject({
      method: "POST",
      url: "/account/email/confirm",
      payload: { token },
    });

    expect(confirm.statusCode).toBe(204);
    expect((await asEd("GET", "/account")).json()).toMatchObject({
      email: "ed@new.example.com",
      pendingEmail: null,
    });
    const again = await server.inject({
      method: "POST",
      url: "/account/email/confirm",
      payload: { token },
    });
    expect(again.json()).toMatchObject({ code: "EMAIL_LINK_INVALID" });
  });

  it("asks for your password before changing your email, and refuses a taken one", async () => {
    await createPersonWithRole(testDatabase.database, "ada@example.com", "admin");

    const wrongPassword = await asEd("POST", "/account/email", {
      newEmail: "x@example.com",
      password: "nope",
    });
    const taken = await asEd("POST", "/account/email", {
      newEmail: "ada@example.com",
      password: TEST_PASSWORD,
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(taken.statusCode).toBe(409);
  });

  it("refuses an easily guessed new password, and keeps the old one", async () => {
    const response = await asEd("POST", "/account/password", {
      currentPassword: TEST_PASSWORD,
      newPassword: "password123456",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("too easy to guess");
  });

  it("changes your password and signs out your other devices, but not this one", async () => {
    await signInAndGetCookies(server, "ed@example.com");
    expect((await asEd("GET", "/account/sessions")).json().sessions).toHaveLength(2);

    const changed = await asEd("POST", "/account/password", {
      currentPassword: TEST_PASSWORD,
      newPassword: "a brand new long password",
    });

    expect(changed.json()).toEqual({ endedSessions: 1 });
    const sessions = (await asEd("GET", "/account/sessions")).json().sessions;
    expect(sessions).toEqual([expect.objectContaining({ current: true })]);
  });

  it("lists where you are signed in, and signs other devices out", async () => {
    await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
      },
      payload: { email: "ed@example.com", password: TEST_PASSWORD },
    });

    const sessions = (await asEd("GET", "/account/sessions")).json().sessions;
    expect(sessions.map((session: { browser: string }) => session.browser)).toContain(
      "Safari on iPhone",
    );

    const signedOut = await asEd("POST", "/account/sessions/sign-out-others");
    expect(signedOut.json()).toEqual({ endedSessions: 1 });

    const remaining = (await asEd("GET", "/account/sessions")).json().sessions;
    expect(remaining).toHaveLength(1);
    expect((await asEd("DELETE", `/account/sessions/${remaining[0].id}`)).statusCode).toBe(204);
    expect((await asEd("GET", "/account")).statusCode).toBe(401);
  });

  it("can't be changed with an API token", async () => {
    await createPersonWithRole(testDatabase.database, "olive@example.com", "owner");
    const asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
    const secret = (
      await asOwner("POST", "/api-tokens", { name: "Script", access: "readWrite" })
    ).json().secret;

    const response = await server.inject({
      method: "POST",
      url: "/account/password",
      headers: { authorization: `Bearer ${secret}` },
      payload: { currentPassword: TEST_PASSWORD, newPassword: "a brand new long password" },
    });

    expect(response.statusCode).toBe(401);
  });
});
