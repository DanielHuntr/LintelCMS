import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { useTestDatabase } from "../testing/test-database.js";
import { TestPasskey } from "../testing/test-passkey.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";

const ADMIN_ORIGIN = "http://localhost:5173";

describe("passkeys", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asEd: SendRequest;
  let passkey: TestPasskey;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase, { adminOrigin: ADMIN_ORIGIN });
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor", "Ed Editor");
    asEd = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));
    passkey = new TestPasskey(ADMIN_ORIGIN);
  });

  afterEach(() => server.close());

  async function addPasskey(name = "My laptop") {
    const options = (await asEd("POST", "/account/passkeys/options")).json();
    return asEd("POST", "/account/passkeys", { name, response: passkey.register(options) });
  }

  async function signInWithPasskey(key = passkey) {
    const options = (await server.inject({ method: "POST", url: "/auth/passkey/options" })).json();
    return server.inject({
      method: "POST",
      url: "/auth/passkey/sign-in",
      payload: { response: key.signIn(options) },
    });
  }

  it("asks for a passkey that belongs to this site, kept on the device", async () => {
    const options = (await asEd("POST", "/account/passkeys/options")).json();

    expect(options.rp).toEqual({ id: "localhost", name: "Lintel" });
    expect(options.user.name).toBe("ed@example.com");
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "required",
    });
  });

  it("adds a passkey and signs in with it, without a password", async () => {
    const added = await addPasskey();
    expect(added.statusCode).toBe(201);
    expect(added.json()).toMatchObject({ name: "My laptop", lastUsedAt: null });

    const signedIn = await signInWithPasskey();

    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.json().user.email).toBe("ed@example.com");
    expect(signedIn.cookies.some((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBe(true);
    const list = (await asEd("GET", "/account/passkeys")).json().passkeys;
    expect(list[0].lastUsedAt).not.toBeNull();
    const log = (await asEd("GET", "/account/sessions")).json().sessions;
    expect(log).toHaveLength(2);
  });

  it("won't reuse a challenge", async () => {
    const options = (await asEd("POST", "/account/passkeys/options")).json();
    const response = passkey.register(options);
    expect((await asEd("POST", "/account/passkeys", { name: "One", response })).statusCode).toBe(
      201,
    );

    const replay = await asEd("POST", "/account/passkeys", { name: "Two", response });

    expect(replay.json()).toMatchObject({ code: "PASSKEY_NOT_SAVED" });
  });

  it("refuses a passkey made for another site", async () => {
    const elsewhere = new TestPasskey("https://evil.example.com");
    const options = (await asEd("POST", "/account/passkeys/options")).json();

    const response = await asEd("POST", "/account/passkeys", {
      name: "Phishing",
      response: elsewhere.register(options),
    });

    expect(response.statusCode).toBe(400);
  });

  it("doesn't recognise a passkey it was never given, or one that was removed", async () => {
    expect((await signInWithPasskey(new TestPasskey(ADMIN_ORIGIN))).json()).toMatchObject({
      code: "PASSKEY_NOT_RECOGNISED",
    });

    const added = (await addPasskey()).json();
    expect((await asEd("DELETE", `/account/passkeys/${added.id}`)).statusCode).toBe(204);

    expect((await signInWithPasskey()).statusCode).toBe(401);
  });

  it("can't be used once the account is deactivated", async () => {
    await addPasskey();
    const { user: owner } = await createPersonWithRole(
      testDatabase.database,
      "olive@example.com",
      "owner",
    );
    const asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
    const ed = (await asOwner("GET", "/users?search=ed@")).json().users[0];
    expect(owner.id).not.toBe(ed.id);
    await asOwner("POST", `/users/${ed.id}/deactivate`);

    expect((await signInWithPasskey()).json()).toMatchObject({ code: "ACCOUNT_DEACTIVATED" });
  });
});
